import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

const fcfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
const dateFr = (d) => (d ? new Date(d).toLocaleString('fr-FR') : '—');

export default function DisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/disputes');
      setDisputes(data.disputes || []);
    } catch { /* intercepteur */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (dispute, decision) => {
    const question = decision === 'refund'
      ? `Rembourser ${fcfa(dispute.total_amount)} au client ?\nLe séquestre sera remboursé via KKiaPay.`
      : `Valider la livraison et verser ${fcfa(dispute.driver_amount)} au chauffeur ?`;
    if (!window.confirm(question)) return;
    setBusy(dispute.id);
    try {
      const { data } = await api.post(`/admin/orders/${dispute.id}/dispute/resolve`, {
        decision,
        note: notes[dispute.id] || undefined,
      });
      toast.success(data.message);
      await load();
    } catch { /* intercepteur */ } finally {
      setBusy(null);
    }
  };

  return (
    <div style={s.page}>
      <h2 style={s.title}>Litiges à la livraison</h2>
      <p style={s.sub}>Le client a refusé la livraison avant confirmation. Le séquestre reste bloqué jusqu'à votre décision.</p>

      {loading && <div style={s.muted}>Chargement…</div>}
      {!loading && disputes.length === 0 && <div style={s.empty}>Aucun litige ouvert.</div>}

      {disputes.map((d) => (
        <div key={d.id} style={s.card}>
          <div style={s.header}>
            <strong style={s.orderNumber}>{d.order_number}</strong>
            <span style={s.muted}>Ouvert le {dateFr(d.dispute_opened_at)}</span>
          </div>
          <div style={s.grid}>
            <div><span style={s.label}>Client</span>{d.client_name} · {d.client_phone}</div>
            <div><span style={s.label}>Chauffeur</span>{d.driver_name || '—'} · {d.driver_phone || '—'}</div>
            <div><span style={s.label}>Montant séquestré</span>{fcfa(d.total_amount)}</div>
            <div><span style={s.label}>Volume déclaré au départ</span>{d.loading_volume_m3 ? `${Number(d.loading_volume_m3)} m³` : '—'}</div>
          </div>
          <div style={s.reason}><span style={s.label}>Motif du client</span>{d.dispute_reason}</div>
          {/* La discussion client ↔ chauffeur aide à trancher (horaires, accès, quantité annoncée…) */}
          <Link to={`/messages?scope=dispute&order=${d.id}`} style={s.chatLink}>Voir la discussion client ↔ chauffeur</Link>

          <PhotoRow title="Photos du chargement (départ)" urls={d.loading_photos} />
          <PhotoRow title="Photos du client (refus)" urls={d.dispute_photos} />

          <input
            placeholder="Note interne (facultative)"
            value={notes[d.id] || ''}
            onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
            style={s.input}
          />
          <div style={s.actions}>
            <button onClick={() => resolve(d, 'refund')} disabled={busy === d.id} style={s.dangerBtn}>
              Rembourser le client
            </button>
            <button onClick={() => resolve(d, 'release')} disabled={busy === d.id} style={s.primaryBtn}>
              Valider la livraison (verser le chauffeur)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PhotoRow({ title, urls }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={s.label}>{title}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {urls.map((url) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
            <img src={url} alt={title} style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-2)' }} />
          </a>
        ))}
      </div>
    </div>
  );
}

const s = {
  page: { padding: 24, color: 'var(--text)', maxWidth: 1100 },
  title: { margin: '0 0 6px', fontSize: 22, fontWeight: 800 },
  sub: { margin: '0 0 20px', color: 'var(--text-3)', fontSize: 14 },
  muted: { color: 'var(--text-3)', fontSize: 13 },
  empty: { background: 'var(--surface)', borderRadius: 12, padding: 24, color: 'var(--text-3)', textAlign: 'center' },
  card: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, padding: 18, marginBottom: 16 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNumber: { fontSize: 16, color: 'var(--brand-ink)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, fontSize: 14 },
  label: { display: 'block', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 },
  reason: { marginTop: 12, background: 'var(--bg)', borderRadius: 8, padding: 12, fontSize: 14, lineHeight: 1.5 },
  input: { marginTop: 14, width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' },
  chatLink: { display: 'inline-block', marginTop: 10, fontSize: 14, fontWeight: 700, color: 'var(--brand-ink)' },
  actions: { display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  primaryBtn: { flex: 1, minWidth: 220, padding: 12, borderRadius: 8, border: 'none', background: '#D9A55B', color: '#0b0b10', fontWeight: 700, cursor: 'pointer' },
  dangerBtn: { flex: 1, minWidth: 220, padding: 12, borderRadius: 8, border: '1px solid #EF4444', background: 'transparent', color: 'var(--danger)', fontWeight: 700, cursor: 'pointer' },
};
