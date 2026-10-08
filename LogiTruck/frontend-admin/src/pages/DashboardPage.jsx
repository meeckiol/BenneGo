import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import api from '../services/api';

// Données simulées pour le graphique hebdomadaire
const MOCK_WEEKLY = [
  { jour: 'Lun', commandes: 8, revenus: 120000 },
  { jour: 'Mar', commandes: 12, revenus: 185000 },
  { jour: 'Mer', commandes: 10, revenus: 150000 },
  { jour: 'Jeu', commandes: 15, revenus: 225000 },
  { jour: 'Ven', commandes: 18, revenus: 270000 },
  { jour: 'Sam', commandes: 22, revenus: 330000 },
  { jour: 'Dim', commandes: 6, revenus: 90000 },
];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/orders?limit=8'),
    ]).then(([statsRes, ordersRes]) => {
      setStats(statsRes.data);
      setRecentOrders(ordersRes.data.orders);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={s.loading}>Chargement des statistiques...</div>;

  const totalRevenue = parseFloat(stats?.revenue?.total_revenue || 0);
  const totalGMV = parseFloat(stats?.revenue?.total_gmv || 0);

  return (
    <div style={s.page}>
      {/* KPI Cards */}
      <div style={s.kpiGrid}>
        <KPICard
          icon="💰"
          label="Revenus plateforme"
          value={`${totalRevenue.toLocaleString()} FCFA`}
          sub="Commissions 10%"
          color="#FF6B00"
        />
        <KPICard
          icon="📦"
          label="Volume total (GMV)"
          value={`${totalGMV.toLocaleString()} FCFA`}
          sub="Total transactions"
          color="#3B82F6"
        />
        <KPICard
          icon="✅"
          label="Commandes terminées"
          value={stats?.orders?.completed || 0}
          sub={`${stats?.orders?.pending || 0} en attente`}
          color="#10B981"
        />
        <KPICard
          icon="🚛"
          label="Chauffeurs actifs"
          value={stats?.drivers?.available || 0}
          sub={`/ ${stats?.drivers?.total || 0} inscrits`}
          color="#8B5CF6"
        />
        <KPICard
          icon="👥"
          label="Clients inscrits"
          value={stats?.clients?.total || 0}
          sub="Total comptes clients"
          color="#F59E0B"
        />
        <KPICard
          icon="📊"
          label="Taux de complétion"
          value={stats?.orders?.total > 0
            ? `${Math.round((stats.orders.completed / stats.orders.total) * 100)}%`
            : '—'}
          sub={`${stats?.orders?.cancelled || 0} annulations`}
          color="#EC4899"
        />
      </div>

      {/* Graphiques */}
      <div style={s.chartsRow}>
        {/* Revenus hebdomadaires */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>📈 Revenus cette semaine</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={MOCK_WEEKLY}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="jour" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f1f5f9' }}
                formatter={(v) => [`${v.toLocaleString()} FCFA`, 'Revenus']}
              />
              <Area type="monotone" dataKey="revenus"
                stroke="#FF6B00" fill="rgba(255,107,0,0.1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Commandes par jour */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>📦 Commandes par jour</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MOCK_WEEKLY}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="jour" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Bar dataKey="commandes" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Commandes récentes */}
      <div style={s.tableCard}>
        <h3 style={s.chartTitle}>🕐 Commandes récentes</h3>
        <table style={s.table}>
          <thead>
            <tr style={s.thead}>
              {['Numéro', 'Client', 'Destination', 'Montant', 'Statut', 'Date'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 && (
              <tr><td colSpan={6} style={s.emptyCell}>Aucune commande</td></tr>
            )}
            {recentOrders.map((order) => (
              <tr key={order.id} style={s.tr}>
                <td style={s.td}>{order.order_number}</td>
                <td style={s.td}>{order.client_name || '—'}</td>
                <td style={{ ...s.td, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {order.delivery_address}
                </td>
                <td style={{ ...s.td, color: '#FF6B00', fontWeight: '600' }}>
                  {parseFloat(order.total_amount || 0).toLocaleString()} FCFA
                </td>
                <td style={s.td}>
                  <StatusBadge status={order.status} />
                </td>
                <td style={{ ...s.td, color: '#64748b' }}>
                  {new Date(order.created_at).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, sub, color }) {
  return (
    <div style={s.kpiCard}>
      <div style={{ ...s.kpiIcon, background: `${color}20`, color }}>
        {icon}
      </div>
      <div style={s.kpiContent}>
        <div style={s.kpiValue}>{value}</div>
        <div style={s.kpiLabel}>{label}</div>
        <div style={s.kpiSub}>{sub}</div>
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  pending:                   { label: 'En attente',     bg: '#F59E0B20', color: '#F59E0B' },
  accepted:                  { label: 'Acceptée',       bg: '#3B82F620', color: '#3B82F6' },
  driver_en_route_pickup:    { label: 'En route',       bg: '#8B5CF620', color: '#8B5CF6' },
  loading:                   { label: 'Chargement',     bg: '#EC489920', color: '#EC4899' },
  driver_en_route_delivery:  { label: 'En livraison',   bg: '#6366F120', color: '#6366F1' },
  delivered:                 { label: 'Livré',          bg: '#10B98120', color: '#10B981' },
  validated:                 { label: 'Validé',         bg: '#10B98120', color: '#10B981' },
  completed:                 { label: 'Terminé',        bg: '#47556920', color: '#475569' },
  cancelled:                 { label: 'Annulé',         bg: '#EF444420', color: '#EF4444' },
};

function StatusBadge({ status }) {
  const st = STATUS_STYLES[status] || { label: status, bg: '#33415520', color: '#94a3b8' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
      background: st.bg, color: st.color,
    }}>
      {st.label}
    </span>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '24px' },
  loading: { color: '#94a3b8', padding: '40px', textAlign: 'center' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
  kpiCard: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  kpiIcon: { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 },
  kpiContent: {},
  kpiValue: { fontSize: '22px', fontWeight: '800', color: 'white' },
  kpiLabel: { fontSize: '13px', color: '#94a3b8', margin: '2px 0' },
  kpiSub: { fontSize: '11px', color: '#475569' },
  chartsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  chartCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' },
  chartTitle: { color: 'white', fontSize: '15px', fontWeight: '700', margin: '0 0 16px' },
  tableCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { borderBottom: '1px solid #334155' },
  th: { color: '#64748b', fontSize: '12px', fontWeight: '600', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #1e293b' },
  td: { padding: '12px', color: '#e2e8f0', fontSize: '13px' },
  emptyCell: { padding: '24px', textAlign: 'center', color: '#475569' },
};
