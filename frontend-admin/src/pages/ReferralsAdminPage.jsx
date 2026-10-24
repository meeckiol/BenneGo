import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Banknote, CheckCircle2, Users } from 'lucide-react';

const STATUS_FILTER = [
  { value: '', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'completed', label: 'Complétés' },
];

const STATUS_STYLES = {
  pending:   { label: 'En attente', color: 'var(--warning)' },
  completed: { label: 'Complété',   color: 'var(--success)' },
  cancelled: { label: 'Annulé',     color: 'var(--danger)' },
};

export default function ReferralsAdminPage() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadReferrals = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/admin/referrals', { params });
      setReferrals(data.referrals || data || []);
    } catch {
      toast.error('Erreur lors du chargement des parrainages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReferrals(); }, [statusFilter]);

  const filtered = referrals.filter((r) =>
    search === '' ||
    r.referrer_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.referee_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Calcul des stats
  const total = referrals.length;
  const completed = referrals.filter((r) => r.status === 'completed').length;
  const totalRewards = referrals.reduce((acc, r) => acc + parseFloat(r.reward_amount || 0), 0);

  const STAT_CARDS = [
    { label: 'Total parrainages', value: total, icon: <Users size={22} aria-hidden="true" />, color: 'var(--info)' },
    { label: 'Parrainages complétés', value: completed, icon: <CheckCircle2 size={22} aria-hidden="true" />, color: 'var(--success)' },
    { label: 'Récompenses versées', value: `${totalRewards.toLocaleString()} FCFA`, icon: <Banknote size={22} aria-hidden="true" />, color: '#FF6B00' },
  ];

  return (
    <div style={s.page}>
      {/* En-tête */}
      <div>
        <h2 style={s.title}>Parrainage</h2>
        <p style={s.subtitle}>Suivi des parrainages et récompenses</p>
      </div>

      {/* Stats */}
      <div style={s.statsGrid}>
        {STAT_CARDS.map((card) => (
          <div key={card.label} style={s.statCard}>
            <div style={{ ...s.statIcon, background: `${card.color}20`, color: card.color }}>
              {card.icon}
            </div>
            <div>
              <div style={s.statValue}>{loading ? '—' : card.value}</div>
              <div style={s.statLabel}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div style={s.tableCard}>
        {/* Toolbar */}
        <div style={s.toolbar}>
          <input
            placeholder="Rechercher (parrain, filleul)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={s.searchInput}
          />
          <div style={s.filterGroup}>
            {STATUS_FILTER.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                style={{
                  ...s.filterBtn,
                  background: statusFilter === f.value ? '#FF6B00' : 'transparent',
                  color: statusFilter === f.value ? 'white' : '#94a3b8',
                  borderColor: statusFilter === f.value ? '#FF6B00' : '#334155',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={loadReferrals} style={s.refreshBtn}>Actualiser</button>
        </div>

        {/* Compteur */}
        <div style={s.tableInfo}>
          <span style={s.tableCount}>{loading ? 'Chargement...' : `${filtered.length} parrainage(s)`}</span>
        </div>

        {/* Table */}
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['Parrain', 'Filleul', 'Date', 'Statut', 'Récompense'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ref) => {
                const st = STATUS_STYLES[ref.status] || { label: ref.status, color: 'var(--text-3)' };
                return (
                  <tr key={ref.id} style={s.tr}>
                    <td style={s.td}>
                      <div style={s.userName}>{ref.referrer_name || '—'}</div>
                      {ref.referrer_phone && <div style={s.userSub}>{ref.referrer_phone}</div>}
                    </td>
                    <td style={s.td}>
                      <div style={s.userName}>{ref.referee_name || '—'}</div>
                      {ref.referee_phone && <div style={s.userSub}>{ref.referee_phone}</div>}
                    </td>
                    <td style={s.td}>
                      {ref.created_at ? new Date(ref.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, color: st.color, background: `${st.color}20` }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: 'var(--success)', fontWeight: '700' }}>
                      {ref.reward_amount
                        ? `${parseFloat(ref.reward_amount).toLocaleString()} FCFA`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={s.empty}>Aucun parrainage trouvé</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  title: { color: 'white', fontSize: '22px', fontWeight: '800', margin: '0 0 4px' },
  subtitle: { color: 'var(--text-2)', fontSize: '14px', margin: 0 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' },
  statCard: {
    background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '12px',
    padding: '20px', display: 'flex', alignItems: 'center', gap: '16px',
  },
  statIcon: { width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 },
  statValue: { color: 'white', fontSize: '22px', fontWeight: '800' },
  statLabel: { color: 'var(--text-2)', fontSize: '12px', marginTop: '2px' },
  tableCard: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '12px', overflow: 'hidden' },
  toolbar: { padding: '16px 20px', borderBottom: '1px solid var(--border-2)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' },
  searchInput: { padding: '8px 14px', background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', flex: 1, minWidth: '200px' },
  filterGroup: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  filterBtn: { padding: '6px 14px', border: '1px solid', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  refreshBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginLeft: 'auto' },
  tableInfo: { padding: '10px 20px', borderBottom: '1px solid #0f172a' },
  tableCount: { color: 'var(--text-2)', fontSize: '13px' },
  tableWrapper: { overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '700px' },
  thead: { background: 'var(--bg)' },
  th: { padding: '10px 12px', color: 'var(--text-2)', fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #0f172a', transition: 'background 0.1s' },
  td: { padding: '12px', color: 'var(--text-2)', fontSize: '13px', verticalAlign: 'middle' },
  userName: { fontWeight: '600', color: 'white' },
  userSub: { color: 'var(--text-2)', fontSize: '11px', marginTop: '2px' },
  badge: { padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' },
  empty: { padding: '32px', textAlign: 'center', color: 'var(--text-2)' },
};
