import React, { useEffect, useState } from 'react';

/*
 * Aperçu téléphone, pour travailler sur ordinateur. Un interrupteur en haut à droite choisit entre
 * le plein écran (par défaut) et un cadre de Google Pixel 8 (412 × 915 px). Dans le cadre, l'application
 * est chargée dans un iframe qui pointe vers la même adresse : les media queries voient alors une largeur de téléphone.
 * À l'intérieur de cet iframe, le composant ne fait rien et l'application s'affiche seule.
 */

const STORAGE_KEY = 'bennego-apercu';
const PIXEL = { width: 412, height: 915 };
const WIDE = '(min-width: 768px)';
const inFrame = window.self !== window.top;

const readMode = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'telephone' ? 'telephone' : 'ecran';
  } catch {
    return 'ecran';
  }
};

const saveMode = (mode) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Stockage indisponible : le choix vaut seulement pour cette page
  }
};

function useMatch(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function useFitScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(1, (window.innerHeight - 64) / (PIXEL.height + 24)));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

function PixelFrame() {
  const scale = useFitScale();
  return (
    <div style={styles.stage}>
      <div style={{ ...styles.phone, zoom: scale }}>
        <iframe
          title="Aperçu de l'application sur Google Pixel"
          src={window.location.href}
          allow="geolocation; clipboard-write"
          style={styles.screen}
        />
      </div>
    </div>
  );
}

export default function DevicePreview({ children }) {
  const [mode, setMode] = useState(readMode);
  const wide = useMatch(WIDE);
  const framed = !inFrame && wide && mode === 'telephone';

  if (inFrame) return children;

  const choose = (next) => {
    setMode(next);
    saveMode(next);
  };

  return (
    <>
      {wide && (
        <div role="group" aria-label="Affichage de l'application" style={styles.switch}>
          <button
            type="button"
            aria-pressed={!framed}
            onClick={() => choose('ecran')}
            style={{ ...styles.option, ...(!framed ? styles.optionOn : {}) }}
          >
            Plein écran
          </button>
          <button
            type="button"
            aria-pressed={framed}
            onClick={() => choose('telephone')}
            style={{ ...styles.option, ...(framed ? styles.optionOn : {}) }}
          >
            Téléphone
          </button>
        </div>
      )}
      {framed ? <PixelFrame /> : children}
    </>
  );
}

const styles = {
  switch: {
    position: 'fixed',
    top: 12,
    right: 12,
    zIndex: 10000,
    display: 'inline-flex',
    gap: 4,
    padding: 4,
    borderRadius: 999,
    background: 'rgba(17, 17, 22, 0.9)',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
  },
  option: {
    border: 0,
    borderRadius: 999,
    padding: '7px 13px',
    cursor: 'pointer',
    background: 'transparent',
    color: '#c9c9d1',
    font: '700 13px/1 system-ui, sans-serif',
  },
  optionOn: { background: '#D9A55B', color: '#0b0b10' },
  stage: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
    padding: '64px 12px 12px',
    background: '#16161d',
  },
  phone: {
    width: PIXEL.width + 24,
    height: PIXEL.height + 24,
    boxSizing: 'border-box',
    padding: 12,
    borderRadius: 52,
    background: '#050506',
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.5), inset 0 0 0 2px #2a2a33',
    overflow: 'hidden',
  },
  screen: {
    display: 'block',
    width: PIXEL.width,
    height: PIXEL.height,
    border: 0,
    borderRadius: 40,
    background: '#fff',
  },
};
