import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import api from '../services/api';
import { Banknote, ChartColumn, CheckCircle2, IdCard, Package, Users } from 'lucide-react';

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
          icon={<Banknote size={22} aria-hidden="true" />}
          label="Revenus plateforme"
          value={`${totalRevenue.toLocaleString()} FCFA`}
          sub="Commissions 10%"
          color="#F6A906"
        />
        <KPICard
          icon={<Package size={22} aria-hidden="true" />}
          label="Volume total (GMV)"
          value={`${totalGMV.toLocaleString()} FCFA`}
          sub="Total transactions"
          color="#3B82F6"
        />
        <KPICard
          icon={<CheckCircle2 size={22} aria-hidden="true" />}
          label="Commandes terminées"
          value={stats?.orders?.completed || 0}
          sub={`${stats?.orders?.pending || 0} en attente`}
          color="#10B981"
        />
        <KPICard
          icon={<IdCard size={22} aria-hidden="true" />}
          label="Chauffeurs actifs"
          value={stats?.drivers?.available || 0}
          sub={`/ ${stats?.drivers?.total || 0} inscrits`}
          color="#8B5CF6"
        />
        <KPICard
          icon={<Users size={22} aria-hidden="true" />}
          label="Clients inscrits"
          value={stats?.clients?.total || 0}
          sub="Total comptes clients"
          color="#F59E0B"
        />
        <KPICard
          icon={<ChartColumn size={22} aria-hidden="true" />}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A36" />
              <XAxis dataKey="jour" stroke="#8C8CA0" fontSize={12} />
              <YAxis stroke="#8C8CA0" fontSize={12}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '8px' }}
                labelStyle={{ color: 'var(--text-strong)' }}
                formatter={(v) => [`${v.toLocaleString()} FCFA`, 'Revenus']}
              />
              <Area type="monotone" dataKey="revenus"
                stroke="#F6A906" fill="rgba(246, 169, 6,0.1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Commandes par jour */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>Commandes par jour</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A36" />
              <XAxis dataKey="jour" stroke="#8C8CA0" fontSize={12} />
              <YAxis stroke="#8C8CA0" fontSize={12} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '8px' }}
                labelStyle={{ color: 'var(--text-strong)' }}
              />
              <Bar dataKey="commandes" fill="#60A5FA" radius={[4, 4, 0, 0]} />
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
                <td style={{ ...s.td, color: 'var(--brand-ink)', fontWeight: '600' }}>
                  {parseFloat(order.total_amount || 0).toLocaleString()} FCFA
                </td>
                <td style={s.td}>
                  <StatusBadge status={order.status} />
                </td>
                <td style={{ ...s.td, color: 'var(--text-2)' }}>
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
  awaiting_payment:          { label: 'À payer',        bg: '#EF444420', color: 'var(--danger)' },
  pending:                   { label: 'En attente',     bg: '#F59E0B20', color: 'var(--warning)' },
  accepted:                  { label: 'Acceptée',       bg: '#3B82F620', color: 'var(--info)' },
  driver_en_route_pickup:    { label: 'En route',       bg: '#8B5CF620', color: 'var(--violet)' },
  loading:                   { label: 'Chargement',     bg: '#EC489920', color: '#F472B6' },
  driver_en_route_delivery:  { label: 'En livraison',   bg: '#6366F120', color: 'var(--violet)' },
  delivered:                 { label: 'Livré',          bg: '#10B98120', color: 'var(--success)' },
  validated:                 { label: 'Validé',         bg: '#10B98120', color: 'var(--success)' },
  completed:                 { label: 'Terminé',        bg: '#47556920', color: 'var(--text-2)' },
  cancelled:                 { label: 'Annulé',         bg: '#EF444420', color: 'var(--danger)' },
};

function StatusBadge({ status }) {
  const st = STATUS_STYLES[status] || { label: status, bg: '#33415520', color: 'var(--text-3)' };
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
  loading: { color: 'var(--text-3)', padding: '40px', textAlign: 'center' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
  kpiCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border-2)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  kpiIcon: { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 },
  kpiContent: {},
  kpiValue: { fontSize: '22px', fontWeight: '800', color: 'var(--text-strong)' },
  kpiLabel: { fontSize: '13px', color: 'var(--text-3)', margin: '2px 0' },
  kpiSub: { fontSize: '11px', color: 'var(--text-2)' },
  chartsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  chartCard: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '12px', padding: '20px' },
  chartTitle: { color: 'var(--text-strong)', fontSize: '15px', fontWeight: '700', margin: '0 0 16px' },
  tableCard: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '12px', padding: '20px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { borderBottom: '1px solid var(--border-2)' },
  th: { color: 'var(--text-2)', fontSize: '12px', fontWeight: '600', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '12px', color: 'var(--text)', fontSize: '13px' },
  emptyCell: { padding: '24px', textAlign: 'center', color: 'var(--text-2)' },
};
