import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function PaymentsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ gmv: 0, commission: 0, escrow: 0, released: 0 });

  useEffect(() => {
    api.get('/admin/orders?limit=100').then(({ data }) => {
      const os = data.orders;
      setOrders(os);
      setTotals({
        gmv: os.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0),
        commission: os
          .filter((o) => ['released', 'validated', 'completed'].includes(o.payment_status))
          .reduce((s, o) => s + parseFloat(o.commission_amount || 0), 0),
        escrow: os
          .filter((o) => o.payment_status === 'escrow_held')
          .reduce((s, o) => s + parseFloat(o.total_amount || 0), 0),
        released: os
          .filter((o) => o.payment_status === 'released')
          .reduce((s, o) => s + parseFloat(o.driver_amount || 0), 0),
      });
      setLoading(false);
    });
  }, []);

  return (
    <div style={s.page}>
      {/* KPI paiements */}
      <div style={s.kpiGrid}>
        <PayKPI label="Volume total (GMV)" value={totals.gmv} color="#FF6B00" icon="📊"
          sub="Toutes transactions" />
        <PayKPI label="Commissions LogiTruck" value={totals.commission} color="#10B981" icon="💰"
          sub="10% réalisés" />
        <PayKPI label="En escrow (bloqué)" value={totals.escrow} color="#3B82F6" icon="🔒"
          sub="En attente validation" />
        <PayKPI label="Versé aux chauffeurs" value={totals.released} color="#8B5CF6" icon="🚛"
          sub="Libéré via KKiaPay" />
      </div>

      {/* Tableau des paiements */}
      <div style={s.tableCard}>
        <div style={s.tableHeader}>
          <h3 style={s.tableTitle}>💳 Historique des paiements</h3>
        </div>
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['Commande', 'Client', 'Total FCFA', 'Commission', 'Chauffeur', 'Méthode', 'Réf. KKiaPay', 'Statut paiement', 'Date'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={s.empty}>Chargement...</td></tr>}
              {orders.filter((o) => o.payment_status !== 'unpaid').map((order) => (
                <tr key={order.id} style={s.tr}>
                  <td style={{ ...s.td, color: '#FF6B00', fontWeight: '600' }}>
                    {order.order_number}
                  </td>
                  <td style={s.td}>{order.client_name || '—'}</td>
                  <td style={{ ...s.td, fontWeight: '700', color: 'white' }}>
                    {parseFloat(order.total_amount || 0).toLocaleString()}
                  </td>
                  <td style={{ ...s.td, color: '#10B981', fontWeight: '600' }}>
                    {parseFloat(order.commission_amount || 0).toLocaleString()}
                  </td>
                  <td style={{ ...s.td, color: '#8B5CF6', fontWeight: '600' }}>
                    {parseFloat(order.driver_amount || 0).toLocaleString()}
                  </td>
                  <td style={s.td}>
                    {order.payment_method === 'mtn_momo'
                      ? '🟡 MTN MoMo'
                      : order.payment_method === 'moov_money'
                        ? '🔵 Moov Money'
                        : '—'}
                  </td>
                  <td style={{ ...s.td, color: '#64748b', fontSize: '11px' }}>
                    {order.payment_reference ? order.payment_reference.slice(0, 16) + '...' : '—'}
                  </td>
                  <td style={s.td}>
                    <PayBadge status={order.payment_status} />
                  </td>
                  <td style={{ ...s.td, color: '#64748b', whiteSpace: 'nowrap' }}>
                    {order.payment_at
                      ? new Date(order.payment_at).toLocaleDateString('fr-FR')
                      : new Date(order.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
              {!loading && orders.filter((o) => o.payment_status !== 'unpaid').length === 0 && (
                <tr><td colSpan={9} style={s.empty}>Aucun paiement enregistré</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PayKPI({ label, value, color, icon, sub }) {
  return (
    <div style={s.kpiCard}>
      <div style={{ ...s.kpiIcon, background: `${color}15`, color }}>{icon}</div>
      <div>
        <div style={{ fontSize: '20px', fontWeight: '800', color }}>
          {value.toLocaleString()} <span style={{ fontSize: '12px', color: '#64748b' }}>FCFA</span>
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>{label}</div>
        <div style={{ fontSize: '11px', color: '#475569' }}>{sub}</div>
      </div>
    </div>
  );
}

const PAY_STYLE = {
  escrow_held: { label: '🔒 Escrow', color: '#3B82F6' },
  released:    { label: '✅ Libéré', color: '#10B981' },
  refunded:    { label: '↩ Remboursé', color: '#EF4444' },
};

function PayBadge({ status }) {
  const p = PAY_STYLE[status] || { label: status, color: '#94a3b8' };
  return <span style={{ color: p.color, fontSize: '12px', fontWeight: '600' }}>{p.label}</span>;
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '24px' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
  kpiCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' },
  kpiIcon: { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 },
  tableCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid #334155' },
  tableTitle: { color: 'white', fontSize: '15px', fontWeight: '700', margin: 0 },
  tableWrapper: { overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  thead: { background: '#0f172a' },
  th: { padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #0f172a' },
  td: { padding: '12px', color: '#cbd5e1', fontSize: '13px', verticalAlign: 'middle' },
  empty: { padding: '32px', textAlign: 'center', color: '#475569' },
};
