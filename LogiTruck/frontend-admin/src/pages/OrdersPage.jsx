import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const STATUSES = [
  { value: '', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'accepted', label: 'Acceptées' },
  { value: 'driver_en_route_delivery', label: 'En livraison' },
  { value: 'delivered', label: 'Livrées' },
  { value: 'validated', label: 'Validées' },
  { value: 'completed', label: 'Terminées' },
  { value: 'cancelled', label: 'Annulées' },
];

const STATUS_LABELS = {
  pending: { label: 'En attente', color: '#F59E0B' },
  accepted: { label: 'Acceptée', color: '#3B82F6' },
  driver_en_route_pickup: { label: 'En route carrière', color: '#8B5CF6' },
  loading: { label: 'Chargement', color: '#EC4899' },
  driver_en_route_delivery: { label: 'En livraison', color: '#6366F1' },
  delivered: { label: 'Livré', color: '#10B981' },
  validated: { label: 'Validé', color: '#10B981' },
  completed: { label: 'Terminé', color: '#475569' },
  cancelled: { label: 'Annulé', color: '#EF4444' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [releasing, setReleasing] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = filter ? `?status=${filter}` : '';
      const { data } = await api.get(`/admin/orders${params}`);
      setOrders(data.orders);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [filter]);

  const releaseFunds = async (orderId, orderNum) => {
    if (!window.confirm(`Libérer les fonds pour ${orderNum} ?`)) return;
    setReleasing(orderId);
    try {
      await api.post(`/payments/orders/${orderId}/release`);
      toast.success('Fonds libérés vers le chauffeur via KKiaPay ✅');
      loadOrders();
    } finally {
      setReleasing(null);
    }
  };

  const filtered = orders.filter((o) =>
    search === '' ||
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.driver_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={s.page}>
      {/* Filtres */}
      <div style={s.toolbar}>
        <input
          placeholder="🔍 Rechercher (numéro, client, chauffeur)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={s.searchInput}
        />
        <div style={s.statusFilters}>
          {STATUSES.map((st) => (
            <button
              key={st.value}
              onClick={() => setFilter(st.value)}
              style={{
                ...s.filterBtn,
                background: filter === st.value ? '#FF6B00' : 'transparent',
                color: filter === st.value ? 'white' : '#94a3b8',
                borderColor: filter === st.value ? '#FF6B00' : '#334155',
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div style={s.tableCard}>
        <div style={s.tableHeader}>
          <span style={s.tableTitle}>
            {loading ? 'Chargement...' : `${filtered.length} commande(s)`}
          </span>
          <button onClick={loadOrders} style={s.refreshBtn}>🔄 Actualiser</button>
        </div>

        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['Numéro', 'Client', 'Chauffeur', 'De → Vers', 'Montant', 'Commission', 'Paiement', 'Statut', 'Actions'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const st = STATUS_LABELS[order.status] || { label: order.status, color: '#94a3b8' };
                const canRelease = order.status === 'validated' && order.payment_status === 'escrow_held';
                return (
                  <tr key={order.id} style={s.tr}>
                    <td style={{ ...s.td, fontWeight: '600', color: '#FF6B00' }}>
                      {order.order_number}
                    </td>
                    <td style={s.td}>{order.client_name || '—'}</td>
                    <td style={s.td}>{order.driver_name || <span style={s.noDriver}>Non assigné</span>}</td>
                    <td style={{ ...s.td, maxWidth: '200px' }}>
                      <div style={s.addresses}>
                        <span style={s.addrFrom}>📍 {order.pickup_address?.slice(0, 25)}...</span>
                        <span style={s.addrTo}>🏗️ {order.delivery_address?.slice(0, 25)}...</span>
                      </div>
                    </td>
                    <td style={{ ...s.td, fontWeight: '700', color: 'white' }}>
                      {parseFloat(order.total_amount || 0).toLocaleString()}
                    </td>
                    <td style={{ ...s.td, color: '#10B981' }}>
                      {parseFloat(order.commission_amount || 0).toLocaleString()}
                    </td>
                    <td style={s.td}>
                      <PaymentBadge status={order.payment_status} />
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, color: st.color, background: `${st.color}20` }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={s.td}>
                      {canRelease && (
                        <button
                          onClick={() => releaseFunds(order.id, order.order_number)}
                          disabled={releasing === order.id}
                          style={s.releaseBtn}
                        >
                          {releasing === order.id ? '⏳' : '💸 Libérer'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={s.empty}>Aucune commande trouvée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const PAYMENT_STYLES = {
  unpaid:       { label: '⏳ Non payé',   color: '#F59E0B' },
  escrow_held:  { label: '🔒 Escrow',     color: '#3B82F6' },
  released:     { label: '✅ Libéré',     color: '#10B981' },
  refunded:     { label: '↩ Remboursé',  color: '#EF4444' },
};

function PaymentBadge({ status }) {
  const p = PAYMENT_STYLES[status] || { label: status, color: '#94a3b8' };
  return <span style={{ color: p.color, fontSize: '12px', fontWeight: '600' }}>{p.label}</span>;
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  toolbar: { display: 'flex', flexDirection: 'column', gap: '12px' },
  searchInput: { padding: '10px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', width: '100%', maxWidth: '400px' },
  statusFilters: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  filterBtn: { padding: '6px 12px', border: '1px solid', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  tableCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tableTitle: { color: '#94a3b8', fontSize: '14px' },
  refreshBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  tableWrapper: { overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  thead: { background: '#0f172a' },
  th: { padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #0f172a', transition: 'background 0.1s' },
  td: { padding: '12px', color: '#cbd5e1', fontSize: '13px', verticalAlign: 'middle' },
  addresses: { display: 'flex', flexDirection: 'column', gap: '2px' },
  addrFrom: { fontSize: '11px', color: '#94a3b8' },
  addrTo: { fontSize: '11px', color: '#94a3b8' },
  noDriver: { color: '#475569', fontStyle: 'italic' },
  badge: { padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' },
  releaseBtn: { padding: '5px 10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  empty: { padding: '32px', textAlign: 'center', color: '#475569' },
};
