import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { dateLocale, t } from '../../../shared/i18n/dom';

/*
 * Prix du marché : chaque semaine, l'équipe publie le prix d'un voyage de matériau selon la taille du camion,
 * avec les noms utilisés au Bénin. Les clients les voient sur leur accueil et pendant la commande.
 * La tendance (hausse, baisse, stable) se calcule toute seule par rapport à la semaine précédente.
 */

const NUM = new Intl.NumberFormat('fr-FR');
const fcfa = (v) => `${NUM.format(Math.round(Number(v) || 0))} FCFA`;
const iso = (d) => d.toISOString().slice(0, 10);
const mondayOf = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
};
const shift = (d, days) => new Date(d.getTime() + days * 86400000);
const shortDate = (isoDay) => new Date(`${isoDay}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
const period = (start, end) => `du ${shortDate(start)} au ${shortDate(end)}`;
const TREND = { up: ['↑', 'Hausse', 'var(--danger)'], down: ['↓', 'Baisse', 'var(--success)'], stable: ['→', 'Stable', 'var(--text-3)'] };

const EMPTY = { material_key: '', truck_size: '10_roues', price_min: '', price_avg: '', price_max: '' };

export default function BarometerAdminPage() {
  const [catalog, setCatalog] = useState({ materials: [], trucks: [] });
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // Semaines proposées : la semaine dernière (rattrapage), cette semaine, la semaine prochaine
  const weeks = useMemo(() => {
    const monday = mondayOf(new Date());
    return [[-7, 'Semaine dernière'], [0, 'Cette semaine'], [7, 'Semaine prochaine']].map(([days, label]) => {
      const start = shift(monday, days);
      return { value: iso(start), label: `${t(label)} (${t(period(iso(start), iso(shift(start, 6))))})` };
    });
  }, []);
  const [week, setWeek] = useState(() => iso(mondayOf(new Date())));

  const load = async () => {
    try {
      const [{ data: cat }, { data }] = await Promise.all([api.get('/barometer/catalog'), api.get('/barometer')]);
      setCatalog({ materials: (cat?.materials || []).filter((m) => m.voyage), trucks: cat?.trucks || [] });
      setItems(data?.items || []);
    } catch { /* intercepteur */ }
  };

  useEffect(() => { load(); }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const publish = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/barometer', {
        ...form,
        price_min: Number(form.price_min), price_avg: Number(form.price_avg), price_max: Number(form.price_max),
        week_start: week,
      });
      toast.success(t('Prix publié : les clients le voient sur leur accueil'));
      setForm({ ...EMPTY, truck_size: form.truck_size });
      await load();
    } catch { /* intercepteur */ } finally {
      setSaving(false);
    }
  };

  // Reprendre un prix publié pour le corriger ou le mettre à jour
  const edit = (item) => {
    setForm({ material_key: item.material_key, truck_size: item.truck_size, price_min: item.price_min, price_avg: item.price_avg, price_max: item.price_max });
    if (weeks.some((w) => w.value === item.week_start)) setWeek(item.week_start);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const material = catalog.materials.find((m) => m.key === form.material_key);
  const truck = catalog.trucks.find((tr) => tr.key === form.truck_size);
  const byMaterial = catalog.materials
    .map((m) => ({ ...m, rows: items.filter((i) => i.material_key === m.key) }))
    .filter((m) => m.rows.length);

  return (
    <div style={s.page}>
      <h2 style={s.title}>Prix du marché</h2>
      <p style={s.sub}>
        Publiez chaque semaine le prix d'un voyage selon le camion. Les clients le voient sur leur accueil et pendant la commande.
      </p>

      <form onSubmit={publish} style={s.card}>
        <div style={s.grid}>
          <label style={s.label}>
            Matériau
            <select value={form.material_key} onChange={set('material_key')} required style={s.input}>
              <option value="">Choisir un matériau</option>
              {catalog.materials.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
            </select>
          </label>
          <label style={s.label}>
            Camion
            <select value={form.truck_size} onChange={set('truck_size')} required style={s.input}>
              {catalog.trucks.map((tr) => <option key={tr.key} value={tr.key}>{tr.name}</option>)}
            </select>
          </label>
          <label style={s.label}>
            Semaine
            <select value={week} onChange={(e) => setWeek(e.target.value)} style={s.input}>
              {weeks.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </label>
        </div>
        <div style={s.grid}>
          <label style={s.label}>
            Prix le plus bas (FCFA le voyage)
            <input type="number" min="1" step="any" inputMode="numeric" value={form.price_min} onChange={set('price_min')} required style={s.input} />
          </label>
          <label style={s.label}>
            Prix courant (FCFA le voyage)
            <input type="number" min="1" step="any" inputMode="numeric" value={form.price_avg} onChange={set('price_avg')} required style={s.input} />
          </label>
          <label style={s.label}>
            Prix le plus haut (FCFA le voyage)
            <input type="number" min="1" step="any" inputMode="numeric" value={form.price_max} onChange={set('price_max')} required style={s.input} />
          </label>
        </div>
        {material && truck && Number(form.price_avg) > 0 && (
          <p style={s.preview}>
            {`Les clients verront : ${material.name}, ${truck.name.toLowerCase()} — ${fcfa(form.price_avg)} le voyage`}
            {Number(form.price_min) > 0 && Number(form.price_max) > 0 && ` (${t('entre')} ${fcfa(form.price_min)} ${t('et')} ${fcfa(form.price_max)})`}
          </p>
        )}
        <button type="submit" disabled={saving} style={s.primaryBtn}>
          {saving ? 'Publication…' : 'Publier le prix'}
        </button>
      </form>

      <h3 style={s.sub2}>Derniers prix publiés</h3>
      {byMaterial.length === 0 ? (
        <div style={s.empty}>Aucun prix publié pour l'instant.</div>
      ) : (
        <div style={s.card}>
          {byMaterial.map((m) => (
            <div key={m.key} style={s.group}>
              <strong style={s.groupTitle}>{m.name}</strong>
              {m.rows.map((i) => {
                const [arrow, label, color] = TREND[i.trend] || TREND.stable;
                return (
                  <button key={i.id} type="button" style={s.row} onClick={() => edit(i)} title={t('Reprendre ce prix pour le modifier')}>
                    <span>{i.truck_name}</span>
                    <span style={s.price}>
                      <b>{`${fcfa(i.price_avg)} le voyage`}</b>
                      <small style={s.muted}>{period(i.week_start, i.week_end)}</small>
                    </span>
                    <span style={{ ...s.trend, color }} aria-label={t(label)}>
                      {arrow} {i.change === null ? t(label) : `${i.change > 0 ? '+' : ''}${(i.change * 100).toFixed(0)} %`}
                    </span>
                  </button>
                );
              })}
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12, marginBottom: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 },
  input: { padding: 10, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 },
  preview: { margin: '0 0 14px', padding: '10px 12px', borderRadius: 8, background: 'var(--brand-soft)', color: 'var(--brand-ink)', fontSize: 13.5, fontWeight: 600 },
  primaryBtn: { padding: '11px 18px', borderRadius: 8, border: 'none', background: '#D9A55B', color: '#0b0b10', fontWeight: 700, cursor: 'pointer' },
  empty: { background: 'var(--surface)', borderRadius: 12, padding: 20, color: 'var(--text-3)', textAlign: 'center' },
  group: { display: 'grid', gap: 2, padding: '10px 0', borderBottom: '1px solid var(--border-2)' },
  groupTitle: { fontSize: 14.5, color: 'var(--text-strong)', marginBottom: 4 },
  row: {
    display: 'grid', gridTemplateColumns: 'minmax(110px, 1fr) minmax(0, 2fr) auto', alignItems: 'center', gap: 12, width: '100%',
    padding: '8px 6px', border: 0, borderRadius: 8, background: 'none', font: 'inherit', fontSize: 14, color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
  },
  price: { display: 'grid', gap: 1 },
  muted: { fontSize: 12, color: 'var(--text-3)' },
  trend: { fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' },
};
