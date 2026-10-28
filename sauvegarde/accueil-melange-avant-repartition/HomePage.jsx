import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, MessageCircle, Search, Trash2 } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api, { mediaUrl } from '../services/api';
import { WHATSAPP_URL as WHATSAPP } from '../constants/contact';
import '../styles/home.css';

// Avancement de chaque statut sur la frise : 0 commandée, 1 chauffeur, 2 en route, 3 livrée
const STATUS = {
  awaiting_payment: { label: 'À payer', tag: 'À payer', short: 'À payer', stage: 0, ribbon: 'waiting', group: 'pay' },
  pending: { label: 'Recherche chauffeur', tag: 'En attente', short: 'Recherche…', stage: 0, ribbon: 'waiting', group: 'active' },
  accepted: { label: 'Chauffeur assigné', tag: 'Assigné', short: 'Assigné', stage: 1, ribbon: 'active', group: 'active' },
  driver_en_route_pickup: { label: 'Vers la carrière', tag: 'En route', short: 'Vers carrière', stage: 1, ribbon: 'active', group: 'active' },
  loading: { label: 'Chargement', tag: 'Chargement', short: 'Chargement', stage: 2, ribbon: 'active', group: 'active' },
  driver_en_route_delivery: { label: 'En route', tag: 'En route', short: 'En route', stage: 2, ribbon: 'active', group: 'active' },
  delivered: { label: 'À confirmer', tag: 'À confirmer', short: 'Livré', stage: 3, ribbon: 'active', group: 'active' },
  validated: { label: 'Livrée', tag: 'Livrée', short: 'Livrée', stage: 3, ribbon: 'done', group: 'done' },
  completed: { label: 'Livrée', tag: 'Livrée', short: 'Livrée', stage: 3, ribbon: 'done', group: 'done' },
  cancelled: { label: 'Annulée', tag: 'Annulée', short: 'Annulée', stage: 0, ribbon: 'cancelled', group: 'done' },
};

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'active', label: 'En cours' },
  { key: 'pay', label: 'À payer' },
  { key: 'done', label: 'Terminées' },
];

const MATERIALS = [
  { name: 'Sable', hint: 'Lagunaire, de carrière', glyph: 'sand', hero: true },
  { name: 'Gravier', hint: '5/15, 15/25', glyph: 'gravel' },
  { name: 'Latérite', hint: 'Remblai, voirie', glyph: 'laterite' },
];

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'B';
const shortDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—');

/** Petit dessin du matériau ou du service, comme sur les maquettes. */
function Glyph({ kind, size = 28 }) {
  if (kind === 'gravel') {
    return (
      <svg width={size} height={size * 0.8} viewBox="0 0 28 22" aria-hidden="true">
        <circle cx="8" cy="15" r="5" fill="#9ca3af" /><circle cx="17" cy="14" r="6" fill="#b7bcc4" /><circle cx="12" cy="9" r="4" fill="#cfd3d9" />
      </svg>
    );
  }
  if (kind === 'laterite') {
    return (
      <svg width={size} height={size * 0.8} viewBox="0 0 28 22" aria-hidden="true">
        <path d="M2 20 C6 10 10 6 14 6 C18 6 22 10 26 20 Z" fill="#b5532d" /><path d="M9 20 C11 14 12 12 14 12 C16 12 17 14 19 20 Z" fill="#d07a4f" />
      </svg>
    );
  }
  if (kind === 'machine') {
    return (
      <svg width={size} height={size * 0.8} viewBox="0 0 32 24" aria-hidden="true">
        <rect x="2" y="12" width="16" height="6" rx="2" fill="#111827" /><path d="M18 14 26 4l3 2-7 10z" fill="#f6a906" />
        <circle cx="6" cy="20" r="3" fill="#374151" /><circle cx="14" cy="20" r="3" fill="#374151" />
      </svg>
    );
  }
  if (kind === 'waste') return <Trash2 size={size * 0.75} aria-hidden="true" color="#805c00" />;
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 28 22" aria-hidden="true">
      <path d="M2 20 C6 8 10 4 14 4 C18 4 22 8 26 20 Z" fill="#d9a55b" /><path d="M8 20 C10 12 12 9 14 9 C16 9 18 12 20 20 Z" fill="#ecc27f" />
    </svg>
  );
}

