import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, MessageCircle } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import { WHATSAPP_URL as WHATSAPP } from '../constants/contact';
import { Glyph, STATUS, describe, glyphFor, shortDate } from '../components/delivery';
import NotificationBell from '../components/NotificationBell';
import { MarketPricesCard } from '../components/market';

const TILES = [
  { name: 'Sable', hint: 'Lagunaire, de carrière', glyph: 'sand', params: { type: 'MATERIAL', matiere: 'Sable lagunaire' }, hero: true },
  { name: 'Gravier', hint: '5/15, 15/25', glyph: 'gravel', params: { type: 'MATERIAL', matiere: 'Gravier 15/25' } },
  { name: 'Latérite', hint: 'Remblai, voirie', glyph: 'laterite', params: { type: 'MATERIAL', matiere: 'Latérite (terre rouge)' } },
  { name: 'Engins', hint: 'Pelle, bulldozer', glyph: 'machine', params: { type: 'RENTAL' } },
];

const TAG_CLASS = { active: 't-active', waiting: 't-wait', done: 't-done', cancelled: 't-cancel' };

/** Accueil (design B) : commander en un geste, la livraison en cours, puis les commandes récentes. */
export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api.get('/orders').then(({ data }) => setOrders(data.orders || [])).catch(() => setOrders([]));
  }, []);

  const firstName = user?.full_name?.split(' ')[0] || '';
  const list = orders || [];
  const current = useMemo(() => list.find((o) => (STATUS[o.status]?.group || 'done') !== 'done'), [list]);
  const recent = useMemo(() => list.filter((o) => o !== current).slice(0, 3), [list, current]);
  const info = current ? STATUS[current.status] || STATUS.pending : null;

  return (
    <main className="bn-page bn-home">
      <header className="bn-home__head">
        <div className="bn-home__hello">
          <span>Bonjour{firstName ? ` ${firstName}` : ''} 👋</span>
          <NotificationBell orders={orders} />
        </div>
        <h1 className="bn-home__title">Que livrons-nous<br /><span>aujourd'hui ?</span></h1>
      </header>

      <section className="bn-tiles" aria-label="Commander">
        {TILES.map((t) => (
          <button
            key={t.name}
            type="button"
            className={`bn-tile${t.hero ? ' bn-tile--hero' : ''}`}
            onClick={() => navigate(`/orders/new?${new URLSearchParams(t.params)}`)}
          >
            <Glyph kind={t.glyph} size={40} />
            <span><strong>{t.name}</strong><small>{t.hint}</small></span>
          </button>
        ))}
      </section>

      {current && (
        <Link to={`/orders/${current.id}`} className="bn-live">
          <span className="bn-live__top">
            <span className="bn-live__icon"><Glyph kind={glyphFor(current)} size={30} /></span>
            <span className="bn-live__text">
              <small>{current.order_number} · {describe(current)}</small>
              <strong>{info.label}{current.driver_name ? ` · ${current.driver_name.split(' ')[0]}` : ''}</strong>
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </span>
          <span className="bn-live__bar" aria-hidden="true"><i style={{ width: `${((info.stage + 1) / 4) * 100}%` }} /></span>
          <span className="bn-live__legs"><span>{current.pickup_address}</span><span>{current.delivery_address}</span></span>
        </Link>
      )}

      {recent.length > 0 && (
        <section aria-label="Commandes récentes">
          <div className="bn-deliveries__head">
            <h2>Récentes</h2>
            <Link to="/orders" className="bn-link">Tout voir</Link>
          </div>
          <div className="bn-recent">
            {recent.map((o) => {
              const st = STATUS[o.status] || { tag: o.status, ribbon: 'waiting' };
              return (
                <Link key={o.id} to={`/orders/${o.id}`} className="bn-recent__row">
                  <span className="bn-glyph bn-glyph--sm"><Glyph kind={glyphFor(o)} size={22} /></span>
                  <span className="bn-recent__main">
                    <strong>{describe(o)}</strong>
                    <small>{shortDate(o.created_at)} · {o.delivery_address}</small>
                  </span>
                  <span className={`bn-tag ${TAG_CLASS[st.ribbon]}`}>{st.tag}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <MarketPricesCard />

      <a className="bn-help" href={WHATSAPP} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={18} aria-hidden="true" /> Une question ? Écrivez-nous sur WhatsApp
      </a>
    </main>
  );
}
