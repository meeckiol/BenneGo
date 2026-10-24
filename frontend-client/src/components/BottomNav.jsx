import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, ClipboardList, Gift, Home, Plus } from 'lucide-react';

/** Barre de navigation basse : accueil, commandes, nouvelle commande (centre), parrainage, entreprise. */
export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path) => {
    if (path === '/') return pathname === '/';
    if (path === '/orders') return pathname === '/orders' || (pathname.startsWith('/orders/') && pathname !== '/orders/new');
    return pathname === path;
  };

  const tab = (path, label, Icon) => (
    <button
      key={path}
      type="button"
      className={`bn-tab${isActive(path) ? ' is-active' : ''}`}
      onClick={() => navigate(path)}
      aria-current={isActive(path) ? 'page' : undefined}
    >
      <Icon size={22} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );

  return (
    <nav className="bn-tabbar" aria-label="Navigation principale">
      {tab('/', 'Accueil', Home)}
      {tab('/orders', 'Commandes', ClipboardList)}
      <button type="button" className="bn-tab" onClick={() => navigate('/orders/new')} aria-label="Nouvelle commande">
        <span className="bn-tab__fab"><Plus size={26} aria-hidden="true" /></span>
      </button>
      {tab('/referral', 'Parrainage', Gift)}
      {tab('/enterprise', 'Entreprise', Building2)}
    </nav>
  );
}
