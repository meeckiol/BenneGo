import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { X } from 'lucide-react';

const EMPTY_FORM = {
  code: '',
  discount_type: 'percentage',
  discount_value: '',
  min_order_amount: '',
  max_discount: '',
  usage_limit: '',
  expires_at: '',
  is_active: true,
};

export default function PromoCodesAdminPage() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = création, object = édition
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const loadPromos = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/promos');
      setPromos(data.promos ?? data);
    } catch {
      toast.error('Erreur lors du chargement des codes promo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPromos(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (promo) => {
    setEditing(promo);
    setForm({
      code: promo.code ?? '',
      discount_type: promo.discount_type ?? 'percentage',
      discount_value: promo.discount_value ?? '',
      min_order_amount: promo.min_order_amount ?? '',
      max_discount: promo.max_discount ?? '',
      usage_limit: promo.usage_limit ?? '',
      expires_at: promo.expires_at ? promo.expires_at.slice(0, 10) : '',
      is_active: promo.is_active ?? true,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === 'checkbox' ? checked : name === 'code' ? value.toUpperCase() : value,
    }));
  };

  const handleSave = async () => {
    if (!form.code.trim()) return toast.error('Le code est requis');
    if (!form.discount_value) return toast.error('La valeur de remise est requise');
    if (!form.usage_limit) return toast.error('La limite d\'utilisation est requise');

    const payload = {
      code: form.code.trim(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
      max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
      usage_limit: parseInt(form.usage_limit),
      expires_at: form.expires_at || null,
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/promos/${editing.id}`, payload);
        toast.success('Code promo mis à jour');
      } else {
        await api.post('/admin/promos', payload);
        toast.success('Code promo créé');
      }
      closeModal();
      loadPromos();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (promo) => {
    if (!window.confirm(`Supprimer le code "${promo.code}" ?`)) return;
    setDeleting(promo.id);
    try {
      await api.delete(`/admin/promos/${promo.id}`);
      toast.success('Code promo supprimé');
      loadPromos();
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={s.page}>
      {/* En-tête */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Codes Promo</h2>
          <p style={s.subtitle}>Gérez les codes de réduction pour vos clients</p>
        </div>
        <button onClick={openCreate} style={s.newBtn}>+ Nouveau code</button>
      </div>

      {/* Tableau */}
      <div style={s.tableCard}>
        <div style={s.tableHeader}>
          <span style={s.tableTitle}>
            {loading ? 'Chargement...' : `${promos.length} code(s) promo`}
          </span>
          <button onClick={loadPromos} style={s.refreshBtn}>Actualiser</button>
        </div>

        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['Code', 'Type', 'Valeur', 'Min commande', 'Utilisations', 'Expire le', 'Actif', 'Actions'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {promos.map((promo) => (
                <tr key={promo.id} style={s.tr}>
                  <td style={{ ...s.td, fontWeight: '700', color: '#FF6B00', fontFamily: 'monospace', fontSize: '14px' }}>
                    {promo.code}
                  </td>
                  <td style={s.td}>
                    <span style={{
                      ...s.typeBadge,
                      background: promo.discount_type === 'percentage' ? 'rgba(139,92,246,0.15)' : 'rgba(16,185,129,0.15)',
                      color: promo.discount_type === 'percentage' ? '#8B5CF6' : '#10B981',
                    }}>
                      {promo.discount_type === 'percentage' ? '% Pourcentage' : '₣ Fixe'}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontWeight: '700', color: 'white' }}>
                    {promo.discount_type === 'percentage'
                      ? `${promo.discount_value}%`
                      : `${parseFloat(promo.discount_value || 0).toLocaleString()} FCFA`}
                  </td>
                  <td style={s.td}>
                    {promo.min_order_amount
                      ? `${parseFloat(promo.min_order_amount).toLocaleString()} FCFA`
                      : <span style={s.none}>—</span>}
                  </td>
                  <td style={s.td}>
                    <span style={s.usageBadge}>
                      {promo.used_count ?? 0} / {promo.usage_limit ?? '∞'}
                    </span>
                  </td>
                  <td style={s.td}>
                    {promo.expires_at
                      ? new Date(promo.expires_at).toLocaleDateString('fr-FR')
                      : <span style={s.none}>Sans limite</span>}
                  </td>
                  <td style={s.td}>
                    <span style={{
                      ...s.activeBadge,
                      background: promo.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                      color: promo.is_active ? '#10B981' : '#EF4444',
                    }}>
                      {promo.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ ...s.td, display: 'flex', gap: '8px' }}>
                    <button onClick={() => openEdit(promo)} style={s.editBtn}>Éditer</button>
                    <button
                      onClick={() => handleDelete(promo)}
                      disabled={deleting === promo.id}
                      style={s.deleteBtn}
                    >
                      {deleting === promo.id ? 'Suppression...' : 'Supprimer'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && promos.length === 0 && (
                <tr><td colSpan={8} style={s.empty}>Aucun code promo trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal création / édition */}
      {modalOpen && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>
                {editing ? 'Modifier le code promo' : 'Nouveau code promo'}
              </h3>
              <button onClick={closeModal} style={s.closeBtn}><X size={18} aria-hidden="true" /></button>
            </div>

            <div style={s.modalBody}>
              {/* Code */}
              <div style={s.field}>
                <label style={s.label}>Code *</label>
                <input
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  placeholder="ex: BIENVENUE20"
                  style={s.input}
                />
              </div>

              {/* Type + Valeur */}
              <div style={s.row}>
                <div style={{ ...s.field, flex: 1 }}>
                  <label style={s.label}>Type de remise *</label>
                  <select name="discount_type" value={form.discount_type} onChange={handleChange} style={s.select}>
                    <option value="percentage">Pourcentage (%)</option>
                    <option value="fixed">Montant fixe (FCFA)</option>
                  </select>
                </div>
                <div style={{ ...s.field, flex: 1 }}>
                  <label style={s.label}>
                    Valeur * {form.discount_type === 'percentage' ? '(%)' : '(FCFA)'}
                  </label>
                  <input
                    type="number"
                    name="discount_value"
                    value={form.discount_value}
                    onChange={handleChange}
                    min="0"
                    step={form.discount_type === 'percentage' ? '1' : '100'}
                    placeholder={form.discount_type === 'percentage' ? '20' : '5000'}
                    style={s.input}
                  />
                </div>
              </div>

              {/* Min commande + Max remise */}
              <div style={s.row}>
                <div style={{ ...s.field, flex: 1 }}>
                  <label style={s.label}>Min commande (FCFA) <span style={s.optional}>optionnel</span></label>
                  <input
                    type="number"
                    name="min_order_amount"
                    value={form.min_order_amount}
                    onChange={handleChange}
                    min="0"
                    placeholder="10000"
                    style={s.input}
                  />
                </div>
                <div style={{ ...s.field, flex: 1 }}>
                  <label style={s.label}>Remise max (FCFA) <span style={s.optional}>optionnel</span></label>
                  <input
                    type="number"
                    name="max_discount"
                    value={form.max_discount}
                    onChange={handleChange}
                    min="0"
                    placeholder="20000"
                    style={s.input}
                  />
                </div>
              </div>

              {/* Limite d'utilisation + Date d'expiration */}
              <div style={s.row}>
                <div style={{ ...s.field, flex: 1 }}>
                  <label style={s.label}>Limite d'utilisation *</label>
                  <input
                    type="number"
                    name="usage_limit"
                    value={form.usage_limit}
                    onChange={handleChange}
                    min="1"
                    placeholder="100"
                    style={s.input}
                  />
                </div>
                <div style={{ ...s.field, flex: 1 }}>
                  <label style={s.label}>Date d'expiration <span style={s.optional}>optionnel</span></label>
                  <input
                    type="date"
                    name="expires_at"
                    value={form.expires_at}
                    onChange={handleChange}
                    style={{ ...s.input, colorScheme: 'dark' }}
                  />
                </div>
              </div>

              {/* Actif */}
              <div style={s.checkboxRow}>
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#FF6B00' }}
                />
                <label htmlFor="is_active" style={s.checkboxLabel}>Code actif</label>
              </div>
            </div>

            <div style={s.modalFooter}>
              <button onClick={closeModal} style={s.cancelBtn}>Annuler</button>
              <button onClick={handleSave} disabled={saving} style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Sauvegarde...' : editing ? 'Mettre à jour' : 'Créer le code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' },
  title: { color: 'white', fontSize: '22px', fontWeight: '800', margin: '0 0 4px' },
  subtitle: { color: 'var(--text-2)', fontSize: '14px', margin: 0 },
  newBtn: { padding: '10px 20px', background: '#FF6B00', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' },
  tableCard: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '12px', overflow: 'hidden' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid var(--border-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tableTitle: { color: 'var(--text-3)', fontSize: '14px' },
  refreshBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
  thead: { background: 'var(--bg)' },
  th: { padding: '10px 12px', color: 'var(--text-2)', fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #0f172a' },
  td: { padding: '12px', color: 'var(--text-2)', fontSize: '13px', verticalAlign: 'middle' },
  typeBadge: { padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' },
  activeBadge: { padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
  usageBadge: { color: 'var(--text-3)', fontFamily: 'monospace', fontSize: '12px' },
  none: { color: 'var(--text-2)', fontStyle: 'italic' },
  editBtn: { padding: '5px 10px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--info)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  deleteBtn: { padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  empty: { padding: '32px', textAlign: 'center', color: 'var(--text-2)' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '12px', width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' },
  modalHeader: { padding: '20px 24px', borderBottom: '1px solid var(--border-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: 'white', fontSize: '18px', fontWeight: '700', margin: 0 },
  closeBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-2)', color: 'var(--text-3)', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  modalBody: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' },
  modalFooter: { padding: '16px 24px', borderTop: '1px solid var(--border-2)', display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  row: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  label: { color: 'var(--text-3)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
  optional: { color: 'var(--text-2)', fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  input: { padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  select: { padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', width: '100%', cursor: 'pointer' },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  checkboxLabel: { color: 'var(--text-2)', fontSize: '14px', cursor: 'pointer' },
  cancelBtn: { padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-2)', color: 'var(--text-3)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  saveBtn: { padding: '10px 24px', background: '#FF6B00', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
};
