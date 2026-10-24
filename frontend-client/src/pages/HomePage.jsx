import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import { BadgeCheck, HardHat, LogOut, MapPin, Mountain, Minus, MessageCircle, ShieldCheck, Trash2, TrendingDown, TrendingUp } from 'lucide-react';

const STATUS = {
  awaiting_payment: { label: 'À payer', tone: 'danger', step: 0 },
  pending: { label: 'Recherche chauffeur', tone: 'warning', step: 1 },
  accepted: { label: 'Chauffeur assigné', tone: 'info', step: 2 },
  driver_en_route_pickup: { label: 'Chauffeur en route', tone: 'violet', step: 3 },
  loading: { label: 'Chargement', tone: 'brand', step: 4 },
  driver_en_route_delivery: { label: 'En livraison', tone: 'info', step: 5 },
  delivered: { label: 'Livré · à confirmer', tone: 'warning', step: 6 },
  validated: { label: 'Terminée', tone: 'success', step: 7 },
  completed: { label: 'Terminée', tone: 'success', step: 7 },
  cancelled: { label: 'Annulée', tone: 'danger', step: 0 },
};
const STEP_COUNT = 7;
const FINAL = ['validated', 'completed', 'cancelled'];
const WHATSAPP = 'https://wa.me/22990000000?text=Bonjour%20BenneGo%2C%20j%27ai%20besoin%20d%27aide';

const SERVICES = [
  { type: 'MATERIAL', title: 'Transport de matériaux', hint: 'Sable, gravier, latérite', brand: true, icon: 'materials' },
  { type: 'RENTAL', title: "Location d'engins", hint: 'Pelles, bulldozers, chargeurs', icon: 'machines' },
  { type: 'EVACUATION', title: 'Évacuation de gravats', hint: 'Décharge autorisée', icon: 'waste' },
  { type: 'WHATSAPP', title: 'Assistance', hint: 'Écrivez-nous sur WhatsApp', icon: 'chat' },
];

const ICONS = {
  materials: Mountain,
  machines: HardHat,
  waste: Trash2,
  chat: MessageCircle,
  shield: ShieldCheck,
  pin: MapPin,
  badge: BadgeCheck,
  logout: LogOut,
  trendUp: TrendingUp,
  trendDown: TrendingDown,
  trendStable: Minus,
};

const TREND_ICON = { up: 'trendUp', down: 'trendDown', stable: 'trendStable' };

const Icon = ({ name, size = 22 }) => {
  const Glyph = ICONS[name];
  return Glyph ? <Glyph size={size} aria-hidden="true" /> : null;
};

const fcfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'B';

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [barometer, setBarometer] = useState([]);

  useEffect(() => {
    api.get('/orders').then(({ data }) => setOrders(data.orders || [])).catch(() => {});
    api.get('/barometer').then(({ data }) => setBarometer(data.items || [])).catch(() => {});
  }, []);

  const current = useMemo(
    () => orders.find((o) => !FINAL.includes(o.status)),
    [orders],
  );
  const recent = useMemo(() => orders.slice(0, 3), [orders]);
  const firstName = user?.full_name?.split(' ')[0] || 'vous';

  const openService = (service) => {
    if (service.type === 'WHATSAPP') window.open(WHATSAPP, '_blank', 'noopener,noreferrer');
    else navigate(`/orders/new?type=${service.type}`);
  };

  return (
    <main className="bn-page">
      <header className="bn-hello">
        <div className="bn-hello__who">
          <span className="bn-avatar" aria-hidden="true">{initials(user?.full_name)}</span>
          <div>
            <p className="bn-kicker">Bonjour</p>
            <h1 className="bn-hello__name">{firstName}</h1>
          </div>
        </div>
        <button className="bn-icon-btn" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter">
          <Icon name="logout" size={20} />
        </button>
      </header>

      <section className="bn-hero">
        <p className="bn-kicker bn-hero__kicker">Livraison de matériaux & BTP</p>
        <h2 className="bn-hero__title">Commandez, suivez, payez en sécurité.</h2>
        <p className="bn-subtitle">Votre paiement reste bloqué sur BenneGo jusqu'à ce que vous confirmiez la réception.</p>
        <button className="bn-btn bn-btn--primary bn-btn--block bn-hero__cta" onClick={() => navigate('/orders/new')}>
          Nouvelle commande
        </button>
      </section>

      <section className="bn-quick" aria-label="Services">
        {SERVICES.map((service) => (
          <button
            key={service.type}
            className={`bn-quick__tile${service.brand ? ' bn-quick__tile--brand' : ''}`}
            onClick={() => openService(service)}
          >
            <span className="bn-quick__chip"><Icon name={service.icon} /></span>
            <span>
              <strong className="bn-quick__title">{service.title}</strong>
              <span className="bn-quick__hint">{service.hint}</span>
            </span>
          </button>
        ))}
      </section>

      {current && (
        <section className="bn-card bn-current" aria-label="Commande en cours">
          <div className="bn-current__head">
            <div>
              <p className="bn-kicker">Commande en cours</p>
              <h3 className="bn-current__ref">{current.order_number}</h3>
            </div>
            <span className={`bn-pill bn-pill--${STATUS[current.status]?.tone || 'neutral'}`}>
              {STATUS[current.status]?.label || current.status}
            </span>
          </div>
          <div className="bn-route">
            <span className="bn-route__dot bn-route__dot--from" />
            <p>{current.pickup_address}</p>
            <span className="bn-route__dot bn-route__dot--to" />
            <p>{current.delivery_address}</p>
          </div>
          <div className="bn-progress" aria-hidden="true">
            <span style={{ width: `${Math.round(((STATUS[current.status]?.step || 0) / STEP_COUNT) * 100)}%` }} />
          </div>
          <button className="bn-btn bn-btn--primary bn-btn--block" onClick={() => navigate(`/orders/${current.id}`)}>
            {current.status === 'awaiting_payment' ? 'Finaliser le paiement' : 'Suivre la commande'}
          </button>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div className="bn-section-head">
            <h2>Dernières commandes</h2>
            <button className="bn-link" onClick={() => navigate('/orders')}>Tout voir</button>
          </div>
          <div className="bn-list">
            {recent.map((order) => (
              <button key={order.id} className="bn-card bn-row" onClick={() => navigate(`/orders/${order.id}`)}>
                <span className="bn-row__main">
                  <strong>{order.order_number}</strong>
                  <span className="bn-subtitle">{new Date(order.created_at).toLocaleDateString('fr-FR')} · {fcfa(order.total_amount)}</span>
                </span>
                <span className={`bn-pill bn-pill--${STATUS[order.status]?.tone || 'neutral'}`}>
                  {STATUS[order.status]?.label || order.status}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="bn-card bn-card--dark bn-b2b">
        <span className="bn-pill bn-pill--brand">BenneGo Business</span>
        <h2 className="bn-b2b__title">Grands comptes, promoteurs et entreprises BTP</h2>
        <p className="bn-subtitle">Plusieurs rotations sur une seule proforma, suivi GPS en direct et commission réduite.</p>
        <div className="bn-b2b__actions">
          <button className="bn-btn bn-btn--primary" onClick={() => navigate('/enterprise')}>Tableau de bord chantiers</button>
          <button className="bn-btn" onClick={() => navigate('/orders')}>Mes courses</button>
        </div>
      </section>

      {barometer.length > 0 && (
        <section className="bn-card">
          <div className="bn-section-head">
            <h2>Indice des prix BTP · semaine {barometer[0].week_number}</h2>
          </div>
          <div className="bn-list">
            {barometer.map((item) => (
              <div key={item.material_name} className="bn-row bn-row--static">
                <span>{item.material_name}</span>
                <strong className="bn-price">
                  {Math.round(item.avg_price_m3).toLocaleString('fr-FR')} FCFA/m³
                  <span className="bn-trend">{TREND_ICON[item.trend] && <Icon name={TREND_ICON[item.trend]} size={14} />}</span>
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bn-trust" aria-label="Garanties">
        <div className="bn-card bn-trust__item"><span className="bn-quick__chip"><Icon name="shield" size={20} /></span><strong>Séquestre sécurisé</strong><span>Votre argent est protégé jusqu'à la livraison</span></div>
        <div className="bn-card bn-trust__item"><span className="bn-quick__chip"><Icon name="pin" size={20} /></span><strong>GPS en direct</strong><span>Suivez votre camion pendant la course</span></div>
        <div className="bn-card bn-trust__item"><span className="bn-quick__chip"><Icon name="badge" size={20} /></span><strong>Numéros vérifiés</strong><span>Chaque compte est validé par SMS</span></div>
      </section>

      <section className="bn-card">
        <h2 className="bn-steps__title">Comment ça marche</h2>
        <ol className="bn-steps">
          <li><strong>Commandez et payez</strong><span>Le paiement est bloqué sur BenneGo.</span></li>
          <li><strong>Un chauffeur part</strong><span>Vous suivez le camion sur la carte.</span></li>
          <li><strong>Confirmez la réception</strong><span>Seulement alors le chauffeur est payé.</span></li>
        </ol>
      </section>
    </main>
  );
}
