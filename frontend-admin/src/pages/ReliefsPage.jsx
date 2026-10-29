import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { dateLocale } from '../../../shared/i18n/dom';

const REASON_LABELS = { crevaison: 'Crevaison', panne_moteur: 'Panne moteur', accident: 'Accident', autre: 'Autre' };
const dateFr = (d) => (d ? new Date(d).toLocaleString(dateLocale()) : '—');

export default function ReliefsPage() {
  const [requests, setRequests] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [choice, setChoice] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/reliefs');
      setRequests(data.requests || []);
      setCandidates(data.candidates || []);
    } catch { /* intercepteur */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const assign = async (request) => {
    const reliefId = choice[request.id];
    if (!reliefId) return;
    const reserve = candidates.find((c) => c.id === reliefId);
    if (!window.confirm(`Réassigner la course ${request.order_number} à ${reserve?.full_name} ?`)) return;
    setBusy(request.id);
    try {
      const { data } = await api.post(`/admin/reliefs/${request.id}/assign`, { relief_driver_id: reliefId });
      toast.success(data.message);
      await load();
    } catch { /* intercepteur */ } finally {
      setBusy(null);
    }
  };

  return (
    <div style={s.page}>
      <h2 style={s.title}>Pannes & bennes de réserve</h2>
      <p style={s.sub}>Un chauffeur a signalé une panne en cours de course. Réassignez la course à une benne disponible.</p>

      <div style={s.pool}>
        <strong>{candidates.length}</strong> chauffeur(s) disponible(s) avec Mobile Money, sans course en cours.
      </div>

      {loading && <div style={s.muted}>Chargement…</div>}
      {!loading && requests.length === 0 && <div style={s.empty}>Aucune panne en attente.</div>}

      {requests.map((r) => (
        <div key={r.id} style={s.card}>
          <div style={s.header}>
            <strong style={s.orderNumber}>{r.order_number}</strong>
            <span style={s.muted}>Signalée le {dateFr(r.created_at)}</span>
          </div>
          <div style={s.grid}>
            <div><span style={s.label}>Motif</span>{REASON_LABELS[r.breakdown_reason] || r.breakdown_reason}</div>
            <div><span style={s.label}>Chauffeur en panne</span>{r.original_driver_name || '—'} {r.original_truck_plate ? `· ${r.original_truck_plate}` : ''}</div>
            <div><span style={s.label}>Trajet</span>{r.pickup_address} → {r.delivery_address}</div>
            <div><span style={s.label}>Position</span>
              <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-ink)' }}>
                Voir sur la carte
              </a>
            </div>
          </div>

          {candidates.length === 0 ? (
            <div style={s.warn}>Aucune benne de réserve disponible pour l'instant.</div>
          ) : (
            <div style={s.actions}>
              <select
                value={choice[r.id] || ''}
                onChange={(e) => setChoice({ ...choice, [r.id]: e.target.value })}
                style={s.select}
              >
                <option value="">Choisir la benne de réserve…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} · {c.truck_plate || 'sans plaque'} · {c.truck_type || ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => assign(r)}
                disabled={!choice[r.id] || busy === r.id}
                style={s.primaryBtn}
              >
                Réassigner la course
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const s = {
  page: { padding: 24, color: 'var(--text)', maxWidth: 1000 },
  title: { margin: '0 0 6px', fontSize: 22, fontWeight: 800 },
  sub: { margin: '0 0 16px', color: 'var(--text-3)', fontSize: 14 },
  pool: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 14 },
  muted: { color: 'var(--text-3)', fontSize: 13 },
  empty: { background: 'var(--surface)', borderRadius: 12, padding: 24, color: 'var(--text-3)', textAlign: 'center' },
  card: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, padding: 18, marginBottom: 16 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNumber: { fontSize: 16, color: 'var(--brand-ink)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, fontSize: 14 },
  label: { display: 'block', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 },
  warn: { marginTop: 14, background: '#422006', color: '#FDE68A', borderRadius: 8, padding: 12, fontSize: 14 },
  actions: { display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  select: { flex: 1, minWidth: 260, padding: 10, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text)' },
  primaryBtn: { padding: '10px 16px', borderRadius: 8, border: 'none', background: '#D9A55B', color: '#0b0b10', fontWeight: 700, cursor: 'pointer' },
};
