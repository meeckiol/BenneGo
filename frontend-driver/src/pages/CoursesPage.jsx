import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import api from '../services/api';
import useDriverAuthStore from '../store/authStore';
import { DeliveryCard, Glyph, STATUS, describe } from '../../../frontend-client/src/components/delivery';
import { fcfa } from '../utils/format';
import '../styles/driver.css';

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'active', label: 'En cours' },
  { key: 'done', label: 'Terminées' },
];

const groupOf = (order) => (STATUS[order.status]?.group === 'done' ? 'done' : 'active');

const payLabel = (o) => {
  if (o.status === 'cancelled') return 'Annulée';
  if (o.payment_status === 'released') return 'Versé';
  if (['validated', 'completed'].includes(o.status)) return 'Versement en cours';
  if (o.status === 'delivered') return 'Attente confirmation client';
  return 'Votre part';
};

/** Section « Courses » du camionneur (comme « Commandes » côté client) : recherche, filtres et cartes. */
export default function CoursesPage() {
  const user = useDriverAuthStore((s) => s.user);
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/orders?limit=100')
      .then(({ data }) => setOrders((data.orders || []).filter((o) => o.driver_id === user?.id)))
      .catch(() => setOrders([]));
  }, [user?.id]);

  const sorted = useMemo(() => {
    const rank = (o) => (groupOf(o) === 'done' ? 1 : 0);
    return [...(orders || [])].sort((a, b) => rank(a) - rank(b) || new Date(b.created_at) - new Date(a.created_at));
  }, [orders]);

  const counts = useMemo(() => {
    const c = { all: sorted.length, active: 0, done: 0 };
    sorted.forEach((o) => { c[groupOf(o)] += 1; });
    return c;
  }, [sorted]);

  const earned = sorted
    .filter((o) => ['delivered', 'validated', 'completed'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.driver_amount || 0), 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted
      .filter((o) => filter === 'all' || groupOf(o) === filter)
      .filter((o) => !q || [o.order_number, o.pickup_address, o.delivery_address, describe(o)].some((v) => (v || '').toLowerCase().includes(q)));
  }, [sorted, filter, query]);

  return (
    <main className="bn-page bn-home">
      <header className="bn-home__head">
        <p className="bn-home__kicker">{counts.done} course(s) terminée(s) · {fcfa(earned)} gagnés</p>
        <h1 className="bn-home__title">Mes courses</h1>
      </header>

      <section className="bn-deliveries" aria-label="Mes courses">
        <label className="bn-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une course"
            aria-label="Rechercher une course"
          />
        </label>

        <div className="bn-filters" role="tablist" aria-label="Filtrer les courses">
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
          </div>
        ) : visible.length > 0 ? (
          <div className="bn-dcards" key={`${filter}-${query}`}>
            {visible.map((o, i) => (
              <DeliveryCard
                key={o.id}
                order={o}
                index={i}
                to={`/order/${o.id}`}
                extra={(
                  <div className="bn-dcard__pay">
                    <span>{payLabel(o)}</span>
                    <strong>{fcfa(o.driver_amount)}</strong>
                  </div>
                )}
              />
            ))}
          </div>
        ) : (
          <div className="bn-empty">
            <Glyph kind="sand" size={44} />
            <strong>{orders.length === 0 ? 'Aucune course pour le moment' : 'Aucune course dans ce filtre'}</strong>
            {orders.length === 0 && <span>Passez en ligne depuis l'accueil pour recevoir vos premières courses.</span>}
          </div>
        )}
      </section>
    </main>
  );
}
