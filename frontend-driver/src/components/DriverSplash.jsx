import React, { useCallback, useEffect, useState } from 'react';
import { EMBLEM_PARTS, EMBLEM_VIEWBOX } from './emblemPaths';
import './DriverSplash.css';

/*
 * Splash de l'app camionneur, animation de tracé : sur fond sombre quadrillé, le contour de l'emblème
 * se dessine en traits fins avec ses points d'ancrage, se remplit de sable doré, puis le nom apparaît
 * et le logo plonge vers l'écran pour laisser place à l'application.
 */
const DUREE_MS = 4400;
const SEEN_KEY = 'bennego-splash-vu';

// Début et durée du tracé de chaque partie (benne, montant, B, creux du B, anse), en ms
const TRACE = [
  { delay: 350, dur: 1150 },
  { delay: 650, dur: 600 },
  { delay: 800, dur: 1250 },
  { delay: 1350, dur: 550 },
  { delay: 1550, dur: 450 },
];

// Inverse approché de l'accélération du tracé (cubic-bezier 0.45, 0, 0.25, 1) : instant où le trait atteint f
const drawn = (f) => (f < 0.5 ? Math.sqrt(f / 2) : 1 - Math.sqrt((1 - f) / 2));

const prefersReducedMotion = () => (
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
);
const hasSeen = () => {
  try { return window.sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
};
const markSeen = () => {
  try { window.sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* stockage indisponible */ }
};

export function DriverSplash({ onDone }) {
  const [first] = EMBLEM_PARTS[0].nodes;

  // Barre d'état du téléphone sombre pendant l'animation, puis couleur de l'app
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const before = meta?.getAttribute('content');
    meta?.setAttribute('content', '#0b0b10');
    return () => { if (before) meta?.setAttribute('content', before); };
  }, []);
  return (
    <div className="bn-dsplash" role="status" aria-label="BenneGo Driver, chargement" onClick={onDone}>
      <div className="bn-dsplash__grid" aria-hidden="true" />
      <div className="bn-dsplash__stage" aria-hidden="true">
        <svg className="bn-dsplash__logo" viewBox={EMBLEM_VIEWBOX}>
          <defs>
            <linearGradient id="bn-dsplash-sable" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f1dab0" />
              <stop offset="0.45" stopColor="#e8c38a" />
              <stop offset="1" stopColor="#d9a55b" />
            </linearGradient>
            {/* Le remplissage balaie l'emblème de gauche à droite */}
            <clipPath id="bn-dsplash-wipe">
              <rect className="bn-dsplash__wipe" x="-40" y="-40" width="800" height="530" />
            </clipPath>
          </defs>

          {/* Lignes de construction, comme dans un logiciel de dessin */}
          <g className="bn-dsplash__guides">
            <line x1="0" y1="225" x2="720" y2="225" />
            <line x1="360" y1="0" x2="360" y2="450" />
            <circle cx="430" cy="290" r="150" />
          </g>

          <g className="bn-dsplash__fill" clipPath="url(#bn-dsplash-wipe)">
            <path d={EMBLEM_PARTS.map((p) => p.d).join(' ')} fillRule="evenodd" fill="url(#bn-dsplash-sable)" />
          </g>

          <g className="bn-dsplash__strokes">
            {EMBLEM_PARTS.map((part, i) => (
              <path
                key={part.d.slice(0, 24)}
                d={part.d}
                pathLength="1"
                style={{ '--delay': `${TRACE[i].delay}ms`, '--dur': `${TRACE[i].dur}ms` }}
              />
            ))}
          </g>

          <g className="bn-dsplash__nodes">
            {/* Chaque point apparaît quand le trait l'atteint (position f le long du contour) */}
            {EMBLEM_PARTS.flatMap((part, i) => part.nodes.map(([x, y, f]) => (
              <rect
                key={`${i}-${x}-${y}`}
                x={x - 4}
                y={y - 4}
                width="8"
                height="8"
                style={{ '--delay': `${Math.round(TRACE[i].delay + drawn(f) * TRACE[i].dur)}ms` }}
              />
            )))}
          </g>

          {/* Étincelle de départ du tracé */}
          <circle className="bn-dsplash__spark" cx={first[0]} cy={first[1]} r="6" />
        </svg>

        <div className="bn-dsplash__word">
          <strong>BenneGo</strong>
          <span>Driver</span>
        </div>
      </div>
    </div>
  );
}

/** Affiche le splash une fois par session (appui pour passer, absent si animations réduites). */
export default function DriverSplashGate({ children }) {
  const [visible, setVisible] = useState(() => !hasSeen() && !prefersReducedMotion());

  const finish = useCallback(() => {
    markSeen();
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
      {visible && <DriverSplash onDone={finish} />}
    </>
  );
}
