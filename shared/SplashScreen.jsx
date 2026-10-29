import { useCallback, useEffect, useRef, useState } from 'react';
import './SplashScreen.css';

// L'écran de démarrage ne s'affiche qu'une fois par session du navigateur (ouverture de l'application)
const SEEN_KEY = 'bennego-splash-vu';

/*
 * Scène vue de dessus, comme le livreur de la référence : le camion-benne suit la route
 * (vers la droite, vers le haut, puis vers la droite), ralentit dans les virages, freine,
 * lève sa benne et vide le sable derrière lui. Chaque image est calculée à partir du temps écoulé.
 */
const ROUTE = 'M -50 430 H 110 Q 150 430 150 390 V 230 Q 150 190 190 190 H 316';
// Marche arrière : le camion dépasse le chantier puis recule dedans, l'arrière vers le point de déchargement
const BACK_ROUTE = 'M 316 190 Q 243 190 243 210';
const ROAD = 'M -80 430 H 110 Q 150 430 150 390 V 230 Q 150 190 190 190 H 440';

// Chronologie en secondes depuis l'ouverture
const T = {
  roads: [0, 0.5],
  drive: [0.3, 2.9],
  word: [0.9, 1.4],
  reverse: [3.05, 4.05],
  tipUp: [4.15, 4.6],
  sand: [4.35, 5.25],
  tipDown: [5.25, 5.65],
  fade: [5.75, 6.15],
};
const DUREE_MS = 6150;
const TIP_MAX = (48 * Math.PI) / 180;
// Taille du camion dans la scène
const TRUCK_SCALE = 1.45;

// Géométrie du camion (repère local : avant vers +x, origine au centre)
const BED = { x: -30, length: 42 };
const FRONT_AXLE = 20;
const TIRE_Y = 12.5;

const BLOCKS = [
  [16, 482, 88, 60], [16, 250, 86, 130], [16, 60, 120, 80], [204, 60, 132, 78],
  [204, 334, 132, 80], [204, 482, 132, 60],
];
const TREES = [[120, 486], [60, 222], [312, 232], [176, 470], [326, 160]];

const GRAINS = Array.from({ length: 40 }, (_, i) => ({
  release: i / 40,
  y0: -8 + ((i * 7) % 17),
  reach: 6 + ((i * 11) % 17),
  spread: 1.2 + ((i * 5) % 7) * 0.08,
  fill: ['#d9a55b', '#c9893c', '#ecc27f', '#b87a32'][i % 4],
}));

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const progress = ([start, end], t) => clamp((t - start) / (end - start));
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const deg = (rad) => (rad * 180) / Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Prépare le trajet : points, cap, et un profil de vitesse réaliste (plus lent dans les virages,
 * freinage progressif à l'arrivée). `time[i]` est la part du trajet écoulée au point i, de 0 à 1.
 */
function buildProfile(path, fromRest = false) {
  const length = path.getTotalLength();
  const n = Math.ceil(length);
  const pts = Array.from({ length: n + 1 }, (_, i) => path.getPointAtLength(Math.min(length, i)));
  const head = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n, i + 1)];
    return Math.atan2(b.y - a.y, b.x - a.x);
  });
  const curve = head.map((h, i) => Math.abs(wrap(head[Math.min(n, i + 1)] - h)));
  const time = [0];
  for (let i = 1; i <= n; i += 1) {
    let bend = 0;
    for (let k = Math.max(0, i - 16); k <= Math.min(n, i + 16); k += 1) bend = Math.max(bend, curve[k]);
    const braking = Math.sqrt(Math.max(0, length - i) / 80);
    const launch = fromRest ? Math.sqrt(Math.min(1, (i + 4) / 40)) : 1;
    const speed = Math.max(0.04, (launch * Math.min(1, braking)) / (1 + 16 * bend));
    time.push(time[i - 1] + 1 / speed);
  }
  const total = time[n];
  return { length, n, pts, head, time: time.map((v) => v / total) };
}

