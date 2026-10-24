import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import api from '../services/api';

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

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
  const weekly = (stats?.weekly || []).map((d) => ({
    jour: JOURS[new Date(`${d.day}T00:00:00`).getDay()],
    commandes: d.commandes,
    revenus: d.revenus,
  }));

  return (
    <div style={s.page}>
      {/* KPI Cards */}
      <div style={s.kpiGrid}>
        <KPICard
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>}
          label="Revenus plateforme"
          value={`${totalRevenue.toLocaleString()} FCFA`}
          sub="Commissions 10%"
          color="#FF6B00"
        />
        <KPICard
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20 7l-8-4-8 4v10l8 4 8-4V7zm-8 2.2L6.3 7 12 4.2 17.7 7 12 9.2z"/></svg>}
          label="Volume total (GMV)"
          value={`${totalGMV.toLocaleString()} FCFA`}
          sub="Total transactions"
          color="#3B82F6"
        />
        <KPICard
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>}
          label="Commandes terminées"
          value={stats?.orders?.completed || 0}
          sub={`${stats?.orders?.pending || 0} en attente`}
          color="#10B981"
        />
        <KPICard
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-2 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>}
          label="Chauffeurs actifs"
          value={stats?.drivers?.available || 0}
          sub={`/ ${stats?.drivers?.total || 0} inscrits`}
          color="#8B5CF6"
        />
        <KPICard
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>}
          label="Clients inscrits"
          value={stats?.clients?.total || 0}
          sub="Total comptes clients"
          color="#F59E0B"
        />
        <KPICard
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2V7h2v10zm4 0h-2v-4h2v4zm-8 0H6v-7h2v7z"/></svg>}
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
          <h3 style={s.chartTitle}>Revenus cette semaine</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weekly}>
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
          <h3 style={s.chartTitle}>Commandes par jour</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly}>
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
        <h3 style={s.chartTitle}>Commandes récentes</h3>
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
  awaiting_payment:          { label: 'À payer',        bg: '#EF444420', color: '#EF4444' },
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
