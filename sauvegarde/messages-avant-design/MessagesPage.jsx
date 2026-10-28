import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import api from '../services/api';
import { STATUS, describe } from '../components/delivery';
import '../styles/messages.css';

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

/** Onglet « Messages » : une conversation par commande en cours avec un chauffeur. */
export default function MessagesPage() {
  const [threads, setThreads] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/orders')
      .then(async ({ data }) => {
        const open = (data.orders || []).filter((o) => o.driver_id && !CHAT_CLOSED.includes(o.status));
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
    <main className="bn-page bn-home">
      <header className="bn-home__head">
        <p className="bn-home__kicker">Vos chauffeurs</p>
        <h1 className="bn-home__title">Messages</h1>
      </header>

      {threads === null ? (
        <p className="bn-subtitle">Chargement des discussions…</p>
      ) : threads.length === 0 ? (
        <div className="bn-empty">
          <MessageCircle size={40} aria-hidden="true" color="var(--brand-ink)" />
          <strong>Aucune discussion en cours</strong>
          <span>Une discussion s'ouvre avec le chauffeur dès qu'il accepte une commande, jusqu'à la fin de la livraison.</span>
        </div>
      ) : (
        <div className="bn-threads">
          {threads.map(({ order, last }) => (
            <Link key={order.id} to={`/messages/${order.id}`} className="bn-thread">
              <span className="bn-thread__avatar" aria-hidden="true">{initialsOf(order.driver_name)}</span>
              <span className="bn-thread__main">
                <span className="bn-thread__top">
                  <strong>{order.driver_name || 'Chauffeur'}</strong>
                  <small>{timeOf(last?.created_at)}</small>
                </span>
                <span className="bn-thread__sub">{order.order_number} · {describe(order)} · {STATUS[order.status]?.label || order.status}</span>
                <span className="bn-thread__last">{last ? `${last.sender_role === 'client' ? 'Vous : ' : ''}${last.message}` : 'Écrivez au chauffeur'}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