function distanceAt(profile, u) {
  const { time, n } = profile;
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (time[mid] <= u) lo = mid;
    else hi = mid;
  }
  const span = time[hi] - time[lo] || 1;
  return lo + (u - time[lo]) / span;
}

function pointAt(profile, s) {
  const i = clamp(Math.round(s), 0, profile.n);
  return { x: profile.pts[i].x, y: profile.pts[i].y, h: profile.head[i] };
}

function SplashScreen({ onDone }) {
  const refs = useRef({});
  const set = (key) => (el) => { refs.current[key] = el; };

  useEffect(() => {
    const r = refs.current;
    const profile = buildProfile(r.route);
    const back = buildProfile(r.backRoute, true);
    const puffs = Array.from(r.dust.children).map((el, k) => ({ el, s: 30 + k * 16 }))
      .filter((p) => p.s < profile.length - 30)
      .map((p) => ({ ...p, t: T.drive[0] + profile.time[Math.round(p.s)] * (T.drive[1] - T.drive[0]) }));
    let frame = 0;
    const start = performance.now();

    const render = (now) => {
      const t = (now - start) / 1000;
      // En avant sur la route, puis en marche arrière dans le chantier (le cap est l'inverse du sens de déplacement)
      const reversing = t >= T.reverse[0];
      const path = reversing ? back : profile;
      const s = distanceAt(path, progress(reversing ? T.reverse : T.drive, t));
      const at = pointAt(path, s);
      const { x, y } = at;
      const h = reversing ? at.h + Math.PI : at.h;
      const turn = clamp(wrap(pointAt(path, s + 14).h - at.h) * 1.4, -0.55, 0.55);
      const steer = reversing ? -turn : turn;
      const rolled = reversing ? profile.length - s : s;

      r.overlay.style.opacity = String(1 - progress(T.fade, t));
      r.roads.setAttribute('opacity', String(progress(T.roads, t)));
      r.word.style.opacity = String(progress(T.word, t));
      r.word.style.transform = `translateY(${(1 - progress(T.word, t)) * 12}px)`;
      r.truck.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg(h).toFixed(2)}) scale(${TRUCK_SCALE})`);
      r.steerL.setAttribute('transform', `rotate(${deg(steer).toFixed(2)} ${FRONT_AXLE} ${-TIRE_Y})`);
      r.steerR.setAttribute('transform', `rotate(${deg(steer).toFixed(2)} ${FRONT_AXLE} ${TIRE_Y})`);
      r.treads.querySelectorAll('line').forEach((el) => el.setAttribute('stroke-dashoffset', (-(rolled % 3.2)).toFixed(2)));

      // Benne : se lève (raccourcie vue de dessus), découvre le vérin, puis redescend
      const tilt = TIP_MAX * (easeInOut(progress(T.tipUp, t)) - easeInOut(progress(T.tipDown, t)));
      const unload = easeInOut(progress(T.sand, t));
      r.bed.setAttribute('transform', `translate(${BED.x} 0) scale(${Math.cos(tilt).toFixed(3)} ${(1 + 0.08 * Math.sin(tilt)).toFixed(3)}) translate(${-BED.x} 0)`);
      r.bedShade.setAttribute('opacity', (0.22 * Math.sin(tilt)).toFixed(3));
      r.piston.setAttribute('x2', (BED.x + BED.length * Math.cos(tilt)).toFixed(2));
      r.load.setAttribute('width', (37 * (1 - unload)).toFixed(2));

      // Sable : les grains glissent de l'arrière de la benne et forment un tas sur la route
      Array.from(r.grains.children).forEach((el, i) => {
        const g = GRAINS[i];
        const age = (t - (T.sand[0] + g.release * (T.sand[1] - T.sand[0] - 0.3))) / 0.45;
        if (age < 0 || age > 1.6) { el.setAttribute('opacity', '0'); return; }
        const fall = clamp(age);
        el.setAttribute('cx', (BED.x - 2 - g.reach * (1 - (1 - fall) ** 2)).toFixed(2));
        el.setAttribute('cy', (g.y0 * (1 + (g.spread - 1) * fall)).toFixed(2));
        el.setAttribute('r', (2.1 - 0.7 * fall).toFixed(2));
        el.setAttribute('opacity', (age <= 1 ? 1 : 1 - (age - 1) / 0.6).toFixed(2));
      });
      const pile = clamp((t - T.sand[0] - 0.15) / (T.sand[1] - T.sand[0]));
      r.pile.setAttribute('transform', `translate(-44 0) scale(${easeInOut(pile).toFixed(3)})`);

      // Poussière soulevée par les roues arrière
      puffs.forEach((p, k) => {
        const age = (t - p.t) / 0.6;
        if (age < 0 || age > 1) { p.el.setAttribute('opacity', '0'); return; }
        const at = pointAt(profile, p.s - 40);
        const side = k % 2 ? 1 : -1;
        p.el.setAttribute('cx', (at.x - Math.sin(at.h) * 13 * side).toFixed(2));
        p.el.setAttribute('cy', (at.y + Math.cos(at.h) * 13 * side).toFixed(2));
        p.el.setAttribute('r', (2 + age * 7).toFixed(2));
        p.el.setAttribute('opacity', (0.28 * (1 - age)).toFixed(3));
      });

      if (t < DUREE_MS / 1000) frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={set('overlay')} className="bn-splash" role="status" aria-label="BenneGo, chargement" onClick={onDone}>
      <svg className="bn-splash__scene" viewBox="0 0 360 560" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <g ref={set('roads')} opacity="0">
          {BLOCKS.map(([x, y, w, hgt]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={w} height={hgt} rx="10" fill="#f5f1eb" />
          ))}
          {TREES.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7" fill="#e3ecdc" />
          ))}
          {/* Chantier où le sable est déchargé, avec son entrée depuis la route */}
          <rect x="204" y="246" width="132" height="66" rx="10" fill="#f1e6d0" stroke="#f0a35c" strokeWidth="1.5" strokeDasharray="6 5" />
          <rect x="222" y="214" width="42" height="36" fill="#e8e2d9" />
          {[[214, 300], [326, 256], [326, 300]].map(([cx, cy]) => (
            <path key={`${cx}-${cy}`} d={`M${cx - 4} ${cy + 4} L${cx} ${cy - 5} L${cx + 4} ${cy + 4} Z`} fill="#d9a55b" />
          ))}
          <path d={ROAD} fill="none" stroke="#e8e2d9" strokeWidth="64" />
          <path d={ROAD} fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="14 12" />
        </g>
        <path ref={set('route')} d={ROUTE} fill="none" stroke="none" />
        <path ref={set('backRoute')} d={BACK_ROUTE} fill="none" stroke="none" />
        <g ref={set('dust')}>
          {Array.from({ length: 32 }, (_, k) => (
            <circle key={k} r="0" fill="#c8bfb2" opacity="0" />
          ))}
        </g>

        <g ref={set('truck')} transform="translate(-50 430) scale(1.45)">
          {/* Ombre au sol */}
          <rect x="-28" y="-10" width="60" height="24" rx="4" fill="#111827" opacity="0.13" transform="translate(2.5 3)" />

          {/* Tas de sable déversé derrière la benne */}
          <g ref={set('pile')} transform="translate(-44 0) scale(0)">
            <ellipse rx="15" ry="12.5" fill="#c9893c" />
            <ellipse cx="-1.5" cy="-1.5" rx="11" ry="9" fill="#d9a55b" />
            <ellipse cx="-3" cy="-3" rx="5.5" ry="4.5" fill="#ecc27f" />
          </g>

          {/* Pneus : les rayures défilent quand le camion roule */}
          <g ref={set('treads')}>
            {[-21, -11].flatMap((ax) => [-TIRE_Y, TIRE_Y].map((ty) => (
              <g key={`${ax}${ty}`}>
                <line x1={ax - 4} x2={ax + 4} y1={ty} y2={ty} stroke="#1f2937" strokeWidth="4.5" strokeLinecap="round" />
                <line x1={ax - 4} x2={ax + 4} y1={ty} y2={ty} stroke="#0b0f19" strokeWidth="4.5" strokeDasharray="1.6 1.6" />
              </g>
            )))}
            {[-TIRE_Y, TIRE_Y].map((ty) => (
              <g key={`front${ty}`} ref={set(ty < 0 ? 'steerL' : 'steerR')}>
                <line x1={FRONT_AXLE - 4} x2={FRONT_AXLE + 4} y1={ty} y2={ty} stroke="#1f2937" strokeWidth="4.5" strokeLinecap="round" />
                <line x1={FRONT_AXLE - 4} x2={FRONT_AXLE + 4} y1={ty} y2={ty} stroke="#0b0f19" strokeWidth="4.5" strokeDasharray="1.6 1.6" />
              </g>
            ))}
          </g>

          {/* Châssis et vérin, visibles quand la benne se lève */}
          <rect x="-29" y="-6.5" width="44" height="3" rx="1" fill="#374151" />
          <rect x="-29" y="3.5" width="44" height="3" rx="1" fill="#374151" />
          <line ref={set('piston')} x1="12" y1="0" x2="12" y2="0" stroke="#9ca3af" strokeWidth="3.2" strokeLinecap="round" />

          {/* Benne : pivote sur son arête arrière */}
          <g ref={set('bed')}>
            <rect x={BED.x} y="-11" width={BED.length} height="22" rx="2" fill="#d9a55b" stroke="#a8743a" strokeWidth="1.2" />
            <rect ref={set('load')} x="-27" y="-8.5" width="37" height="17" rx="2" fill="#b87a32" />
            <path d="M-27 -4 H10 M-27 0 H10 M-27 4 H10" stroke="#c9893c" strokeWidth="0.6" opacity="0.5" />
            <rect ref={set('bedShade')} x={BED.x} y="-11" width={BED.length} height="22" rx="2" fill="#111827" opacity="0" />
          </g>

          {/* Cabine */}
          <rect x="12.5" y="-11" width="19" height="22" rx="3.5" fill="#111827" />
          <rect x="14.5" y="-8" width="9" height="16" rx="2" fill="#1f2a3d" />
          <rect x="24.5" y="-9.5" width="4.5" height="19" rx="1.5" fill="#9fc6ef" />
          <rect x="21" y="-13.2" width="3" height="1.8" rx="0.6" fill="#111827" />
          <rect x="21" y="11.4" width="3" height="1.8" rx="0.6" fill="#111827" />
          <rect x="30.6" y="-9.5" width="1.4" height="3" rx="0.5" fill="#fde68a" />
          <rect x="30.6" y="6.5" width="1.4" height="3" rx="0.5" fill="#fde68a" />

          {/* Sable qui tombe de la benne */}
          <g ref={set('grains')}>
            {GRAINS.map((g, i) => (
              <circle key={i} r="2" fill={g.fill} opacity="0" />
            ))}
          </g>
        </g>
      </svg>
      <p ref={set('word')} className="bn-splash__word" translate="no" style={{ opacity: 0 }}>
        Benne<span>Go</span>
      </p>
    </div>
  );
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hasSeenSplash() {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSplashSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Stockage indisponible : l'écran reviendra au prochain chargement
  }
}

/** Affiche l'écran de démarrage par-dessus l'application, une fois par session. Un toucher le passe. */
export default function SplashGate({ children }) {
  const [visible, setVisible] = useState(() => !hasSeenSplash() && !prefersReducedMotion());

  const finish = useCallback(() => {
    markSplashSeen();
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(finish, DUREE_MS);
    return () => window.clearTimeout(timer);
  }, [visible, finish]);

  return (
    <>
      {children}
      {visible && <SplashScreen onDone={finish} />}
    </>
  );
}
