import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Banknote, ChartColumn, Lock, Wallet } from 'lucide-react';
import { dateLocale } from '../../../shared/i18n/dom';

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
        <PayKPI label="Volume total (GMV)" value={Number(stats?.total_gmv || 0)} color="#D9A55B" icon={<ChartColumn size={22} aria-hidden="true" />}
          sub="Commandes payées" />
        <PayKPI label="Commissions BenneGo" value={Number(stats?.total_revenue || 0)} color="#10B981" icon={<Banknote size={22} aria-hidden="true" />}
          sub="10 % prélevés après confirmation client" />
        <PayKPI label="En séquestre (bloqué)" value={Number(stats?.escrow_balance || 0)} color="#3B82F6" icon={<Lock size={22} aria-hidden="true" />}
          sub="En attente de confirmation de réception" />
        <PayKPI label="À reverser aux chauffeurs" value={Number(stats?.payouts_due || 0)} color="#8B5CF6" icon={<Wallet size={22} aria-hidden="true" />}
          sub="Confirmé par le client, pas encore versé" />
      </div>

      {/* Reversements à effectuer */}
      <div style={s.tableCard}>
        <div style={s.tableHeader}>
          <h3 style={s.tableTitle}>{`Reversements chauffeurs à effectuer (${payouts.length})`}</h3>
        </div>
        <div style={s.tableWrapper} tabIndex={0}>
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
                  <td style={{ ...s.td, color: 'var(--brand-ink)', fontWeight: '600' }}>{p.order_number}</td>
                  <td style={s.td}>{p.driver_name}</td>
                  <td style={s.td}>{p.momo_number || '—'} {p.momo_provider ? `(${p.momo_provider.toUpperCase()})` : ''}</td>
                  <td style={{ ...s.td, color: 'var(--violet)', fontWeight: '700' }}>{fcfa(p.driver_amount)}</td>
                  <td style={{ ...s.td, color: 'var(--success)' }}>{fcfa(p.commission_amount)}</td>
                  <td style={{ ...s.td, color: 'var(--text-2)' }}>{p.validated_at ? new Date(p.validated_at).toLocaleString(dateLocale()) : '—'}</td>
                  <td style={s.td}>
                    <button disabled={busyId === p.order_id} onClick={() => markPaid(p)} style={s.actionBtn}>
                      Marquer payé
                    </button>
                    {p.payout_status === 'failed' && (
                      <button disabled={busyId === p.order_id} onClick={() => retry(p)} style={{ ...s.actionBtn, background: 'var(--surface-3)', marginLeft: 8 }}>
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
        <div style={s.tableWrapper} tabIndex={0}>
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
                  <td style={{ ...s.td, color: 'var(--brand-ink)', fontWeight: '600' }}>
                    {order.order_number}
                  </td>
                  <td style={s.td}>{order.client_name || '—'}</td>
                  <td style={{ ...s.td, fontWeight: '700', color: 'var(--text-strong)' }}>
                    {parseFloat(order.total_amount || 0).toLocaleString()}
                  </td>
                  <td style={{ ...s.td, color: 'var(--success)', fontWeight: '600' }}>
                    {parseFloat(order.commission_amount || 0).toLocaleString()}
                  </td>
                  <td style={{ ...s.td, color: 'var(--violet)', fontWeight: '600' }}>
                    {parseFloat(order.driver_amount || 0).toLocaleString()}
                  </td>
                  <td style={s.td}>
                    {order.payment_method === 'mtn_momo'
                      ? 'MTN MoMo'
                      : order.payment_method === 'moov_money'
                        ? 'Moov Money'
                        : '—'}
                  </td>
                  <td style={{ ...s.td, color: 'var(--text-2)', fontSize: '11px' }}>
                    {order.payment_reference ? order.payment_reference.slice(0, 16) + '...' : '—'}
                  </td>
                  <td style={s.td}>
                    <PayBadge status={order.payment_status} />
                  </td>
                  <td style={{ ...s.td, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {order.payment_at
                      ? new Date(order.payment_at).toLocaleDateString(dateLocale())
                      : new Date(order.created_at).toLocaleDateString(dateLocale())}
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
          {value.toLocaleString('fr-FR')} <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>FCFA</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>{label}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{sub}</div>
      </div>
    </div>
  );
}

const PAY_STYLE = {
  escrow_held: { label: 'Séquestre', color: 'var(--info)' },
  payout_pending: { label: 'À reverser', color: 'var(--warning)' },
  released:    { label: 'Versé', color: 'var(--success)' },
  refunded:    { label: 'Remboursé', color: 'var(--danger)' },
};

function PayBadge({ status }) {
  const p = PAY_STYLE[status] || { label: status, color: 'var(--text-3)' };
  return <span style={{ color: p.color, fontSize: '12px', fontWeight: '600' }}>{p.label}</span>;
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '24px' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
  kpiCard: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '12px', padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' },
  kpiIcon: { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 },
  tableCard: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '12px', overflow: 'hidden' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid var(--border-2)' },
  tableTitle: { color: 'var(--text-strong)', fontSize: '15px', fontWeight: '700', margin: 0 },
  tableWrapper: { overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  thead: { background: 'var(--bg)' },
  th: { padding: '10px 12px', color: 'var(--text-2)', fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '12px', color: 'var(--text-2)', fontSize: '13px', verticalAlign: 'middle' },
  actionBtn: { background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' },
  empty: { padding: '32px', textAlign: 'center', color: 'var(--text-2)' },
};
