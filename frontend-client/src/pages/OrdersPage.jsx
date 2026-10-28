import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import api from '../services/api';
import { DeliveryCard, Glyph, STATUS, describe } from '../components/delivery';

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'active', label: 'En cours' },
  { key: 'pay', label: 'À payer' },
  { key: 'done', label: 'Terminées' },
];

const groupOf = (order) => STATUS[order.status]?.group || 'done';

/** Section « Commandes » (design A) : recherche, filtres à compteurs et cartes de livraison. */
export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/orders').then(({ data }) => setOrders(data.orders || [])).catch(() => setOrders([]));
  }, []);

  // Commandes en cours d'abord, puis les plus récentes
  const sorted = useMemo(() => {
    const rank = (o) => (groupOf(o) === 'done' ? 1 : 0);
    return [...(orders || [])].sort((a, b) => rank(a) - rank(b) || new Date(b.created_at) - new Date(a.created_at));
  }, [orders]);

  const counts = useMemo(() => {
    const c = { all: sorted.length, active: 0, pay: 0, done: 0 };
    sorted.forEach((o) => { c[groupOf(o)] += 1; });
    return c;
  }, [sorted]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted
      .filter((o) => filter === 'all' || groupOf(o) === filter)
      .filter((o) => !q || [o.order_number, o.pickup_address, o.delivery_address, describe(o)].some((v) => (v || '').toLowerCase().includes(q)));
  }, [sorted, filter, query]);

  return (
    <main className="bn-page bn-home">
      <header className="bn-home__head">
        <p className="bn-home__kicker">Vos courses</p>
        <h1 className="bn-home__title">Mes commandes</h1>
      </header>

      <section className="bn-deliveries" aria-label="Mes commandes">
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

        <div className="bn-filters" role="tablist" aria-label="Filtrer les commandes">
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
              Recherche de vos commandes…
            </div>
          </div>
        ) : visible.length > 0 ? (
          <div className="bn-dcards" key={`${filter}-${query}`}>
            {visible.map((o, i) => <DeliveryCard key={o.id} order={o} index={i} />)}
          </div>
        ) : (
          <div className="bn-empty">
            <Glyph kind="sand" size={44} />
            <strong>{orders.length === 0 ? 'Aucune commande pour le moment' : 'Aucune commande dans ce filtre'}</strong>
            {orders.length === 0 && (
              <button type="button" className="bn-btn bn-btn--primary" onClick={() => navigate('/orders/new')}>Nouvelle commande</button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
