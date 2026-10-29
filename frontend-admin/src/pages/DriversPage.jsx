import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { IdCard, Star, X } from 'lucide-react';
import { dateLocale } from '../../../shared/i18n/dom';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(dateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState(null);
  const [selected, setSelected] = useState(null);

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
      d.prenom?.toLowerCase().includes(search.toLowerCase()) ||
      d.nom?.toLowerCase().includes(search.toLowerCase()) ||
      d.phone?.includes(search) ||
      d.truck_plate?.toLowerCase().includes(search.toLowerCase()) ||
      d.adresse?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={s.page}>
      {/* Résumé */}
      <div style={s.summaryRow}>
        <SummaryCard icon={<IdCard size={24} aria-hidden="true" />} label="Total chauffeurs" value={drivers.length} />
        <SummaryCard icon={<span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: '#10B981' }} />} label="Disponibles" value={drivers.filter((d) => d.is_available).length} color="#10B981" />
        <SummaryCard icon={<span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: '#EF4444' }} />} label="Indisponibles" value={drivers.filter((d) => !d.is_available).length} color="#EF4444" />
        <SummaryCard
          icon={<Star size={24} fill="#F59E0B" color="#F59E0B" aria-hidden="true" />}
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
            placeholder="Nom, prénom, téléphone, plaque, adresse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={s.searchInput}
          />
          <button onClick={load} style={s.refreshBtn}>Actualiser</button>
        </div>

        <div style={s.tableWrapper} tabIndex={0}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['Prénom', 'Nom', 'Téléphone', 'Date naiss.', 'Adresse', 'Camion', 'Plaque', 'Courses', 'Note', 'MoMo', 'Dispo', 'Statut', ''].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={13} style={s.empty}>Chargement...</td></tr>
              )}
              {filtered.map((driver) => (
                <tr key={driver.id} style={s.tr} onClick={() => setSelected(driver)}>
                  <td style={{ ...s.td, fontWeight: '600', color: 'var(--text-strong)' }}>
                    {driver.prenom || driver.full_name?.split(' ')[0] || '—'}
                  </td>
                  <td style={{ ...s.td, fontWeight: '600', color: 'var(--brand-ink)' }}>
                    {driver.nom || driver.full_name?.split(' ').slice(1).join(' ') || '—'}
                  </td>
                  <td style={{ ...s.td, color: 'var(--text-3)' }}>{driver.phone}</td>
                  <td style={{ ...s.td, color: 'var(--text-2)' }}>{fmtDate(driver.date_naissance)}</td>
                  <td style={{ ...s.td, color: 'var(--text-2)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {driver.adresse || driver.driver_adresse || '—'}
                  </td>
                  <td style={s.td}>
                    <span style={s.truckType}>
                      {driver.truck_type === 'double_benne' ? 'Double benne' :
                       driver.truck_type === 'simple_benne' ? 'Benne simple' :
                       driver.truck_type === 'pickup' ? 'Pick-up léger' : 'Plateau'}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontWeight: '600' }}>{driver.truck_plate}</td>
                  <td style={{ ...s.td, textAlign: 'center', fontWeight: '700', color: 'var(--brand-ink)' }}>
                    {driver.total_trips || 0}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <span style={s.rating}>{parseFloat(driver.rating || 5).toFixed(1)} / 5</span>
                  </td>
                  <td style={s.td}>
                    <div style={s.momoInfo}>
                      <span style={{ color: driver.momo_provider === 'mtn' ? '#FFD700' : '#00BFFF' }}>
                        {driver.momo_provider === 'mtn' ? 'MTN' : driver.momo_provider === 'moov' ? 'Moov' : '—'}
                      </span>
                      <span style={{ color: 'var(--text-2)', fontSize: '11px' }}>{driver.momo_number}</span>
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
                  <td style={s.td} onClick={(e) => e.stopPropagation()}>
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
                      {toggling === driver.id ? 'Patientez...' : driver.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={13} style={s.empty}>Aucun chauffeur trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal détail conducteur */}
      {selected && (
        <div style={s.overlay} onClick={() => setSelected(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={{ color: 'var(--text-strong)', margin: 0 }}>
                {selected.prenom || ''} {selected.nom || selected.full_name}
              </h3>
              <button onClick={() => setSelected(null)} style={s.closeBtn}><X size={18} aria-hidden="true" /></button>
            </div>
            <div style={s.modalBody}>
              <SectionTitle>Informations personnelles</SectionTitle>
              <InfoRow label="Prénom" value={selected.prenom || '—'} />
              <InfoRow label="Nom" value={selected.nom || '—'} />
              <InfoRow label="Téléphone" value={selected.phone} />
              <InfoRow label="Date de naissance" value={fmtDate(selected.date_naissance)} />
              <InfoRow label="Adresse" value={selected.adresse || selected.driver_adresse || '—'} />

              <SectionTitle>Informations véhicule</SectionTitle>
              <InfoRow label="Type de camion"
                value={selected.truck_type === 'double_benne' ? 'Double benne'
                  : selected.truck_type === 'simple_benne' ? 'Benne simple'
                  : selected.truck_type === 'pickup' ? 'Pick-up léger'
                  : 'Plateau'} />
              <InfoRow label="Plaque" value={selected.truck_plate} />
              <InfoRow label="Courses effectuées" value={selected.total_trips || 0} />
              <InfoRow label="Note moyenne" value={`${parseFloat(selected.rating || 5).toFixed(1)} / 5 (${selected.rating_count || 0} avis)`} />

              <SectionTitle>Mobile Money</SectionTitle>
              <InfoRow label="Opérateur"
                value={selected.momo_provider === 'mtn' ? 'MTN Mobile Money'
                  : selected.momo_provider === 'moov' ? 'Moov Money' : '—'} />
              <InfoRow label="Numéro" value={selected.momo_number || '—'} />

              <SectionTitle>Statut</SectionTitle>
              <InfoRow label="Disponible" value={selected.is_available ? 'Oui' : 'Non'} />
              <InfoRow label="Compte" value={selected.is_active ? 'Actif' : 'Inactif'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color = '#D9A55B' }) {
  return (
    <div style={s.summaryCard}>
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '22px', fontWeight: '800', color }}>{value}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{label}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: '6px', padding: '6px 10px', marginTop: '14px', marginBottom: '4px' }}>
      <span style={{ color: 'var(--brand-ink)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {children}
      </span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-2)', fontSize: '13px' }}>{label}</span>
      <span style={{ color: 'var(--text-strong)', fontSize: '13px', fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
  summaryCard: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '12px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center' },
  tableCard: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '12px', overflow: 'hidden' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid var(--border-2)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: '200px', maxWidth: '420px', padding: '9px 14px', background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: '8px', color: 'var(--text-strong)', fontSize: '13px', outline: 'none' },
  refreshBtn: { background: 'rgba(17, 24, 39, 0.05)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' },
  tableWrapper: { overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '1100px' },
  thead: { background: 'var(--bg)' },
  th: { padding: '10px 12px', color: 'var(--text-2)', fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid var(--border)', cursor: 'pointer' },
  td: { padding: '12px', color: 'var(--text-2)', fontSize: '13px', verticalAlign: 'middle' },
  truckType: { fontSize: '12px' },
  rating: { fontSize: '13px', color: 'var(--warning)', fontWeight: '600' },
  momoInfo: { display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', fontWeight: '600' },
  badge: { padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
  toggleBtn: { padding: '5px 10px', border: '1px solid', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  empty: { padding: '32px', textAlign: 'center', color: 'var(--text-2)' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { padding: '20px 24px', borderBottom: '1px solid var(--border-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', borderRadius: '16px 16px 0 0', position: 'sticky', top: 0 },
  modalBody: { padding: '20px 24px' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '18px', cursor: 'pointer' },
};