function glyphFor(order) {
  if (order.order_type === 'RENTAL') return 'machine';
  if (order.order_type === 'EVACUATION') return 'waste';
  const text = `${order.material_name || ''} ${order.material_description || ''}`.toLowerCase();
  if (text.includes('grav')) return 'gravel';
  if (text.includes('later') || text.includes('latér')) return 'laterite';
  return 'sand';
}

function describe(order) {
  if (order.order_type === 'RENTAL') return order.vehicle_name || "Location d'engin";
  if (order.order_type === 'EVACUATION') return 'Évacuation de gravats';
  const what = order.material_name || order.material_description || 'Matériaux';
  return order.quantity_m3 ? `${what} · ${Number(order.quantity_m3)} m³` : what;
}

const TruckIcon = ({ idle }) => (
  <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
    <rect x="0" y="2" width="9" height="6" rx="1" fill={idle ? '#d5d0c8' : '#f6a906'} />
    <path d="M9 4h4l2 3v1H9z" fill={idle ? '#9aa0aa' : '#111827'} />
    <circle cx="3" cy="10" r="1.6" fill={idle ? '#9aa0aa' : '#111827'} />
    <circle cx="12" cy="10" r="1.6" fill={idle ? '#9aa0aa' : '#111827'} />
  </svg>
);

/** Frise en pointillés : étapes franchies en or, le camion à l'étape en cours. */
function Track({ status }) {
  const info = STATUS[status] || STATUS.pending;
  const idle = info.ribbon !== 'active';
  const finished = info.ribbon === 'done';
  const items = [];
  for (let i = 0; i < 4; i += 1) {
    const reached = finished || i < info.stage;
    if (i > 0) items.push(<span key={`d${i}`} className={`bn-track__dash${finished || i <= info.stage ? '' : ' is-off'}`} />);
    if (!finished && i === info.stage) {
      items.push(
        <span key={`t${i}`} className={`bn-track__truck${idle ? ' is-idle' : ''}`}>
          <span className="bn-track__label">{info.short}</span>
          <TruckIcon idle={idle} />
        </span>,
      );
    } else {
      items.push(
        <span key={`p${i}`} className={`bn-track__dot${reached ? '' : ' is-off'}`}>
          {reached && <Check size={11} strokeWidth={3.5} />}
        </span>,
      );
    }
  }
  return <div className="bn-track" aria-label={`Statut : ${info.label}`}>{items}</div>;
}

