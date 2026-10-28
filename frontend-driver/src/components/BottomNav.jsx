import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClipboardList, Home, MessageCircle, User } from 'lucide-react';
import { useUnread, badgeText } from '../../../shared/messaging';

/** Barre du bas du camionneur : mêmes onglets que le client, sans bouton de commande. */
export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const unread = useUnread((s) => s.total);

  const isActive = (path) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  const tab = (path, label, Icon, badge = 0) => (
    <button
      key={path}
      type="button"
      className={`bn-tab${isActive(path) ? ' is-active' : ''}`}
      onClick={() => navigate(path)}
      aria-current={isActive(path) ? 'page' : undefined}
    >
      <span className="bn-tab__icon">
        <Icon size={22} aria-hidden="true" />
        {badge > 0 && <span className="bn-badge bn-badge--tab" aria-label={`${badge} message(s) non lu(s)`}>{badgeText(badge)}</span>}
      </span>
      <span>{label}</span>
    </button>
  );

  return (
    <nav className="bn-tabbar bn-tabbar--four" aria-label="Navigation principale">
      {tab('/', 'Accueil', Home)}
      {tab('/courses', 'Courses', ClipboardList)}
      {tab('/messages', 'Messages', MessageCircle, unread)}
      {tab('/profil', 'Profil', User)}
    </nav>
  );
}
