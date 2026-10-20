import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState(null);
  const [selected, setSelected] = useState(null); // pour la modal détail

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/clients');
      setClients(data.clients || []);
    } catch {
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
      c.prenom?.toLowerCase().includes(search.toLowerCase()) ||
      c.nom?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.adresse?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={s.page}>
      <div style={s.tableCard}>
        <div style={s.tableHeader}>
          <h3 style={s.tableTitle}>{clients.length} clients inscrits</h3>
          <input
            placeholder="Nom, prénom, téléphone, adresse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={s.searchInput}
          />
          <button onClick={load} style={s.refreshBtn}>Actualiser</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['Prénom', 'Nom', 'Téléphone', 'Date naiss.', 'Adresse', 'Email', 'Inscription', 'Statut', ''].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={s.empty}>Chargement...</td></tr>}
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  style={s.tr}
                  onClick={() => setSelected(client)}
                >
                  <td style={{ ...s.td, fontWeight: '600', color: 'white' }}>
                    {client.prenom || client.full_name?.split(' ')[0] || '—'}
                  </td>
                  <td style={{ ...s.td, fontWeight: '600', color: '#FF6B00' }}>
                    {client.nom || client.full_name?.split(' ').slice(1).join(' ') || '—'}
                  </td>
                  <td style={{ ...s.td, color: '#94a3b8' }}>{client.phone}</td>
                  <td style={{ ...s.td, color: '#64748b' }}>{fmtDate(client.date_naissance)}</td>
                  <td style={{ ...s.td, color: '#64748b', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {client.adresse || '—'}
                  </td>
                  <td style={{ ...s.td, color: '#64748b' }}>{client.email || '—'}</td>
                  <td style={{ ...s.td, color: '#64748b' }}>
                    {fmtDate(client.created_at)}
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
                  <td style={s.td} onClick={(e) => e.stopPropagation()}>
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
                      {toggling === client.id ? 'Patientez...' : client.is_active ? 'Bloquer' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={s.empty}>Aucun client trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal détail client */}
      {selected && (
        <div style={s.overlay} onClick={() => setSelected(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={{ color: 'white', margin: 0 }}>
                {selected.prenom || ''} {selected.nom || selected.full_name}
              </h3>
              <button onClick={() => setSelected(null)} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.modalBody}>
              <InfoRow label="Prénom" value={selected.prenom || '—'} />
              <InfoRow label="Nom" value={selected.nom || '—'} />
              <InfoRow label="Téléphone" value={selected.phone} />
              <InfoRow label="Date de naissance" value={fmtDate(selected.date_naissance)} />
              <InfoRow label="Adresse" value={selected.adresse || '—'} />
              <InfoRow label="Email" value={selected.email || '—'} />
              <InfoRow label="Inscrit le" value={fmtDate(selected.created_at)} />
              <InfoRow label="Vérifié" value={selected.is_verified ? 'Oui' : 'Non'} />
              <InfoRow label="Statut" value={selected.is_active ? 'Actif' : 'Inactif'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
      <span style={{ color: '#64748b', fontSize: '13px' }}>{label}</span>
      <span style={{ color: 'white', fontSize: '13px', fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  tableCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
  tableTitle: { color: 'white', fontSize: '15px', fontWeight: '700', margin: 0, flexShrink: 0 },
  searchInput: { flex: 1, minWidth: '200px', maxWidth: '360px', padding: '9px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' },
  refreshBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#94a3b8', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  thead: { background: '#0f172a' },
  th: { padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #0f172a', cursor: 'pointer', transition: 'background 0.1s' },
  td: { padding: '12px', color: '#cbd5e1', fontSize: '13px' },
  badge: { padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
  toggleBtn: { padding: '5px 10px', border: '1px solid', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  empty: { padding: '32px', textAlign: 'center', color: '#475569' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', borderRadius: '16px 16px 0 0' },
  modalBody: { padding: '20px 24px' },
  closeBtn: { background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' },
};
