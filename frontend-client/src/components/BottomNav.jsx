import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, ClipboardList, Home, MessageCircle, Plus, User } from 'lucide-react';
import useAuthStore, { selectAccountType } from '../store/authStore';

/**
 * Barre de navigation basse. Le premier onglet suit le type de compte choisi à la connexion :
 * accueil pour un client, chantiers pour un compte entreprise. L'affiliation se trouve dans le profil.
 */
export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const accountType = useAuthStore(selectAccountType);

  const isActive = (path) => {
    if (path === '/') return pathname === '/';
    if (path === '/messages') return pathname.startsWith('/messages');
    if (path === '/profil') return pathname.startsWith('/profil') || pathname === '/referral' || pathname === '/code-promo';
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
      {accountType === 'entreprise'
        ? tab('/', 'Chantiers', Building2)
        : tab('/', 'Accueil', Home)}
      {tab('/orders', 'Commandes', ClipboardList)}
      <button type="button" className="bn-tab" onClick={() => navigate('/orders/new')} aria-label="Nouvelle commande">
        <span className="bn-tab__fab"><Plus size={26} aria-hidden="true" /></span>
      </button>
      {tab('/messages', 'Messages', MessageCircle)}
      {tab('/profil', 'Profil', User)}
    </nav>
  );
}
