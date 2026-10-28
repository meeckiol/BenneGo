import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import api from '../services/api';
import useDriverAuthStore from '../store/authStore';
import { STATUS } from '../../../frontend-client/src/components/delivery';
import { useUnread, badgeText } from '../../../shared/messaging';
import '../../../frontend-client/src/styles/messages.css';

// Une discussion disparaît de l'application quand la commande est terminée ou annulée.
// Les messages restent en base : seul l'affichage s'arrête.
export const CHAT_CLOSED = ['validated', 'completed', 'cancelled'];

export const initialsOf = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'BG';

const timeOf = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

/** Onglet « Messages » du camionneur : une conversation par course en cours avec le client. */
export default function MessagesPage() {
  const me = useDriverAuthStore((s) => s.user);
  const [threads, setThreads] = useState(null);
  const unread = useUnread((s) => s.byOrder);

  useEffect(() => {
    let alive = true;
    api.get('/orders?limit=100')
      .then(async ({ data }) => {
        const open = (data.orders || []).filter((o) => o.driver_id === me?.id && !CHAT_CLOSED.includes(o.status));
        const withLast = await Promise.all(open.map((o) => api.get(`/orders/${o.id}/chat`)
          .then(({ data: chat }) => ({ order: o, last: (chat.messages || []).at(-1) || null }))
          .catch(() => ({ order: o, last: null }))));
        withLast.sort((a, b) => new Date(b.last?.created_at || b.order.created_at) - new Date(a.last?.created_at || a.order.created_at));
        if (alive) setThreads(withLast);
      })
      .catch(() => alive && setThreads([]));
    return () => { alive = false; };
  }, []);

  return (
    <main className="bn-page bn-msgs">
      <h1 className="bn-msgs__title">Messages</h1>

      {threads === null ? (
        <p className="bn-subtitle">Chargement des discussions…</p>
      ) : threads.length === 0 ? (
        <div className="bn-empty">
          <MessageCircle size={40} aria-hidden="true" color="var(--brand-ink)" />
          <strong>Aucune discussion en cours</strong>
          <span>Une discussion s'ouvre avec le client dès que vous acceptez une course.</span>
        </div>
      ) : (
        <div className="bn-threads">
          {threads.map(({ order, last }) => {
            const fromClient = last && last.sender_role !== 'driver';
            const count = unread[order.id] || 0;
            return (
              <Link key={order.id} to={`/messages/${order.id}`} className="bn-thread">
                <span className="bn-thread__avatar" aria-hidden="true">{initialsOf(order.client_name)}</span>
                <span className="bn-thread__main">
                  <span className="bn-thread__top">
                    <strong>{order.client_name || 'Client'}</strong>
                    <small>{timeOf(last?.created_at)}</small>
                  </span>
                  <span className="bn-thread__tag">{order.order_number} · {STATUS[order.status]?.tag || order.status}</span>
                  <span className="bn-thread__row">
                    <span className={`bn-thread__last${count ? ' is-new' : ''}`}>
                      {last ? `${last.sender_role === 'admin' ? 'BenneGo : ' : fromClient ? '' : 'Vous : '}${last.message}` : 'Écrivez au client'}
                    </span>
                    {count > 0 && <span className="bn-badge" aria-label={`${count} non lu(s)`}>{badgeText(count)}</span>}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
