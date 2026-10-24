import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  orders: 'M4 7l8-4 8 4v10l-8 4-8-4V7zm8 2.2L6.3 7 12 4.2 17.7 7 12 9.2z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
  referral: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  business: 'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z',
};

const Glyph = ({ d, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Barre de navigation basse : accueil, commandes, nouvelle commande (centre), parrainage, entreprise. */
export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path) => {
    if (path === '/') return pathname === '/';
    if (path === '/orders') return pathname === '/orders' || (pathname.startsWith('/orders/') && pathname !== '/orders/new');
    return pathname === path;
  };

  const tab = (path, label, glyph) => (
    <button
      key={path}
      type="button"
      className={`bn-tab${isActive(path) ? ' is-active' : ''}`}
      onClick={() => navigate(path)}
      aria-current={isActive(path) ? 'page' : undefined}
    >
      <Glyph d={glyph} />
      <span>{label}</span>
    </button>
  );

  return (
    <nav className="bn-tabbar" aria-label="Navigation principale">
      {tab('/', 'Accueil', PATHS.home)}
      {tab('/orders', 'Commandes', PATHS.orders)}
      <button type="button" className="bn-tab" onClick={() => navigate('/orders/new')} aria-label="Nouvelle commande">
        <span className="bn-tab__fab"><Glyph d={PATHS.plus} size={26} /></span>
      </button>
      {tab('/referral', 'Parrainage', PATHS.referral)}
      {tab('/enterprise', 'Entreprise', PATHS.business)}
    </nav>
  );
}
