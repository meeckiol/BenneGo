import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

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
    { label: 'Total parrainages', value: total, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>, color: 'var(--info)' },
    { label: 'Parrainages complétés', value: completed, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>, color: 'var(--success)' },
    { label: 'Récompenses versées', value: `${totalRewards.toLocaleString()} FCFA`, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>, color: '#FF6B00' },
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
