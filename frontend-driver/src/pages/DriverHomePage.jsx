import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MessageCircle, Navigation, Power } from 'lucide-react';
import api, { mediaUrl } from '../services/api';
import useDriverAuthStore from '../store/authStore';
import { useDriverSession } from '../context/DriverSession';
import { Glyph, STATUS, describe, glyphFor, shortDate } from '../../../frontend-client/src/components/delivery';
import { fcfa, initialsOf, WHATSAPP_URL } from '../utils/format';
import '../styles/driver.css';

const DONE = ['validated', 'completed'];
const amount = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
const TAG_CLASS = { active: 't-active', waiting: 't-wait', done: 't-done', cancelled: 't-cancel' };

/**
 * Accueil du camionneur (inspiré de l'accueil client) : disponibilité, course en cours,
 * gains du jour et du mois, courses récentes. Pas de passation de commande.
 */
export default function DriverHomePage() {
  const user = useDriverAuthStore((s) => s.user);
  const { isAvailable, toggling, toggleAvailability, activeOrder, position, gpsError, accuracy } = useDriverSession();
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api.get('/drivers/me/summary').then(({ data }) => setSummary(data)).catch(() => {});
    api.get('/orders?limit=100')
      .then(({ data }) => setOrders((data.orders || []).filter((o) => o.driver_id === user?.id)))
      .catch(() => setOrders([]));
  }, [activeOrder?.status]);

  const today = new Date().toDateString();
  const todayTotal = (orders || [])
    .filter((o) => DONE.includes(o.status) && new Date(o.validated_at || o.created_at).toDateString() === today)
    .reduce((sum, o) => sum + Number(o.driver_amount || 0), 0);
  const recent = (orders || []).filter((o) => o.id !== activeOrder?.id).slice(0, 3);
  const firstName = user?.prenom || user?.full_name?.split(' ')[0];
  const info = activeOrder ? STATUS[activeOrder.status] || STATUS.accepted : null;
  const earnings = summary?.earnings || {};
  const waiting = Number(earnings.pending_payout || 0) + Number(earnings.awaiting_confirmation || 0);

  return (
    <main className="bn-page bn-home">
      <header className="bn-home__head">
        <div className="bn-home__hello">
          <span>Bonjour{firstName ? ` ${firstName}` : ''} 👋</span>
          <Link to="/profil" className="bn-dhome__avatar" aria-label="Mon profil">
            {user?.profile_photo_url ? <img src={mediaUrl(user.profile_photo_url)} alt="" /> : <span aria-hidden="true">{initialsOf(user?.full_name)}</span>}
          </Link>
        </div>
        <h1 className="bn-home__title">Prêt pour la<br /><span>prochaine course ?</span></h1>
      </header>

      <section className={`bn-onair${isAvailable ? ' is-on' : ''}`} aria-live="polite">
        <div className="bn-onair__text">
          <strong>{isAvailable ? 'En ligne' : 'Hors ligne'}</strong>
          <span>
            {isAvailable
              ? gpsError || (position ? `GPS actif · précision ${accuracy} m` : 'Recherche du GPS…')
              : 'Passez en ligne pour recevoir les courses'}
          </span>
        </div>
        <button
          type="button"
          className="bn-onair__btn"
          onClick={toggleAvailability}
          disabled={toggling}
          aria-pressed={isAvailable}
          aria-label={isAvailable ? 'Passer hors ligne' : 'Passer en ligne'}
        >
          <Power size={26} aria-hidden="true" />
        </button>
      </section>

      {activeOrder && (
        <Link to={`/order/${activeOrder.id}`} className="bn-live">
          <span className="bn-live__top">
            <span className="bn-live__icon"><Glyph kind={glyphFor(activeOrder)} size={30} /></span>
            <span className="bn-live__text">
              <small>{activeOrder.order_number} · {describe(activeOrder)}</small>
              <strong>{info.label} · {fcfa(activeOrder.driver_amount)}</strong>
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </span>
          <span className="bn-live__bar" aria-hidden="true"><i style={{ width: `${((info.stage + 1) / 4) * 100}%` }} /></span>
          <span className="bn-live__legs"><span>{activeOrder.pickup_address}</span><span>{activeOrder.delivery_address}</span></span>
        </Link>
      )}

      <section className="bn-dstats" aria-label="Vos gains">
        <div><small>Aujourd'hui</small><strong>{amount(todayTotal)}<em>FCFA</em></strong></div>
        <div><small>Ce mois</small><strong>{summary ? amount(earnings.this_month) : '…'}<em>FCFA</em></strong></div>
        <div><small>Note</small><strong>{summary?.rating ? `${Number(summary.rating).toFixed(1)} ★` : '—'}</strong></div>
      </section>

      {waiting > 0 && (
        <p className="bn-dhome__pending">
          <Navigation size={14} aria-hidden="true" />
          {fcfa(waiting)} en attente de versement
        </p>
      )}

      {recent.length > 0 && (
        <section aria-label="Courses récentes">
          <div className="bn-deliveries__head">
            <h2>Récentes</h2>
            <Link to="/courses" className="bn-link">Tout voir</Link>
          </div>
          <div className="bn-recent">
            {recent.map((o) => {
              const st = STATUS[o.status] || { tag: o.status, ribbon: 'waiting' };
              return (
                <Link key={o.id} to={`/order/${o.id}`} className="bn-recent__row">
                  <span className="bn-glyph bn-glyph--sm"><Glyph kind={glyphFor(o)} size={22} /></span>
                  <span className="bn-recent__main">
                    <strong>{describe(o)}</strong>
                    <small>{shortDate(o.created_at)} · {fcfa(o.driver_amount)}</small>
                  </span>
                  <span className={`bn-tag ${TAG_CLASS[st.ribbon]}`}>{st.tag}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <a className="bn-help" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={18} aria-hidden="true" /> Un souci sur une course ? Écrivez-nous sur WhatsApp
      </a>
    </main>
  );
}
