import { useCallback, useEffect, useState } from 'react';
import './SplashScreen.css';

// L'écran de démarrage ne s'affiche qu'une fois par session du navigateur (ouverture de l'application)
const SEEN_KEY = 'bennego-splash-vu';
// Fin de l'animation : le fondu de sortie se termine à 4,8 s (voir SplashScreen.css)
const DUREE_MS = 4800;

// Grains de sable : ils se détachent de l'arrière de la benne une fois inclinée, puis tombent sur la route
const GRAINS = Array.from({ length: 24 }, (_, i) => ({
  x: -38 + ((i * 3) % 4) * 1.5,
  dx: -10 - ((i * 7) % 15),
  dy: 22 + ((i * 5) % 5),
  delay: 3.2 + ((i * 3) % 7) * 0.08,
  r: 2.4 + ((i * 2) % 3) * 0.4,
  fill: ['#d9a55b', '#c9893c', '#ecc27f', '#b87a32'][i % 4],
}));

// Scène : une route qui pivote, un camion-benne qui roule dessus, puis la benne qui déverse du sable.
// Le camion reprend le dessin de la vitrine ; son origine est le point de contact de la roue arrière.
function SplashScreen({ onDone }) {
  return (
    <div className="bn-splash" role="status" aria-label="BenneGo, chargement" onClick={onDone}>
      <svg className="bn-splash__scene" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <g className="bn-splash__road">
          <rect x="140" y="-60" width="80" height="760" rx="12" fill="#e7e0d6" />
          <line
            className="bn-splash__dash"
            x1="180"
            y1="-60"
            x2="180"
            y2="700"
            stroke="#ffffff"
            strokeWidth="3"
            strokeDasharray="16 14"
          />
        </g>
        <g transform="translate(180 320)">
          <g className="bn-splash__truck-in">
            <g className="bn-splash__ride">
              <g transform="scale(0.78)">
                <g transform="rotate(-45 48 1)">
                  <ellipse cx="48" cy="1" rx="80" ry="8" fill="#111827" opacity="0.08" />
                </g>
                <g transform="translate(-34 -18)">
                  <g className="bn-splash__bed">
                    <rect x="0" y="-62" width="122" height="62" rx="8" fill="#ff6b00" />
                    <rect x="10" y="-52" width="102" height="8" rx="4" fill="#ffb27a" />
                  </g>
                </g>
                <circle cx="-34" cy="-18" r="4.5" fill="#111827" />
                <path d="M88 -60 H126 Q140 -60 146 -46 L156 -20 V-16 H88 Z" fill="#111827" />
                <rect x="102" y="-54" width="26" height="16" rx="3" fill="#dbeafe" />
                {[0, 116].map((cx) => (
                  <g key={cx} className="bn-splash__wheel">
                    <circle cx={cx} cy="-14" r="14" fill="#111827" />
                    <circle cx={cx} cy="-14" r="5" fill="#f2ebe2" />
                  </g>
                ))}
                <g transform="rotate(-45 -52 1)">
                  <ellipse className="bn-splash__pile" cx="-52" cy="1" rx="26" ry="6" fill="#d9a55b" />
                </g>
                {GRAINS.map((g, i) => (
                  <circle
                    key={i}
                    className="bn-splash__grain"
                    cx={g.x}
                    cy="-22"
                    r={g.r}
                    fill={g.fill}
                    style={{ '--dx': `${g.dx}px`, '--dy': `${g.dy}px`, animationDelay: `${g.delay}s` }}
                  />
                ))}
              </g>
            </g>
          </g>
        </g>
      </svg>
      <p className="bn-splash__word">
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