function DeliveryCard({ order, index }) {
  const info = STATUS[order.status] || { label: order.status, ribbon: 'waiting' };
  return (
    <Link to={`/orders/${order.id}`} className="bn-dcard" style={{ animationDelay: `${index * 60}ms` }}>
      <span className={`bn-ribbon bn-ribbon--${info.ribbon}`}>{info.tag || info.label}</span>
      <div className="bn-dcard__top">
        <span className="bn-glyph"><Glyph kind={glyphFor(order)} /></span>
        <div>
          <p className="bn-dcard__ref">{order.order_number}</p>
          <p className="bn-dcard__what">{describe(order)}</p>
        </div>
      </div>
      <Track status={order.status} />
      <div className="bn-dcard__legs">
        <div>DEPUIS<strong>{order.pickup_address || '—'}</strong>{shortDate(order.created_at)}</div>
        <div>VERS<strong>{order.delivery_address || '—'}</strong>{order.delivered_at ? shortDate(order.delivered_at) : order.status === 'awaiting_payment' ? 'Paiement à finaliser' : info.label}</div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/orders').then(({ data }) => setOrders(data.orders || [])).catch(() => setOrders([]));
  }, []);

  const firstName = user?.full_name?.split(' ')[0] || 'vous';

  // Commandes en cours d'abord, puis les plus récentes
  const sorted = useMemo(() => {
    const rank = (o) => ((STATUS[o.status]?.group || 'done') === 'done' ? 1 : 0);
    return [...(orders || [])].sort((a, b) => rank(a) - rank(b) || new Date(b.created_at) - new Date(a.created_at));
  }, [orders]);

  const counts = useMemo(() => {
    const c = { all: sorted.length, active: 0, pay: 0, done: 0 };
    sorted.forEach((o) => { c[STATUS[o.status]?.group || 'done'] += 1; });
    return c;
  }, [sorted]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted
      .filter((o) => filter === 'all' || (STATUS[o.status]?.group || 'done') === filter)
      .filter((o) => !q || [o.order_number, o.pickup_address, o.delivery_address, describe(o)].some((v) => (v || '').toLowerCase().includes(q)))
      .slice(0, 8);
  }, [sorted, filter, query]);

  const order = (params) => navigate(`/orders/new?${new URLSearchParams(params)}`);

  return (
    <main className="bn-page bn-home">
      <header className="bn-home__head">
        <div className="bn-home__hello">
          <span>Bonjour {firstName}</span>
          <Link to="/profil" className="bn-home__avatar" aria-label="Mon profil">
            {user?.profile_photo_url ? <img src={mediaUrl(user.profile_photo_url)} alt="" /> : initials(user?.full_name)}
          </Link>
        </div>
        <h1 className="bn-home__title">Que livrons-nous<br /><span>aujourd'hui ?</span></h1>
      </header>

      <section className="bn-tiles" aria-label="Commander">
        {MATERIALS.map((m) => (
          <button key={m.name} type="button" className={`bn-tile${m.hero ? ' bn-tile--hero' : ''}`} onClick={() => order({ type: 'MATERIAL', matiere: m.name })}>
            <Glyph kind={m.glyph} size={40} />
            <span><strong>{m.name}</strong><small>{m.hint}</small></span>
          </button>
        ))}
        <button type="button" className="bn-tile" onClick={() => order({ type: 'RENTAL' })}>
          <Glyph kind="machine" size={40} />
          <span><strong>Engins</strong><small>Pelle, bulldozer</small></span>
        </button>
      </section>

      <div className="bn-extras">
        <button type="button" className="bn-extra" onClick={() => order({ type: 'EVACUATION' })}>
          <Trash2 size={18} aria-hidden="true" /> Évacuer des gravats
        </button>
        <button type="button" className="bn-extra" onClick={() => window.open(WHATSAPP, '_blank', 'noopener,noreferrer')}>
          <MessageCircle size={18} aria-hidden="true" /> Assistance WhatsApp
        </button>
      </div>

      <section className="bn-deliveries" aria-label="Mes livraisons">
        <div className="bn-deliveries__head">
          <h2>Mes livraisons</h2>
          <Link to="/orders" className="bn-link">Tout voir</Link>
        </div>

        <label className="bn-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une commande"
            aria-label="Rechercher une commande"
          />
        </label>

        <div className="bn-filters" role="tablist" aria-label="Filtrer les livraisons">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`bn-filter${filter === f.key ? ' is-active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <b>{counts[f.key]}</b>
            </button>
          ))}
        </div>

        {orders === null ? (
          <div className="bn-loading" aria-busy="true">
            <div className="bn-loading__ghost" />
            <div className="bn-loading__ghost" />
            <div className="bn-loading__label">
              <Search size={34} aria-hidden="true" />
              Recherche de vos livraisons…
            </div>
          </div>
        ) : visible.length > 0 ? (
          <div className="bn-dcards" key={`${filter}-${query}`}>
            {visible.map((o, i) => <DeliveryCard key={o.id} order={o} index={i} />)}
          </div>
        ) : (
          <div className="bn-empty">
            <Glyph kind="sand" size={44} />
            <strong>{orders.length === 0 ? 'Aucune livraison pour le moment' : 'Aucune livraison dans ce filtre'}</strong>
            {orders.length === 0 && (
              <button type="button" className="bn-btn bn-btn--primary" onClick={() => navigate('/orders/new')}>Nouvelle commande</button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
