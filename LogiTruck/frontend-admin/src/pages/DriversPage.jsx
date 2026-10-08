import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/drivers');
      setDrivers(data.drivers);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (driver) => {
    setToggling(driver.id);
    try {
      await api.patch(`/admin/users/${driver.id}/activate`, {
        is_active: !driver.is_active,
      });
      toast.success(`Compte ${!driver.is_active ? 'activé' : 'désactivé'}`);
      load();
    } finally {
      setToggling(null);
    }
  };

  const filtered = drivers.filter(
    (d) =>
      search === '' ||
      d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.phone?.includes(search) ||
      d.truck_plate?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={s.page}>
      {/* Résumé */}
      <div style={s.summaryRow}>
        <SummaryCard icon="🚛" label="Total chauffeurs" value={drivers.length} />
        <SummaryCard icon="🟢" label="Disponibles" value={drivers.filter((d) => d.is_available).length} color="#10B981" />
        <SummaryCard icon="🔴" label="Indisponibles" value={drivers.filter((d) => !d.is_available).length} color="#EF4444" />
        <SummaryCard
          icon="⭐"
          label="Note moyenne"
          value={drivers.length > 0
            ? (drivers.reduce((s, d) => s + parseFloat(d.rating || 5), 0) / drivers.length).toFixed(1)
            : '—'}
          color="#F59E0B"
        />
      </div>

      <div style={s.tableCard}>
        <div style={s.tableHeader}>
          <input
            placeholder="🔍 Nom, téléphone, plaque..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={s.searchInput}
          />
          <button onClick={load} style={s.refreshBtn}>🔄</button>
        </div>

        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['Chauffeur', 'Téléphone', 'Camion', 'Plaque', 'Courses', 'Note', 'MoMo', 'Dispo', 'Statut', ''].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} style={s.empty}>Chargement...</td></tr>
              )}
              {filtered.map((driver) => (
                <tr key={driver.id} style={s.tr}>
                  <td style={s.td}>
                    <div style={s.driverName}>{driver.full_name}</div>
                  </td>
                  <td style={{ ...s.td, color: '#94a3b8' }}>{driver.phone}</td>
                  <td style={s.td}>
                    <span style={s.truckType}>
                      {driver.truck_type === 'double_benne' ? '🟠 Double benne' :
                       driver.truck_type === 'simple_benne' ? '🔵 Benne simple' : '🟣 Plateau'}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontWeight: '600' }}>{driver.truck_plate}</td>
                  <td style={{ ...s.td, textAlign: 'center', fontWeight: '700', color: '#FF6B00' }}>
                    {driver.total_trips || 0}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <span style={s.rating}>⭐ {parseFloat(driver.rating || 5).toFixed(1)}</span>
                  </td>
                  <td style={s.td}>
                    <div style={s.momoInfo}>
                      <span style={{ color: driver.momo_provider === 'mtn' ? '#FFD700' : '#00BFFF' }}>
                        {driver.momo_provider === 'mtn' ? 'MTN' : driver.momo_provider === 'moov' ? 'Moov' : '—'}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>{driver.momo_number}</span>
                    </div>
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <span style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: driver.is_available ? '#10B981' : '#475569',
                      display: 'inline-block',
                    }} />
                  </td>
                  <td style={s.td}>
                    <span style={{
                      ...s.badge,
                      color: driver.is_active ? '#10B981' : '#EF4444',
                      background: driver.is_active ? '#10B98120' : '#EF444420',
                    }}>
                      {driver.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <button
                      onClick={() => toggleActive(driver)}
                      disabled={toggling === driver.id}
                      style={{
                        ...s.toggleBtn,
                        background: driver.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                        color: driver.is_active ? '#EF4444' : '#10B981',
                        borderColor: driver.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
                      }}
                    >
                      {toggling === driver.id ? '⏳' : driver.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} style={s.empty}>Aucun chauffeur trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, color = '#FF6B00' }) {
  return (
    <div style={s.summaryCard}>
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '22px', fontWeight: '800', color }}>{value}</div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>{label}</div>
      </div>
    </div>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
  summaryCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center' },
  tableCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', gap: '12px', alignItems: 'center' },
  searchInput: { flex: 1, maxWidth: '360px', padding: '9px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' },
  refreshBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#94a3b8', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' },
  tableWrapper: { overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  thead: { background: '#0f172a' },
  th: { padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #0f172a' },
  td: { padding: '12px', color: '#cbd5e1', fontSize: '13px', verticalAlign: 'middle' },
  driverName: { fontWeight: '600', color: 'white' },
  truckType: { fontSize: '12px' },
  rating: { fontSize: '13px', color: '#F59E0B', fontWeight: '600' },
  momoInfo: { display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', fontWeight: '600' },
  badge: { padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
  toggleBtn: { padding: '5px 10px', border: '1px solid', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  empty: { padding: '32px', textAlign: 'center', color: '#475569' },
};
