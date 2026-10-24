import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../services/api';

const STATUS = {
  awaiting_payment: { label: 'À payer', tone: 'danger' },
  pending: { label: 'Recherche chauffeur', tone: 'warning' },
  accepted: { label: 'Chauffeur assigné', tone: 'info' },
  driver_en_route_pickup: { label: 'Chauffeur en route', tone: 'violet' },
  loading: { label: 'Chargement', tone: 'brand' },
  driver_en_route_delivery: { label: 'En livraison', tone: 'info' },
  delivered: { label: 'Livré · à confirmer', tone: 'warning' },
  validated: { label: 'Réception confirmée', tone: 'success' },
  completed: { label: 'Terminée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'danger' },
};

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'active', label: 'En cours' },
  { key: 'done', label: 'Terminées' },
];
const DONE = ['validated', 'completed', 'cancelled'];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/orders')
      .then(({ data }) => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => orders.filter((o) => {
    if (filter === 'active') return !DONE.includes(o.status);
    if (filter === 'done') return DONE.includes(o.status);
    return true;
  }), [orders, filter]);

  return (
    <main className="bn-page">
      <header className="bn-page-head">
        <button className="bn-icon-btn" onClick={() => navigate('/')} aria-label="Retour à l'accueil"><ArrowLeft size={20} aria-hidden="true" /></button>
        <div>
          <p className="bn-kicker">Vos courses</p>
          <h1 className="bn-title">Mes commandes</h1>
        </div>
      </header>

      <div className="bn-segment" role="tablist" aria-label="Filtrer">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            className={`bn-segment__btn${filter === f.key ? ' is-active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p className="bn-subtitle">Chargement…</p>}

      {!loading && visible.length === 0 && (
        <section className="bn-card bn-empty">
          <p>{orders.length === 0 ? "Aucune commande pour l'instant." : 'Aucune commande dans cette catégorie.'}</p>
          {orders.length === 0 && (
            <button className="bn-btn bn-btn--primary" onClick={() => navigate('/orders/new')}>
              Passer ma première commande
            </button>
          )}
        </section>
      )}

      <div className="bn-list">
        {visible.map((order) => {
          const st = STATUS[order.status] || { label: order.status, tone: 'neutral' };
          return (
            <button key={order.id} className="bn-card bn-order" onClick={() => navigate(`/orders/${order.id}`)}>
              <span className="bn-order__head">
                <strong className="bn-order__ref">{order.order_number}</strong>
                <span className={`bn-pill bn-pill--${st.tone}`}>{st.label}</span>
              </span>
              <span className="bn-order__route">
                <span className="bn-route__dot bn-route__dot--from bn-route__dot--inline" />
                {order.pickup_address}
              </span>
              <span className="bn-order__route">
                <span className="bn-route__dot bn-route__dot--to bn-route__dot--inline" />
                {order.delivery_address}
              </span>
              <span className="bn-order__foot">
                <span className="bn-price">{Number(order.total_amount).toLocaleString('fr-FR')} FCFA</span>
                <span className="bn-subtitle">{new Date(order.created_at).toLocaleDateString('fr-FR')}</span>
              </span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
