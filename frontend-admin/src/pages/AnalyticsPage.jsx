import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowDownRight, ArrowUpRight, Check, Clock, Crown, Download, Pencil, Percent, Repeat, ShoppingCart,
  Star, Timer, Trophy, UserPlus, Users, X, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { dateLocale, t } from '../../../shared/i18n/dom';
import './analytics.css';

/*
 * Analyses de l'activité : indicateurs clés, chiffre d'affaires réel et projeté, objectif mensuel,
 * activité, répartition des ventes, parcours des commandes, heures de pointe et classements.
 * Rafraîchie en temps réel : le serveur prévient la console dès qu'une commande change.
 */

const PERIODS = [7, 30, 90];
const COLORS = ['#d9a55b', '#2563eb', '#16a34a', '#9333ea', '#ef476f', '#0891b2', '#f97316', '#64748b'];
const NUM = new Intl.NumberFormat('fr-FR');
const fcfa = (v) => `${NUM.format(Math.round(Number(v) || 0))} FCFA`;
const short = (v) => {
  const n = Number(v) || 0;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')} M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} k`;
  return String(Math.round(n));
};
const pct = (v, digits = 0) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits).replace('.', ',')} %`);
const dayLabel = (day, opts) => new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale(), opts);
const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Droite des moindres carrés (même calcul que le serveur) pour la tendance du graphique. */
function trendOf(values) {
  const n = values.length;
  if (n < 2) return () => values[0] || 0;
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  const slope = den ? num / den : 0;
  return (x) => Math.max(0, my + slope * (x - mx));
}

const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10, fontSize: 13 },
  labelStyle: { color: 'var(--text-strong)', fontWeight: 700 },
};

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [split, setSplit] = useState('categories');
  const daysRef = useRef(days);
  daysRef.current = days;

  const load = useCallback((period = daysRef.current, { quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    return api.get(`/admin/analytics?days=${period}`)
      .then(({ data: d }) => { setData(d); setUpdatedAt(new Date()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  // Temps réel : rafraîchissement discret à chaque changement de commande, et toutes les 5 min par sécurité
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => load(daysRef.current, { quiet: true });
    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    if (socket) {
      setLive(socket.connected);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('analytics_changed', refresh);
    }
    const timer = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      clearInterval(timer);
      socket?.off('connect', onConnect);
      socket?.off('disconnect', onDisconnect);
      socket?.off('analytics_changed', refresh);
    };
  }, [load]);

  const chart = useMemo(() => {
    if (!data) return [];
    const values = data.series.map((d) => d.revenue);
    const line = trendOf(values);
    const real = data.series.map((d, i) => ({ ...d, trend: Math.round(line(i)) }));
    const ahead = data.forecast.map((f, i) => ({ day: f.day, projection: Math.round(line(values.length + i)) }));
    // La projection part du dernier point réel pour former une ligne continue
    if (real.length) real[real.length - 1].projection = real[real.length - 1].trend;
    return [...real, ...ahead];
  }, [data]);

  const exportCsv = () => {
    if (!data) return;
    const head = ['Jour', 'Chiffre d\'affaires (FCFA)', 'Commissions (FCFA)', 'Commandes', 'Livrées', 'Annulées'].map(t);
    const rows = data.series.map((d) => [d.day, d.revenue, d.commission, d.orders, d.delivered, d.cancelled]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bennego-analyses-${data.period.from}-${data.period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) {
    return <div className="an-empty">{loading ? 'Chargement des analyses…' : 'Analyses indisponibles pour le moment.'}</div>;
  }

  const { kpis, revenue, projection, objective } = data;
  const bestClient = data.top_clients[0];
  const bestDriver = data.top_drivers[0];
  const dayTick = (d) => dayLabel(d, days === 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' });

  return (
    <div className="an" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
      <header className="an-head">
        <div>
          <h2>Vue analytique</h2>
          <p>Performance des livraisons, indicateurs clés et projections de l'activité.</p>
        </div>
        <div className="an-tools">
          <div className="an-seg" role="group" aria-label="Période analysée">
            {PERIODS.map((p) => (
              <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)}>{`${p} jours`}</button>
            ))}
          </div>
          <button type="button" className="an-btn" onClick={exportCsv}><Download size={15} aria-hidden="true" /> Exporter CSV</button>
          <span className={`an-live${live ? ' is-on' : ''}`} title={updatedAt ? `${t('Mis à jour à')} ${updatedAt.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}` : undefined}>
            <i aria-hidden="true" />{live ? 'Temps réel' : 'Hors ligne'}
          </span>
        </div>
      </header>

      {/* Indicateurs clés */}
      <section className="an-grid4" aria-label="Indicateurs clés">
        <Kpi icon={Percent} color="#16a34a" label="Taux de livraison" value={pct(kpis.delivery_rate)}
          hint={`${kpis.paid_orders} commandes payées`} />
        <Kpi icon={ShoppingCart} color="#2563eb" label="Panier moyen" value={fcfa(kpis.avg_basket)}
          hint={`${kpis.orders} commandes sur la période`} />
        <Kpi icon={Crown} color="#d9a55b" label="Meilleur client" name value={bestClient?.name || '—'}
          hint={bestClient ? fcfa(bestClient.revenue) : 'Aucune commande payée'} />
        <Kpi icon={Trophy} color="#ef476f" label="Meilleur chauffeur" name value={bestDriver?.name || '—'}
          hint={bestDriver ? `${bestDriver.deliveries} livraisons` : 'Aucune livraison'} />
      </section>

      {/* Chiffre d'affaires, projections, objectif */}
      <section className="an-grid4" aria-label="Chiffre d'affaires">
        <Money label={`CA des ${days} derniers jours`} value={revenue.total}>
          <Change value={revenue.change} />
        </Money>
        <Money label="Projection 7 jours" value={projection.next_7_days} accent="#2563eb">
          <span>{projection.trend === null ? 'Basée sur la tendance actuelle'
            : `Tendance : ${projection.trend >= 0 ? '+' : ''}${(projection.trend * 100).toFixed(1).replace('.', ',')} % par jour`}</span>
        </Money>
        <Money label="Projection fin de mois" value={projection.month_end} accent="#9333ea">
          <span>{`Réalisé à ce jour : ${fcfa(projection.month_to_date)}`}</span>
        </Money>
        <Objective objective={objective} onSaved={() => load(days, { quiet: true })} />
      </section>

      <section className="an-row">
        <div className="an-card">
          <h2>Chiffre d'affaires — réel & projeté</h2>
          <p className="an-card__sub">Barres : réalisé · Pointillés bleus : tendance et projection sur 7 jours</p>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={dayTick} interval="preserveStartEnd" minTickGap={18} stroke="var(--text-3)" fontSize={12} tickLine={false} />
              <YAxis tickFormatter={short} stroke="var(--text-3)" fontSize={12} width={48} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} labelFormatter={(d) => dayLabel(d, { weekday: 'long', day: 'numeric', month: 'long' })}
                formatter={(v, key) => [fcfa(v), t({ revenue: 'Réalisé', trend: 'Tendance', projection: 'Projection' }[key] || key)]} />
              <Bar dataKey="revenue" fill="#d9a55b" radius={[6, 6, 0, 0]} maxBarSize={34} />
              <Line dataKey="trend" stroke="#2563eb" strokeDasharray="6 5" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="projection" stroke="#2563eb" strokeDasharray="6 5" strokeWidth={2.5} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="an-card">
          <h2>Commissions par jour</h2>
          <p className="an-card__sub">{`${fcfa(revenue.commission)} sur la période`}</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={dayTick} interval="preserveStartEnd" minTickGap={18} stroke="var(--text-3)" fontSize={12} tickLine={false} />
              <YAxis tickFormatter={short} stroke="var(--text-3)" fontSize={12} width={44} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} labelFormatter={(d) => dayLabel(d, { weekday: 'long', day: 'numeric', month: 'long' })}
                formatter={(v) => [fcfa(v), t('Commissions')]} />
              <Bar dataKey="commission" fill="#16a34a" radius={[5, 5, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Indicateurs de service */}
      <section className="an-card" aria-label="Qualité de service">
        <h2>Qualité de service et clientèle</h2>
        <p className="an-card__sub">{`Période du ${dayLabel(data.period.from, { day: 'numeric', month: 'long' })} au ${dayLabel(data.period.to, { day: 'numeric', month: 'long', year: 'numeric' })}`}</p>
        <dl className="an-mini">
          <Mini icon={Timer} label="Délai moyen de livraison" value={kpis.avg_delivery_hours === null ? '—' : `${String(kpis.avg_delivery_hours).replace('.', ',')} h`} />
          <Mini icon={Clock} label="Prise en charge moyenne" value={kpis.avg_accept_minutes === null ? '—' : `${kpis.avg_accept_minutes} min`} />
          <Mini icon={Star} label="Note moyenne" value={kpis.avg_rating === null ? '—' : `${String(kpis.avg_rating).replace('.', ',')} / 5`} />
          <Mini icon={XCircle} label="Taux d'annulation" value={pct(kpis.cancellation_rate, 1)} />
          <Mini icon={Users} label="Clients actifs" value={kpis.active_clients} />
          <Mini icon={UserPlus} label="Nouveaux clients" value={kpis.new_clients} />
          <Mini icon={Repeat} label="Clients fidèles" value={pct(kpis.repeat_rate)} />
          <Mini icon={Trophy} label="Chauffeurs actifs" value={kpis.active_drivers} />
        </dl>
      </section>

      <section className="an-row an-row--half">
        <div className="an-card">
          <h2>{`Activité des ${days} derniers jours`}</h2>
          <p className="an-card__sub">Commandes créées, livrées et annulées chaque jour</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={dayTick} interval="preserveStartEnd" minTickGap={18} stroke="var(--text-3)" fontSize={12} tickLine={false} />
              <YAxis allowDecimals={false} stroke="var(--text-3)" fontSize={12} width={32} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} labelFormatter={(d) => dayLabel(d, { weekday: 'long', day: 'numeric', month: 'long' })}
                formatter={(v, key) => [v, t({ orders: 'Créées', delivered: 'Livrées', cancelled: 'Annulées' }[key])]} />
              <Legend formatter={(key) => t({ orders: 'Créées', delivered: 'Livrées', cancelled: 'Annulées' }[key])} wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="orders" stroke="#d9a55b" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="delivered" stroke="#16a34a" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="cancelled" stroke="#ef476f" strokeWidth={2} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="an-card">
          <div className="an-card__head">
            <div>
              <h2>Répartition des ventes</h2>
              <p className="an-card__sub">Part du chiffre d'affaires de la période</p>
            </div>
            <div className="an-seg" role="group" aria-label="Regrouper par">
              <button type="button" aria-pressed={split === 'categories'} onClick={() => setSplit('categories')}>Produit</button>
              <button type="button" aria-pressed={split === 'types'} onClick={() => setSplit('types')}>Service</button>
            </div>
          </div>
          <Split items={split === 'types' ? data.types : data.categories} />
        </div>
      </section>

      <section className="an-row an-row--half">
        <div className="an-card">
          <h2>Parcours des commandes</h2>
          <p className="an-card__sub">De la création à la confirmation par le client</p>
          <Funnel funnel={data.funnel} />
        </div>
        <div className="an-card">
          <h2>Heures de pointe</h2>
          <p className="an-card__sub">Commandes payées par jour et par heure (heure du Bénin)</p>
          <Heatmap cells={data.heatmap} />
        </div>
      </section>

      <section className="an-row an-row--three">
        <div className="an-card">
          <h2>Meilleurs clients</h2>
          <p className="an-card__sub">Par chiffre d'affaires sur la période</p>
          <Ranking
            rows={data.top_clients}
            empty="Aucune commande payée"
            cols={[['Commandes', (r) => r.orders], ['CA', (r) => fcfa(r.revenue)]]}
            tag={(r) => (r.returning ? 'Fidèle' : 'Nouveau')}
          />
        </div>
        <div className="an-card">
          <h2>Meilleurs chauffeurs</h2>
          <p className="an-card__sub">Par nombre de livraisons sur la période</p>
          <Ranking
            rows={data.top_drivers}
            empty="Aucune livraison"
            cols={[['Livraisons', (r) => r.deliveries], ['Note', (r) => (r.rating === null ? '—' : `${String(r.rating).replace('.', ',')} ★`)]]}
          />
        </div>
        <div className="an-card">
          <h2>Zones de livraison</h2>
          <p className="an-card__sub">Communes qui commandent le plus</p>
          <Zones zones={data.zones} />
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, color, label, value, hint, name }) {
  return (
    <div className="an-card an-kpi">
      <span className="an-kpi__icon" style={{ background: `${color}1f`, color }}><Icon size={22} aria-hidden="true" /></span>
      <div style={{ minWidth: 0 }}>
        <p className="an-kpi__label">{label}</p>
        <p className={`an-kpi__value${name ? ' an-kpi__value--name' : ''}`}>{value}</p>
        <p className="an-kpi__hint">{hint}</p>
      </div>
    </div>
  );
}

function Money({ label, value, accent, children }) {
  const [amount, unit] = [NUM.format(Math.round(value || 0)), 'FCFA'];
  return (
    <div className="an-card">
      <p className="an-money__label">{label}</p>
      <p className="an-money__value" style={accent ? { color: accent } : undefined}>{amount} <small>{unit}</small></p>
      <p className="an-money__hint">{children}</p>
    </div>
  );
}

function Change({ value }) {
  if (value === null || value === undefined) return <span>Pas de période précédente comparable</span>;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <Icon size={15} className={up ? 'an-up' : 'an-down'} aria-hidden="true" />
      <span className={up ? 'an-up' : 'an-down'}>{`${up ? '+' : ''}${(value * 100).toFixed(1).replace('.', ',')} %`}</span>
      <span>vs période précédente</span>
    </>
  );
}

function Objective({ objective, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(objective.amount));
  const progress = objective.progress || 0;
  const projected = objective.projected_progress;

  const save = async (e) => {
    e.preventDefault();
    const value = Number(amount.replace(/\s/g, ''));
    if (!Number.isFinite(value) || value < 0) return toast.error(t('Objectif invalide'));
    await api.put('/admin/analytics/objective', { amount: Math.round(value) });
    toast.success(t('Objectif mis à jour'));
    setEditing(false);
    onSaved();
  };

  return (
    <div className="an-card">
      <div className="an-card__head">
        <p className="an-money__label">Objectif mensuel</p>
        {!editing && (
          <button type="button" className="an-icon-btn" aria-label="Modifier l'objectif" onClick={() => { setAmount(String(objective.amount)); setEditing(true); }}>
            <Pencil size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="an-money__value">{pct(progress)}</p>
      <div className="an-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(progress, 1) * 100)} aria-label="Objectif atteint">
        <span style={{ width: `${Math.min(progress, 1) * 100}%` }} />
        {projected !== null && projected <= 1 && <em style={{ left: `${projected * 100}%` }} title={t('Projection fin de mois')} />}
      </div>
      {editing ? (
        <form className="an-objective" onSubmit={save}>
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Objectif mensuel (FCFA)" autoFocus />
          <button type="submit" className="an-icon-btn" aria-label="Enregistrer"><Check size={15} aria-hidden="true" /></button>
          <button type="button" className="an-icon-btn" aria-label="Annuler" onClick={() => setEditing(false)}><X size={15} aria-hidden="true" /></button>
        </form>
      ) : (
        <p className="an-money__hint">
          <span>{`Objectif : ${fcfa(objective.amount)}`}</span>
          {projected !== null && <span className={projected >= 1 ? 'an-up' : 'an-down'}>{`${pct(projected)} projeté en fin de mois`}</span>}
        </p>
      )}
    </div>
  );
}

function Mini({ icon: Icon, label, value }) {
  return (
    <div>
      <dt><Icon size={14} aria-hidden="true" />{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Split({ items }) {
  const total = items.reduce((a, i) => a + (i.revenue || 0), 0);
  if (!total) return <div className="an-empty">Aucune vente sur la période</div>;
  return (
    <div className="an-split">
      <div className="an-donut">
        <PieChart width={200} height={200}>
          <Pie data={items} dataKey="revenue" nameKey="label" cx={100} cy={100} innerRadius={58} outerRadius={92}
            paddingAngle={2} stroke="none" isAnimationActive={false}>
            {items.map((item, i) => <Cell key={item.label} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v, name) => [fcfa(v), t(name)]} />
        </PieChart>
      </div>
      <ul>
        {items.map((item, i) => (
          <li key={item.label}>
            <i style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
            <span>{item.label}<small>{`${item.orders} commandes`}</small></span>
            <b>{pct(item.revenue / total)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Funnel({ funnel }) {
  const steps = [
    ['created', 'Créées', '#94a3b8'],
    ['paid', 'Payées', '#d9a55b'],
    ['accepted', 'Prises en charge', '#2563eb'],
    ['delivered', 'Livrées', '#16a34a'],
    ['confirmed', 'Confirmées par le client', '#9333ea'],
  ];
  const top = funnel.created || 0;
  if (!top) return <div className="an-empty">Aucune commande sur la période</div>;
  return (
    <div className="an-funnel">
      {steps.map(([key, label, color], i) => {
        const value = funnel[key] || 0;
        const prev = i ? funnel[steps[i - 1][0]] || 0 : null;
        return (
          <div key={key} className="an-funnel__row">
            <span>{label}</span>
            <div className="an-funnel__track"><div className="an-funnel__fill" style={{ width: `${(value / top) * 100}%`, background: color }} /></div>
            <span><b>{value}</b> <small>{prev ? pct(value / prev) : ''}</small></span>
          </div>
        );
      })}
    </div>
  );
}

function Heatmap({ cells }) {
  const hours = Array.from({ length: 17 }, (_, i) => i + 5); // 5 h → 21 h
  const map = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.orders]));
  const max = Math.max(1, ...cells.map((c) => c.orders));
  const shade = (v) => (v ? `rgba(217, 165, 91, ${0.18 + (0.82 * v) / max})` : 'var(--surface-3)');
  if (!cells.length) return <div className="an-empty">Aucune commande payée sur la période</div>;
  return (
    <div className="an-heat">
      <table>
        <thead>
          <tr><td aria-hidden="true" />{hours.map((h) => <th key={h} scope="col">{h % 2 ? '' : `${h}h`}</th>)}</tr>
        </thead>
        <tbody>
          {DOW.map((d, i) => (
            <tr key={d}>
              <th scope="row">{d}</th>
              {hours.map((h) => {
                const v = map.get(`${i + 1}-${h}`) || 0;
                return <td key={h} style={{ background: shade(v) }} title={`${t(d)} ${h}h : ${v} ${t('commande(s)')}`} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="an-heat__scale">
        <span>Moins</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => <span key={v} className="an-heat__swatch" style={{ background: v ? `rgba(217, 165, 91, ${0.18 + 0.82 * v})` : 'var(--surface-3)' }} />)}
        <span>Plus</span>
      </div>
    </div>
  );
}

function Ranking({ rows, cols, empty, tag }) {
  if (!rows.length) return <div className="an-empty">{empty}</div>;
  return (
    <table className="an-table">
      <thead>
        <tr><th>Nom</th>{cols.map(([label]) => <th key={label} className="num">{label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id}>
            <td>
              <span className={`an-rank${i === 0 ? ' an-rank--1' : ''}`}>{i + 1}</span>
              <span translate="no">{r.name}</span>
              {tag && <span className="an-tag">{tag(r)}</span>}
            </td>
            {cols.map(([label, get]) => <td key={label} className="num">{get(r)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Zones({ zones }) {
  if (!zones.length) return <div className="an-empty">Aucune livraison sur la période</div>;
  const max = Math.max(...zones.map((z) => z.revenue));
  return (
    <div className="an-zones">
      {zones.map((z) => (
        <div key={z.zone}>
          <p><span translate="no">{z.zone}</span><b>{fcfa(z.revenue)}</b></p>
          <span className="an-zones__bar"><i style={{ width: `${(z.revenue / max) * 100}%` }} /></span>
        </div>
      ))}
    </div>
  );
}
