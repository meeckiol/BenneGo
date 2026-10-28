import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Glyph, STATUS, glyphFor } from './delivery';

// Date de la dernière ouverture du panneau : ce qui a changé depuis porte une pastille
const SEEN_KEY = 'bennego-notifs-vues';

const readSeen = () => {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
};

const changedAt = (order) => new Date(order.updated_at || order.created_at).getTime();

function ago(time) {
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  return new Date(time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/**
 * Cloche de l'accueil. Il n'y a pas de service de notifications : le panneau montre
 * l'activité réelle des commandes (dernier statut de chacune), la plus récente en haut.
 */
export default function NotificationBell({ orders }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const box = useRef(null);

  const events = useMemo(
    () => [...(orders || [])].sort((a, b) => changedAt(b) - changedAt(a)).slice(0, 6),
    [orders],
  );
  const unread = events.filter((o) => changedAt(o) > seen).length;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const toggle = () => {
    if (!open) {
      const now = Date.now();
      try { window.localStorage.setItem(SEEN_KEY, String(now)); } catch { /* stockage indisponible */ }
      setTimeout(() => setSeen(now), 1200);
    }
    setOpen((v) => !v);
  };

  return (
    <div className="bn-bell" ref={box}>
      <button
        type="button"
        className="bn-bell__btn"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} nouvelle${unread > 1 ? 's' : ''}` : 'Notifications'}
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && <span className="bn-bell__dot" aria-hidden="true">{unread}</span>}
      </button>

      {open && (
        <div className="bn-bell__panel" role="dialog" aria-label="Notifications">
          <p className="bn-bell__title">Notifications</p>
          {events.length === 0 ? (
            <p className="bn-bell__empty">Rien de nouveau pour le moment.</p>
          ) : (
            events.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className={`bn-bell__item${changedAt(o) > seen ? ' is-new' : ''}`}>
                <span className="bn-glyph bn-glyph--sm"><Glyph kind={glyphFor(o)} size={22} /></span>
                <span>
                  <strong>{o.order_number} · {STATUS[o.status]?.label || o.status}</strong>
                  <small>{ago(changedAt(o))}</small>
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
