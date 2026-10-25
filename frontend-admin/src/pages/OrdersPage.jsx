import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { X } from 'lucide-react';

const STATUSES = [
  { value: '', label: 'Toutes' },
  { value: 'awaiting_payment', label: 'À payer' },
  { value: 'pending', label: 'Payée · en attente' },
  { value: 'accepted', label: 'Acceptées' },
  { value: 'driver_en_route_delivery', label: 'En livraison' },
  { value: 'delivered', label: 'Livrées' },
  { value: 'validated', label: 'Validées' },
  { value: 'completed', label: 'Terminées' },
  { value: 'cancelled', label: 'Annulées' },
];

const STATUS_LABELS = {
  awaiting_payment: { label: 'À payer', color: 'var(--danger)' },
  pending: { label: 'Payée · en attente', color: 'var(--warning)' },
  accepted: { label: 'Acceptée', color: 'var(--info)' },
  driver_en_route_pickup: { label: 'En route carrière', color: 'var(--violet)' },
  loading: { label: 'Chargement', color: '#F472B6' },
  driver_en_route_delivery: { label: 'En livraison', color: 'var(--violet)' },
  delivered: { label: 'Livré', color: 'var(--success)' },
  validated: { label: 'Validé', color: 'var(--success)' },
  completed: { label: 'Terminé', color: 'var(--text-2)' },
  cancelled: { label: 'Annulé', color: 'var(--danger)' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [releasing, setReleasing] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
      toast.success('Fonds libérés vers le chauffeur via KKiaPay');
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
          placeholder="Rechercher (numéro, client, chauffeur)..."
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
                color: filter === st.value ? '#0b0b10' : '#94a3b8',
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
          <button onClick={loadOrders} style={s.refreshBtn}>Actualiser</button>
        </div>

        <div style={s.tableWrapper} tabIndex={0}>
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
                const st = STATUS_LABELS[order.status] || { label: order.status, color: 'var(--text-3)' };
                const canRelease = order.status === 'validated' && order.payment_status === 'escrow_held';
                return (
                  <tr key={order.id} style={s.tr}>
                    <td
                      style={{ ...s.td, fontWeight: '600', color: '#FF6B00', cursor: 'pointer' }}
                      onClick={() => setSelectedOrder(order)}
                      title="Cliquer pour voir les détails et photos PoD"
                    >
                      {order.order_number}
                    </td>
                    <td style={s.td}>{order.client_name || '—'}</td>
                    <td style={s.td}>{order.driver_name || <span style={s.noDriver}>Non assigné</span>}</td>
                    <td style={{ ...s.td, maxWidth: '200px' }}>
                      <div style={s.addresses}>
                        <span style={s.addrFrom}>{order.pickup_address?.slice(0, 25)}...</span>
                        <span style={s.addrTo}>{order.delivery_address?.slice(0, 25)}...</span>
                      </div>
                    </td>
                    <td style={{ ...s.td, fontWeight: '700', color: 'white' }}>
                      {parseFloat(order.total_amount || 0).toLocaleString()}
                    </td>
                    <td style={{ ...s.td, color: 'var(--success)' }}>
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
                    <td style={{ ...s.td, display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        onClick={() => setSelectedOrder(order)}
                        style={s.detailBtn}
                        title="Voir photos PoD"
                      >
                        PoD
                      </button>
                      {canRelease && (
                        <button
                          onClick={() => releaseFunds(order.id, order.order_number)}
                          disabled={releasing === order.id}
                          style={s.releaseBtn}
                        >
                          {releasing === order.id ? 'Traitement...' : 'Libérer'}
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

      {/* Modal Détails & PoD */}
      {selectedOrder && (
        <div style={s.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Détail commande {selectedOrder.order_number}</h3>
              <button onClick={() => setSelectedOrder(null)} style={s.modalCloseBtn}><X size={18} aria-hidden="true" /></button>
            </div>

            <div style={s.modalBody}>
              <div style={s.detailGrid}>
                <div><span style={s.detailLabel}>Client :</span> <strong>{selectedOrder.client_name || '—'}</strong></div>
                <div><span style={s.detailLabel}>Chauffeur :</span> <strong>{selectedOrder.driver_name || 'Non assigné'}</strong></div>
                <div><span style={s.detailLabel}>Montant total :</span> <strong style={{ color: '#FF6B00' }}>{Number(selectedOrder.total_amount || 0).toLocaleString()} FCFA</strong></div>
                <div><span style={s.detailLabel}>Statut :</span> <strong>{selectedOrder.status}</strong></div>
              </div>

              <div style={s.podBox}>
                <h4 style={s.podTitle}>Preuves de Livraison (PoD)</h4>
                {selectedOrder.pod_submitted_at && (
                  <p style={s.podMeta}>
                    Soumis le : {new Date(selectedOrder.pod_submitted_at).toLocaleString('fr-FR')}
                  </p>
                )}
                {selectedOrder.pod_notes && (
                  <div style={s.podNotes}>
                    <strong>Note du chauffeur :</strong> {selectedOrder.pod_notes}
                  </div>
                )}
                {Array.isArray(selectedOrder.pod_photos) && selectedOrder.pod_photos.length > 0 ? (
                  <div style={s.podGrid}>
                    {selectedOrder.pod_photos.map((photo, i) => (
                      <a key={i} href={photo} target="_blank" rel="noreferrer">
                        <img src={photo} alt={`Preuve ${i + 1}`} style={s.podImg} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div style={s.noPod}>Aucune photo de preuve de livraison fournie.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PAYMENT_STYLES = {
  unpaid:       { label: 'Non payé',   color: 'var(--warning)' },
  escrow_held:  { label: 'Escrow',     color: 'var(--info)' },
  released:     { label: 'Libéré',     color: 'var(--success)' },
  refunded:     { label: 'Remboursé',  color: 'var(--danger)' },
};

function PaymentBadge({ status }) {
  const p = PAYMENT_STYLES[status] || { label: status, color: 'var(--text-3)' };
  return <span style={{ color: p.color, fontSize: '12px', fontWeight: '600' }}>{p.label}</span>;
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  toolbar: { display: 'flex', flexDirection: 'column', gap: '12px' },
  searchInput: { padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', width: '100%', maxWidth: '400px' },
  statusFilters: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  filterBtn: { padding: '6px 12px', border: '1px solid', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  tableCard: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '12px', overflow: 'hidden' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid var(--border-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tableTitle: { color: 'var(--text-3)', fontSize: '14px' },
  refreshBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  tableWrapper: { overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  thead: { background: 'var(--bg)' },
  th: { padding: '10px 12px', color: 'var(--text-2)', fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #0f172a', transition: 'background 0.1s' },
  td: { padding: '12px', color: 'var(--text-2)', fontSize: '13px', verticalAlign: 'middle' },
  addresses: { display: 'flex', flexDirection: 'column', gap: '2px' },
  addrFrom: { fontSize: '11px', color: 'var(--text-3)' },
  addrTo: { fontSize: '11px', color: 'var(--text-3)' },
  noDriver: { color: 'var(--text-2)', fontStyle: 'italic' },
  badge: { padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' },
  detailBtn: { padding: '5px 10px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--info)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  releaseBtn: { padding: '5px 10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  empty: { padding: '32px', textAlign: 'center', color: 'var(--text-2)' },

  // Modal styles
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modalCard: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid var(--border-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, color: 'white', fontSize: '16px', fontWeight: '700' },
  modalCloseBtn: { background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '18px', cursor: 'pointer' },
  modalBody: { padding: '20px' },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '13px', color: 'var(--text-2)' },
  detailLabel: { color: 'var(--text-3)' },
  podBox: { background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: '12px', padding: '16px' },
  podTitle: { margin: '0 0 10px', color: 'white', fontSize: '14px', fontWeight: '700' },
  podMeta: { color: 'var(--text-2)', fontSize: '12px', margin: '0 0 8px' },
  podNotes: { background: 'var(--surface)', padding: '10px', borderRadius: '8px', color: 'var(--text-2)', fontSize: '13px', marginBottom: '12px' },
  podGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' },
  podImg: { width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-2)', cursor: 'pointer' },
  noPod: { color: 'var(--text-2)', fontSize: '13px', fontStyle: 'italic', padding: '12px 0' },
};
