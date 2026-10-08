import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      // Récupère tous les users avec role=client via un endpoint dédié
      const { data } = await api.get('/admin/clients');
      setClients(data.clients || []);
    } catch {
      // fallback si endpoint pas encore créé
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (client) => {
    setToggling(client.id);
    try {
      await api.patch(`/admin/users/${client.id}/activate`, { is_active: !client.is_active });
      toast.success(`Compte ${!client.is_active ? 'activé' : 'désactivé'}`);
      load();
    } finally {
      setToggling(null);
    }
  };

  const filtered = clients.filter(
    (c) =>
      search === '' ||
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
  );

  return (
    <div style={s.page}>
      <div style={s.tableCard}>
        <div style={s.tableHeader}>
          <h3 style={s.tableTitle}>👥 {clients.length} clients inscrits</h3>
          <input
            placeholder="🔍 Nom ou téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={s.searchInput}
          />
          <button onClick={load} style={s.refreshBtn}>🔄</button>
        </div>

        <table style={s.table}>
          <thead>
            <tr style={s.thead}>
              {['Nom', 'Téléphone', 'Email', 'Inscription', 'Vérifié', 'Statut', ''].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={s.empty}>Chargement...</td></tr>}
            {filtered.map((client) => (
              <tr key={client.id} style={s.tr}>
                <td style={{ ...s.td, fontWeight: '600', color: 'white' }}>{client.full_name}</td>
                <td style={{ ...s.td, color: '#94a3b8' }}>{client.phone}</td>
                <td style={{ ...s.td, color: '#64748b' }}>{client.email || '—'}</td>
                <td style={{ ...s.td, color: '#64748b' }}>
                  {new Date(client.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td style={{ ...s.td, textAlign: 'center' }}>
                  {client.is_verified ? '✅' : '⏳'}
                </td>
                <td style={s.td}>
                  <span style={{
                    ...s.badge,
                    color: client.is_active ? '#10B981' : '#EF4444',
                    background: client.is_active ? '#10B98120' : '#EF444420',
                  }}>
                    {client.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td style={s.td}>
                  <button
                    onClick={() => toggleActive(client)}
                    disabled={toggling === client.id}
                    style={{
                      ...s.toggleBtn,
                      background: client.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                      color: client.is_active ? '#EF4444' : '#10B981',
                      borderColor: client.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
                    }}
                  >
                    {toggling === client.id ? '⏳' : client.is_active ? 'Bloquer' : 'Activer'}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={s.empty}>Aucun client trouvé</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  tableCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', gap: '12px', alignItems: 'center' },
  tableTitle: { color: 'white', fontSize: '15px', fontWeight: '700', margin: 0, flexShrink: 0 },
  searchInput: { flex: 1, maxWidth: '300px', padding: '9px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' },
  refreshBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#94a3b8', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#0f172a' },
  th: { padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tr: { borderBottom: '1px solid #0f172a' },
  td: { padding: '12px', color: '#cbd5e1', fontSize: '13px' },
  badge: { padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
  toggleBtn: { padding: '5px 10px', border: '1px solid', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  empty: { padding: '32px', textAlign: 'center', color: '#475569' },
};
