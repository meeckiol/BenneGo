import React, { useEffect, useState } from 'react';
import api from '../services/api';

const fcfa = (n) => Number(n || 0).toLocaleString('fr-FR');

export default function PaymentsPage() {
  const [orders, setOrders] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const [o, p, st] = await Promise.all([
      api.get('/admin/orders?limit=100'),
      api.get('/admin/payouts'),
      api.get('/admin/stats'),
    ]);
    setOrders(o.data.orders);
    setPayouts(p.data.payouts);
    setStats(st.data.revenue);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Reversement manuel : l'admin envoie l'argent en Mobile Money, puis enregistre la référence
  const markPaid = async (payout) => {
    const reference = window.prompt(
      `Référence du transfert Mobile Money de ${fcfa(payout.driver_amount)} FCFA vers ${payout.driver_name} (${payout.momo_number}) :`
    );
    if (!reference || !reference.trim()) return;
    setBusyId(payout.order_id);
    try {
      await api.post(`/payments/orders/${payout.order_id}/mark-paid`, { reference: reference.trim() });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const retry = async (payout) => {
    setBusyId(payout.order_id);
    try {
      await api.post(`/payments/orders/${payout.order_id}/retry-payout`);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={s.page}>
      {/* KPI paiements */}
      <div style={s.kpiGrid}>
        <PayKPI label="Volume total (GMV)" value={Number(stats?.total_gmv || 0)} color="#FF6B00" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2V7h2v10zm4 0h-2v-4h2v4zm-8 0H6v-7h2v7z"/></svg>}
          sub="Commandes payées" />
        <PayKPI label="Commissions BenneGo" value={Number(stats?.total_revenue || 0)} color="#10B981" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>}
          sub="10 % prélevés après confirmation client" />
        <PayKPI label="En séquestre (bloqué)" value={Number(stats?.escrow_balance || 0)} color="#3B82F6" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>}
          sub="En attente de confirmation de réception" />
        <PayKPI label="À reverser aux chauffeurs" value={Number(stats?.payouts_due || 0)} color="#8B5CF6" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/></svg>}
          sub="Confirmé par le client, pas encore versé" />
      </div>

      {/* Reversements à effectuer */}
      <div style={s.tableCard}>
        <div style={s.tableHeader}>
          <h3 style={s.tableTitle}>Reversements chauffeurs à effectuer ({payouts.length})</h3>
        </div>
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['Commande', 'Chauffeur', 'Mobile Money', 'À verser (90 %)', 'Commission (10 %)', 'Confirmé le', 'Action'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.order_id} style={s.tr}>
                  <td style={{ ...s.td, color: '#FF6B00', fontWeight: '600' }}>{p.order_number}</td>
                  <td style={s.td}>{p.driver_name}</td>
                  <td style={s.td}>{p.momo_number || '—'} {p.momo_provider ? `(${p.momo_provider.toUpperCase()})` : ''}</td>
                  <td style={{ ...s.td, color: '#8B5CF6', fontWeight: '700' }}>{fcfa(p.driver_amount)}</td>
                  <td style={{ ...s.td, color: '#10B981' }}>{fcfa(p.commission_amount)}</td>
                  <td style={{ ...s.td, color: '#64748b' }}>{p.validated_at ? new Date(p.validated_at).toLocaleString('fr-FR') : '—'}</td>
                  <td style={s.td}>
                    <button disabled={busyId === p.order_id} onClick={() => markPaid(p)} style={s.actionBtn}>
                      Marquer payé
                    </button>
                    {p.payout_status === 'failed' && (
                      <button disabled={busyId === p.order_id} onClick={() => retry(p)} style={{ ...s.actionBtn, background: '#334155', marginLeft: 8 }}>
                        Relancer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && payouts.length === 0 && (
                <tr><td colSpan={7} style={s.empty}>Aucun reversement en attente</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tableau des paiements */}
      <div style={s.tableCard}>
        <div style={s.tableHeader}>
          <h3 style={s.tableTitle}>Historique des paiements</h3>
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
                      ? 'MTN MoMo'
                      : order.payment_method === 'moov_money'
                        ? 'Moov Money'
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
          {value.toLocaleString('fr-FR')} <span style={{ fontSize: '12px', color: '#64748b' }}>FCFA</span>
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>{label}</div>
        <div style={{ fontSize: '11px', color: '#475569' }}>{sub}</div>
      </div>
    </div>
  );
}

const PAY_STYLE = {
  escrow_held: { label: 'Séquestre', color: '#3B82F6' },
  payout_pending: { label: 'À reverser', color: '#F59E0B' },
  released:    { label: 'Versé', color: '#10B981' },
  refunded:    { label: 'Remboursé', color: '#EF4444' },
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
  actionBtn: { background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' },
  empty: { padding: '32px', textAlign: 'center', color: '#475569' },
};
