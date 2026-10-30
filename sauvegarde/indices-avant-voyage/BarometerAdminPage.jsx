import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const isoWeek = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7), year: d.getUTCFullYear() };
};

const EMPTY = { material_name: '', min_price_m3: '', avg_price_m3: '', max_price_m3: '', trend: 'stable' };

export default function BarometerAdminPage() {
  const current = isoWeek();
  const [form, setForm] = useState(EMPTY);
  const [week, setWeek] = useState(current.week);
  const [year, setYear] = useState(current.year);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/barometer');
      setItems(data.items || []);
    } catch { /* intercepteur */ }
  };

  useEffect(() => { load(); }, []);

  const publish = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/barometer', { ...form, week_number: Number(week), year: Number(year) });
      toast.success('Indice publié sur la page d\'accueil client');
      setForm(EMPTY);
      await load();
    } catch { /* intercepteur */ } finally {
      setSaving(false);
    }
  };

  const field = (key, label, type = 'text', extra = {}) => (
    <label style={s.label}>
      {label}
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        required
        style={s.input}
        {...extra}
      />
    </label>
  );

  return (
    <div style={s.page}>
      <h2 style={s.title}>Baromètre des prix BTP</h2>
      <p style={s.sub}>Publiez chaque semaine le prix moyen au m³ observé. Il s'affiche sur la page d'accueil client.</p>

      <form onSubmit={publish} style={s.card}>
        <div style={s.grid}>
          {field('material_name', 'Matériau')}
          <label style={s.label}>
            Tendance
            <select value={form.trend} onChange={(e) => setForm({ ...form, trend: e.target.value })} style={s.input}>
              <option value="up">Hausse</option>
              <option value="stable">Stable</option>
              <option value="down">Baisse</option>
            </select>
          </label>
          {field('min_price_m3', 'Prix min (FCFA/m³)', 'number', { min: 0, step: '1' })}
          {field('avg_price_m3', 'Prix moyen (FCFA/m³)', 'number', { min: 0, step: '1' })}
          {field('max_price_m3', 'Prix max (FCFA/m³)', 'number', { min: 0, step: '1' })}
          <label style={s.label}>
            Semaine
            <input type="number" min="1" max="53" value={week} onChange={(e) => setWeek(e.target.value)} required style={s.input} />
          </label>
          <label style={s.label}>
            Année
            <input type="number" min="2024" max="2100" value={year} onChange={(e) => setYear(e.target.value)} required style={s.input} />
          </label>
        </div>
        <button type="submit" disabled={saving} style={s.primaryBtn}>
          {saving ? 'Publication…' : 'Publier l\'indice'}
        </button>
      </form>

      <h3 style={s.sub2}>Dernier indice publié</h3>
      {items.length === 0 ? (
        <div style={s.empty}>Aucun indice publié pour l'instant.</div>
      ) : (
        <div style={s.card}>
          {items.map((i) => (
            <div key={i.material_name} style={s.row}>
              <span>{i.material_name}</span>
              <span>{Math.round(i.avg_price_m3).toLocaleString('fr-FR')} FCFA/m³ · sem. {i.week_number}/{i.year}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  page: { padding: 24, color: 'var(--text)', maxWidth: 1000 },
  title: { margin: '0 0 6px', fontSize: 22, fontWeight: 800 },
  sub: { margin: '0 0 16px', color: 'var(--text-3)', fontSize: 14 },
  sub2: { margin: '24px 0 10px', fontSize: 15, fontWeight: 700 },
  card: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, padding: 18 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 },
  input: { padding: 10, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 },
  primaryBtn: { padding: '11px 18px', borderRadius: 8, border: 'none', background: '#D9A55B', color: '#0b0b10', fontWeight: 700, cursor: 'pointer' },
  empty: { background: 'var(--surface)', borderRadius: 12, padding: 20, color: 'var(--text-3)', textAlign: 'center' },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-2)', fontSize: 14 },
};
