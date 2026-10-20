import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function MonthlyReportPage() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const generatePDF = async () => {
    if (!month) return toast.error('Sélectionnez un mois');
    setLoading(true);
    try {
      const response = await api.get('/admin/report/monthly', {
        params: { month },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-bennego-${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Rapport PDF téléchargé');
    } catch {
      toast.error('Erreur lors de la génération du rapport');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!month) return;
    setStatsLoading(true);
    try {
      const { data } = await api.get('/admin/report/monthly/stats', { params: { month } });
      setStats(data);
    } catch {
      // Stats optionnelles, on ignore l'erreur silencieusement
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  React.useEffect(() => {
    loadStats();
  }, [month]);

  const STAT_CARDS = stats
    ? [
        { label: 'Commandes du mois', value: stats.total_orders ?? '—', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20 7l-8-4-8 4v10l8 4 8-4V7zm-8 2.2L6.3 7 12 4.2 17.7 7 12 9.2z"/></svg>, color: '#3B82F6' },
        { label: 'Revenus générés', value: stats.total_revenue ? `${parseFloat(stats.total_revenue).toLocaleString()} FCFA` : '—', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>, color: '#10B981' },
        { label: 'Nouveaux clients', value: stats.new_clients ?? '—', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>, color: '#FF6B00' },
        { label: 'Commissions perçues', value: stats.total_commission ? `${parseFloat(stats.total_commission).toLocaleString()} FCFA` : '—', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2V7h2v10zm4 0h-2v-4h2v4zm-8 0H6v-7h2v7z"/></svg>, color: '#8B5CF6' },
      ]
    : [];

  return (
    <div style={s.page}>
      {/* En-tête */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Rapport Mensuel</h2>
          <p style={s.subtitle}>Générez et téléchargez le rapport d'activité mensuel en PDF</p>
        </div>
      </div>

      {/* Sélecteur de mois + bouton */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>Paramètres du rapport</h3>
        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Mois</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              max={defaultMonth}
              style={s.monthInput}
            />
          </div>
          <button
            onClick={generatePDF}
            disabled={loading}
            style={{ ...s.generateBtn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Génération...' : 'Générer le rapport PDF'}
          </button>
        </div>
      </div>

      {/* Stats inline */}
      {statsLoading && (
        <div style={s.loadingText}>Chargement des statistiques...</div>
      )}

      {stats && !statsLoading && (
        <>
          <div style={s.statsGrid}>
            {STAT_CARDS.map((card) => (
              <div key={card.label} style={s.statCard}>
                <div style={{ ...s.statIcon, background: `${card.color}20`, color: card.color }}>
                  {card.icon}
                </div>
                <div>
                  <div style={s.statValue}>{card.value}</div>
                  <div style={s.statLabel}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Détails supplémentaires si disponibles */}
          {stats.top_drivers && stats.top_drivers.length > 0 && (
            <div style={s.card}>
              <h3 style={s.cardTitle}>Top Chauffeurs du mois</h3>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    {['#', 'Chauffeur', 'Livraisons', 'Revenus'].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.top_drivers.map((d, i) => (
                    <tr key={d.driver_id} style={s.tr}>
                      <td style={s.td}><span style={s.rank}>#{i + 1}</span></td>
                      <td style={s.td}>{d.driver_name}</td>
                      <td style={s.td}>{d.deliveries}</td>
                      <td style={{ ...s.td, color: '#10B981', fontWeight: '700' }}>
                        {parseFloat(d.revenue || 0).toLocaleString()} FCFA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!stats && !statsLoading && (
        <div style={s.noStatsCard}>
          <p style={s.noStatsText}>Sélectionnez un mois pour afficher les statistiques</p>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: 'white', fontSize: '22px', fontWeight: '800', margin: '0 0 4px' },
  subtitle: { color: '#64748b', fontSize: '14px', margin: 0 },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' },
  cardTitle: { color: 'white', fontSize: '16px', fontWeight: '700', margin: '0 0 16px' },
  row: { display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
  monthInput: {
    padding: '10px 14px', background: '#0f172a', border: '1px solid #334155',
    borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none',
    colorScheme: 'dark',
  },
  generateBtn: {
    padding: '11px 24px', background: '#FF6B00', border: 'none',
    borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '700',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' },
  statCard: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
    padding: '20px', display: 'flex', alignItems: 'center', gap: '16px',
  },
  statIcon: { width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 },
  statValue: { color: 'white', fontSize: '22px', fontWeight: '800' },
  statLabel: { color: '#64748b', fontSize: '12px', marginTop: '2px' },
  loadingText: { color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' },
  noStatsCard: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
    padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
  },
  noStatsIcon: { fontSize: '48px' },
  noStatsText: { color: '#475569', fontSize: '14px', margin: 0 },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#0f172a' },
  th: { padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tr: { borderBottom: '1px solid #0f172a' },
  td: { padding: '12px', color: '#cbd5e1', fontSize: '13px' },
  rank: { color: '#FF6B00', fontWeight: '700' },
};
