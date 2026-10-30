import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, Boxes, Building2, ChartSpline, CheckCircle2, Clock,
  CreditCard, Download, FileChartColumn, Gift, Laptop, Moon, Package, Repeat, Scale, Shovel, Star, Sun,
  Truck, UserPlus, Users, Wrench,
} from 'lucide-react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import useAdminStore from '../store/adminStore';
import { ORDER_STATUS, PAYMENT_STATUS, initials, truckLabel } from '../utils/format';
import { dateLocale, t } from '../../../shared/i18n/dom';
import './dashboard.css';

/*
 * Tableau de bord de la console : statistiques rapides, chiffre d'affaires sur 12 mois, activité de la semaine,
 * progression des commandes, services, commandes par mois, commandes récentes, points à traiter, carte en direct,
 * chauffeurs, clients, paiements, avis et rapports. Thème sombre ou clair selon l'appareil (ou forcé),
 * rafraîchi en temps réel quand une commande change.
 */

const THEME_KEY = 'bennego-admin-dashboard-theme';
const PERIODS = [[7, 'Semaine'], [30, 'Mois'], [90, 'Trimestre']];
const COLORS = ['#d9a55b', '#f1cd8e', '#9c6a24', '#60a5fa', '#a78bfa', '#4ade80', '#f87171', '#94a3b8'];
const NUM = new Intl.NumberFormat('fr-FR');
const fcfa = (v) => `${NUM.format(Math.round(Number(v) || 0))} FCFA`;
const short = (v) => {
  const n = Number(v) || 0;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')} M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} k`;
  return String(Math.round(n));
};
const pct = (v, digits = 0) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits).replace('.', ',')} %`);
const date = (d, opts = { day: 'numeric', month: 'short' }) => (d ? new Date(d).toLocaleDateString(dateLocale(), opts) : '—');
const time = (d) => (d ? new Date(d).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : '');
const monthLabel = (m) => new Date(`${m}-15T12:00:00`).toLocaleDateString(dateLocale(), { month: 'short' });
const SERVICE_ICON = { "Location d'engins": Shovel, 'Évacuation de gravats': Truck };

const readTheme = () => {
  try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; }
};

/** Thème choisi (auto / clair / sombre) et thème appliqué, qui suit l'appareil en mode auto. */
function useTheme() {
  const [choice, setChoice] = useState(readTheme);
  const [system, setSystem] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => setSystem(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const choose = (value) => {
    setChoice(value);
    try { localStorage.setItem(THEME_KEY, value); } catch { /* stockage indisponible */ }
  };
  return { choice, choose, theme: choice === 'auto' ? (system ? 'dark' : 'light') : choice };
}

const tip = {
  contentStyle: { background: 'var(--db-card)', border: '1px solid var(--db-line-2)', borderRadius: 12, fontSize: 13, color: 'var(--db-text)' },
  labelStyle: { color: 'var(--db-strong)', fontWeight: 700 },
  itemStyle: { color: 'var(--db-text)' },
  cursor: { fill: 'var(--db-gold-soft)' },
};

export default function DashboardPage() {
  const user = useAdminStore((s) => s.user);
  const { choice, choose, theme } = useTheme();
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [live, setLive] = useState(false);
  const daysRef = useRef(days);
  daysRef.current = days;

  const load = useCallback((period = daysRef.current) => api.get(`/admin/dashboard?days=${period}`)
    // Réponse incomplète (serveur ancien ou en erreur) : « indisponible » plutôt qu'un écran planté
    .then(({ data: d }) => { if (d?.kpis && d?.monthly) { setData(d); setFailed(false); } else setFailed(true); })
    .catch(() => setFailed(true)), []);

  useEffect(() => { load(days); }, [days, load]);

  // Temps réel : chaque commande payée ou qui change de statut rafraîchit le tableau de bord
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => load();
    const on = () => setLive(true);
    const off = () => setLive(false);
    if (socket) {
      setLive(socket.connected);
      socket.on('connect', on);
      socket.on('disconnect', off);
      socket.on('analytics_changed', refresh);
    }
    const timer = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      clearInterval(timer);
      socket?.off('connect', on);
      socket?.off('disconnect', off);
      socket?.off('analytics_changed', refresh);
    };
  }, [load]);

  const firstName = user?.prenom || (user?.full_name || '').split(' ')[0] || '';

  return (
    <div className="db" data-theme={theme}>
      <header className="db-head">
        <div>
          <h2>{firstName ? `Bon retour, ${firstName} 👋` : 'Bon retour 👋'}</h2>
          <p>Voici ce qui se passe sur BenneGo aujourd'hui.</p>
        </div>
        <div className="db-tools">
          <span className={`db-live${live ? ' is-on' : ''}`}><i aria-hidden="true" />{live ? 'Temps réel' : 'Hors ligne'}</span>
          <div className="db-seg" role="group" aria-label="Période">
            {PERIODS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>{label}</button>
            ))}
          </div>
          <div className="db-seg db-seg--icons" role="group" aria-label="Thème du tableau de bord">
            {[['auto', Laptop, "Comme l'appareil"], ['light', Sun, 'Thème clair'], ['dark', Moon, 'Thème sombre']].map(([value, Icon, label]) => (
              <button key={value} type="button" aria-pressed={choice === value} onClick={() => choose(value)} title={label} aria-label={label}>
                <Icon size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
          <Link to="/analytics" className="db-btn db-btn--gold"><ChartSpline size={15} aria-hidden="true" /> Analyses détaillées</Link>
        </div>
      </header>

      {!data ? (
        <div className="db-empty">{failed ? 'Tableau de bord indisponible pour le moment.' : 'Chargement du tableau de bord…'}</div>
      ) : (
        <Board data={data} days={days} theme={theme} />
      )}
    </div>
  );
}

function Board({ data, days, theme }) {
  const { kpis, revenue, comparisons, live, alerts, totals } = data;
  const periodLabel = { 7: 'vs semaine précédente', 30: 'vs mois précédent', 90: 'vs trimestre précédent' }[days];

  return (
    <>
      {/* Statistiques rapides */}
      <section className="db-stats" aria-label="Statistiques rapides">
        <Stat hero icon={Banknote} label="Chiffre d'affaires" to="/payments"
          value={<>{NUM.format(Math.round(revenue.total))} <small>FCFA</small></>} change={revenue.change} sub={periodLabel} />
        <Stat icon={UserPlus} label="Nouveaux clients" to="/clients" value={kpis.new_clients}
          change={comparisons.new_clients_change} sub={periodLabel} />
        <Stat icon={Package} label="Commandes" to="/orders" value={kpis.orders} change={revenue.orders_change} sub={periodLabel} />
        <Stat icon={Truck} label="Courses en cours" to="/orders" value={live.active_orders}
          sub={`${live.drivers_online} chauffeurs en ligne sur ${live.drivers_total}`} />
        <Stat icon={CheckCircle2} label="Taux de livraison" to="/analytics" value={pct(kpis.delivery_rate, 1)}
          change={kpis.delivery_rate !== null && comparisons.delivery_rate_previous
            ? kpis.delivery_rate / comparisons.delivery_rate_previous - 1 : null} sub={periodLabel} />
      </section>

      <section className="db-row db-row--a">
        <RevenueCard monthly={data.monthly} />
        <WeekCard week={data.week} />
        <ProgressCard funnel={data.funnel} />
      </section>

      <section className="db-row db-row--b">
        <TopServices categories={data.categories} />
        <RevenueRing types={data.types} total={revenue.total} />
        <MonthlyOrders monthly={data.monthly} />
      </section>

      <section className="db-row db-row--c">
        <RecentOrders orders={data.recent_orders} />
        <div className="db-row">
          <Todo alerts={alerts} />
          <Approvals approvals={data.approvals} />
        </div>
      </section>

      <section className="db-row db-row--b">
        <Drivers drivers={data.drivers} />
        <Clients clients={data.recent_clients} />
        <LiveMap points={data.map} theme={theme} alerts={alerts} />
      </section>

      <section className="db-row db-row--b">
        <Payments payments={data.payments} />
        <Reviews reviews={data.reviews} />
        <Reports />
      </section>

      <section className="db-bottom" aria-label="Clientèle">
        <Total icon={Users} label="Clients au total" value={NUM.format(totals.clients)} change={totals.clients_change} sub="vs début du mois" />
        <Total icon={Building2} label="Entreprises B2B actives" value={totals.companies} sub="Abonnements en cours" />
        <Total icon={Repeat} label="Clients fidèles" value={pct(totals.repeat_rate)} sub="Au moins 2 commandes sur la période" />
      </section>
    </>
  );
}

function Trend({ value, sub }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <p className="db-stat__trend">{sub}</p>;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="db-stat__trend">
      <Icon size={14} className={up ? 'db-up' : 'db-down'} aria-hidden="true" />
      <span className={up ? 'db-up' : 'db-down'}>{`${up ? '+' : ''}${(value * 100).toFixed(1).replace('.', ',')} %`}</span>
      <span>{sub}</span>
    </p>
  );
}

function Stat({ icon: Icon, label, value, change, sub, to, hero }) {
  return (
    <article className={`db-stat${hero ? ' db-stat--hero' : ''}`}>
      <div className="db-stat__top">
        <span className="db-stat__icon"><Icon size={21} aria-hidden="true" /></span>
        <Link to={to} className="db-stat__go" aria-label={`${t('Voir')} : ${t(label)}`}><ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
      <p className="db-stat__label">{label}</p>
      <p className="db-stat__value">{value}</p>
      <Trend value={change} sub={sub} />
    </article>
  );
}

function Card({ title, sub, action, children, className = '' }) {
  return (
    <article className={`db-card ${className}`}>
      <div className="db-card__head">
        <div>
          <h3>{title}</h3>
          {sub && <p className="db-card__sub">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </article>
  );
}

const ViewAll = ({ to }) => <Link to={to} className="db-link">Voir tout</Link>;

function RevenueCard({ monthly }) {
  const data = monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const last = data[data.length - 1]?.revenue || 0;
  const prev = data[data.length - 2]?.revenue || 0;
  return (
    <Card title="Aperçu du chiffre d'affaires" sub="12 derniers mois" action={<Link to="/report" className="db-link">Rapport mensuel</Link>}>
      <p className="db-stat__value">{NUM.format(Math.round(last))} <small>FCFA</small></p>
      <Trend value={prev ? last / prev - 1 : null} sub="ce mois-ci vs mois dernier" />
      <div translate="no">
        <ResponsiveContainer width="100%" height={210}>
        <AreaChart data={data} margin={{ top: 12, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="db-gold-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d9a55b" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#d9a55b" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--db-line)" vertical={false} />
          <XAxis dataKey="label" stroke="var(--db-muted)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={short} stroke="var(--db-muted)" fontSize={12} width={44} tickLine={false} axisLine={false} />
          <Tooltip {...tip} formatter={(v) => [fcfa(v), t("Chiffre d'affaires")]} />
          <Area type="monotone" dataKey="revenue" stroke="#d9a55b" strokeWidth={2.5} fill="url(#db-gold-fill)"
            dot={{ r: 3, fill: '#d9a55b', strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer></div>
    </Card>
  );
}

function WeekCard({ week }) {
  const max = Math.max(1, ...week.map((d) => d.orders));
  const top = Math.max(...week.map((d) => d.orders));
  const total = week.reduce((a, d) => a + d.orders, 0);
  const todayIndex = week.findIndex((d) => d.future) - 1;
  const today = todayIndex >= 0 ? todayIndex : week.length - 1;
  return (
    <Card title="Activité de la semaine" sub={`${total} commandes depuis lundi`}>
      <div className="db-week">
        {week.map((d, i) => (
          <div key={d.day} className="db-week__col" title={`${date(d.day, { weekday: 'long', day: 'numeric', month: 'long' })} : ${d.orders} ${t('commande(s)')}`}>
            <div className="db-week__track">
              <div
                className={`db-week__bar${d.future ? ' is-future' : i === today ? ' is-today' : d.orders === top && top ? ' is-top' : ''}`}
                style={{ height: d.future ? '45%' : `${Math.max(10, (d.orders / max) * 100)}%` }}
              />
            </div>
            {i === today && <span className="db-week__tip">{d.orders}</span>}
            <small>{date(d.day, { weekday: 'narrow' })}</small>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProgressCard({ funnel }) {
  const done = funnel.confirmed || 0;
  const delivered = Math.max(0, (funnel.delivered || 0) - done);
  const running = Math.max(0, (funnel.accepted || 0) - (funnel.delivered || 0));
  const waiting = Math.max(0, (funnel.paid || 0) - (funnel.accepted || 0));
  const total = done + delivered + running + waiting;
  const parts = [[done, 'var(--db-gold)'], [delivered, 'var(--db-gold-2)'], [running, '#9c6a24']];
  // Demi-cercle : 180° partagés entre terminées, livrées, en cours ; le reste (en attente) est hachuré
  const R = 90;
  const len = Math.PI * R;
  let offset = 0;
  return (
    <Card title="Progression des commandes" sub="Commandes payées de la période">
      {total ? (
        <>
          <div className="db-gauge">
            <svg viewBox="0 0 220 125" role="img" aria-label={`${pct(done / total)} ${t('terminées')}`}>
              <defs>
                <pattern id="db-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="var(--db-card)" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--db-line-2)" strokeWidth="3" />
                </pattern>
              </defs>
              <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="url(#db-hatch)" strokeWidth="26" strokeLinecap="round" />
              {parts.map(([value, color]) => {
                const dash = (value / total) * len;
                const el = (
                  <path key={color} d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke={color} strokeWidth="26"
                    strokeDasharray={`${dash} ${len}`} strokeDashoffset={-offset} />
                );
                offset += dash;
                return value ? el : null;
              })}
            </svg>
            <div className="db-gauge__value"><strong>{pct(done / total)}</strong><span>Commandes terminées</span></div>
          </div>
          <div className="db-keys">
            <span><i style={{ background: 'var(--db-gold)' }} />{`Terminées ${done}`}</span>
            <span><i style={{ background: 'var(--db-gold-2)' }} />{`Livrées ${delivered}`}</span>
            <span><i style={{ background: '#9c6a24' }} />{`En cours ${running}`}</span>
            <span><i style={{ background: 'var(--db-hatch)', border: '1px solid var(--db-line-2)' }} />{`En attente ${waiting}`}</span>
          </div>
        </>
      ) : <div className="db-empty">Aucune commande payée sur la période</div>}
    </Card>
  );
}

function TopServices({ categories }) {
  const max = Math.max(1, ...categories.map((c) => c.revenue));
  return (
    <Card title="Services les plus vendus" action={<ViewAll to="/analytics" />}>
      {categories.length ? (
        <ul className="db-bars">
          {categories.slice(0, 5).map((c) => {
            const Icon = SERVICE_ICON[c.label] || Boxes;
            return (
              <li key={c.label}>
                <span className="db-bars__icon"><Icon size={16} aria-hidden="true" /></span>
                <div>
                  <span>{c.label}</span>
                  <div className="db-bars__track"><i style={{ width: `${(c.revenue / max) * 100}%` }} /></div>
                </div>
                <b>{fcfa(c.revenue)}</b>
              </li>
            );
          })}
        </ul>
      ) : <div className="db-empty">Aucune vente sur la période</div>}
    </Card>
  );
}

function RevenueRing({ types, total }) {
  const sum = types.reduce((a, x) => a + x.revenue, 0);
  return (
    <Card title="Chiffre d'affaires par service">
      {sum ? (
        <div className="db-ring">
          <div className="db-ring__chart">
            <PieChart width={180} height={180}>
              <Pie data={types} dataKey="revenue" nameKey="label" cx={90} cy={90} innerRadius={58} outerRadius={86}
                paddingAngle={2} stroke="none" isAnimationActive={false}>
                {types.map((x, i) => <Cell key={x.type} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tip} formatter={(v, name) => [fcfa(v), t(name)]} />
            </PieChart>
            <div className="db-ring__center"><strong>{short(total)}</strong><span>FCFA</span></div>
          </div>
          <ul>
            {types.map((x, i) => (
              <li key={x.type}>
                <i style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
                <span>{x.label}<small>{`${pct(x.revenue / sum, 1)} · ${fcfa(x.revenue)}`}</small></span>
              </li>
            ))}
          </ul>
        </div>
      ) : <div className="db-empty">Aucune vente sur la période</div>}
    </Card>
  );
}

function MonthlyOrders({ monthly }) {
  const data = monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const year = data.reduce((a, m) => a + m.orders, 0);
  return (
    <Card title="Commandes par mois" sub={`${year} commandes sur 12 mois`}>
      <div translate="no">
        <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={3}>
          <CartesianGrid stroke="var(--db-line)" vertical={false} />
          <XAxis dataKey="label" stroke="var(--db-muted)" fontSize={11.5} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={6} />
          <YAxis allowDecimals={false} stroke="var(--db-muted)" fontSize={12} width={30} tickLine={false} axisLine={false} />
          <Tooltip {...tip} formatter={(v, key) => [v, t({ orders: 'Commandes', delivered: 'Livrées' }[key])]} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(key) => t({ orders: 'Commandes', delivered: 'Livrées' }[key])} />
          <Bar dataKey="orders" fill="#d9a55b" radius={[6, 6, 6, 6]} maxBarSize={9} />
          <Bar dataKey="delivered" fill="var(--db-gold-2)" fillOpacity={0.45} radius={[6, 6, 6, 6]} maxBarSize={9} />
        </BarChart>
      </ResponsiveContainer></div>
    </Card>
  );
}

const STATUS_FILTERS = [
  ['all', 'Tous les statuts'],
  ['active', 'En cours'],
  ['done', 'Terminées'],
  ['awaiting_payment', 'À payer'],
  ['cancelled', 'Annulées'],
];
const isActive = (s) => ['pending', 'accepted', 'driver_en_route_pickup', 'loading', 'driver_en_route_delivery', 'machine_operating', 'dumping', 'delivered'].includes(s);

function StatusPill({ status }) {
  const st = ORDER_STATUS[status] || { label: status, tone: 'neutral' };
  return <span className={`db-pill db-pill--${st.tone}`}>{st.label}</span>;
}

function RecentOrders({ orders }) {
  const [filter, setFilter] = useState('all');
  const rows = useMemo(() => orders.filter((o) => (
    filter === 'all' ? true
      : filter === 'active' ? isActive(o.status)
        : filter === 'done' ? ['validated', 'completed'].includes(o.status)
          : o.status === filter
  )).slice(0, 10), [orders, filter]);

  const exportCsv = () => {
    const head = ['Commande', 'Client', 'Service', 'Date', 'Statut', 'Montant (FCFA)'].map(t);
    const lines = rows.map((o) => [o.order_number, o.client || '', t(o.service), new Date(o.created_at).toISOString(),
      t(ORDER_STATUS[o.status]?.label || o.status), Math.round(o.amount)]);
    const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bennego-commandes-recentes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      title="Commandes récentes"
      action={(
        <div className="db-tools">
          <select className="db-select" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrer par statut">
            {STATUS_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" className="db-btn db-btn--gold" onClick={exportCsv}><Download size={14} aria-hidden="true" /> Exporter</button>
          <ViewAll to="/orders" />
        </div>
      )}
    >
      {rows.length ? (
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr><th>Commande</th><th>Client et service</th><th>Statut</th><th className="num">Montant</th></tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td><strong translate="no">{o.order_number}</strong><small>{`${date(o.created_at)} · ${time(o.created_at)}`}</small></td>
                  <td className="wrap"><span translate="no">{o.client || '—'}</span><small>{o.service}</small></td>
                  <td><StatusPill status={o.status} /></td>
                  <td className="num"><strong>{fcfa(o.amount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="db-empty">Aucune commande pour ce statut</div>}
    </Card>
  );
}

function Todo({ alerts }) {
  const items = [
    ['/orders', Clock, 'Commandes sans chauffeur', 'Payées depuis plus de 30 min', alerts.unassigned, 'var(--db-gold-soft)', 'var(--db-gold)'],
    ['/disputes', Scale, 'Litiges ouverts', 'Paiement bloqué jusqu\'à décision', alerts.disputes, 'var(--db-red-soft)', 'var(--db-red)'],
    ['/reliefs', Wrench, 'Pannes à relever', 'Course à réassigner', alerts.reliefs, 'var(--db-red-soft)', 'var(--db-red)'],
    ['/payments', CreditCard, 'Versements chauffeurs', fcfa(alerts.payouts_amount), alerts.payouts, 'var(--db-blue-soft)', 'var(--db-blue)'],
    ['/referrals', Gift, 'Retraits de crédit', 'Demandés par les parrains', alerts.credit_payouts, 'var(--db-violet-soft)', 'var(--db-violet)'],
  ];
  return (
    <Card title="À traiter" sub="Ce qui attend une action de l'équipe">
      <ul className="db-todo">
        {items.map(([to, Icon, label, sub, count, bg, color]) => (
          <li key={label}>
            <Link to={to} className={count ? '' : 'is-calm'}>
              <span className="db-todo__icon" style={{ background: bg, color }}><Icon size={17} aria-hidden="true" /></span>
              <span><strong>{label}</strong><small>{sub}</small></span>
              <b>{count}</b>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Approvals({ approvals }) {
  return (
    <Card title="Chauffeurs à vérifier" sub="Papiers en attente de validation" action={<ViewAll to="/drivers" />}>
      {approvals.length ? (
        <ul className="db-people">
          {approvals.map((d) => (
            <li key={d.id}>
              <span className="db-avatar" aria-hidden="true">{initials(d.name)}</span>
              <span><strong translate="no">{d.name}</strong><small>{`${t(truckLabel(d.truck_type))} · ${date(d.created_at)}`}</small></span>
              <span className="db-pill db-pill--warning">En attente</span>
            </li>
          ))}
        </ul>
      ) : <div className="db-empty">Aucun chauffeur en attente</div>}
    </Card>
  );
}

function Drivers({ drivers }) {
  return (
    <Card title="Chauffeurs" sub="Vérifiés, en ligne d'abord" action={<ViewAll to="/drivers" />}>
      {drivers.length ? (
        <ul className="db-people">
          {drivers.map((d) => (
            <li key={d.id}>
              <span className="db-avatar" aria-hidden="true">{initials(d.name)}</span>
              <span>
                <strong translate="no">{d.name}</strong>
                <small>{d.current_order
                  ? <>{`${t('Course')} `}<span translate="no">{d.current_order}</span></>
                  : `${t(truckLabel(d.truck_type))} · ${d.deliveries} ${t('livraisons')}${d.rating ? ` · ${String(d.rating).replace('.', ',')} ★` : ''}`}</small>
              </span>
              {d.current_order
                ? <span className="db-pill db-pill--info">En course</span>
                : d.is_available ? <span className="db-pill db-pill--success">En ligne</span>
                  : <span className="db-pill db-pill--neutral">Hors ligne</span>}
            </li>
          ))}
        </ul>
      ) : <div className="db-empty">Aucun chauffeur vérifié</div>}
    </Card>
  );
}

function Clients({ clients }) {
  return (
    <Card title="Clients récents" sub="Dernières commandes passées" action={<ViewAll to="/clients" />}>
      {clients.length ? (
        <ul className="db-people">
          {clients.map((c) => (
            <li key={c.id}>
              <span className="db-avatar" aria-hidden="true">{initials(c.name)}</span>
              <span><strong translate="no">{c.name}</strong><small>{`${c.phone} · ${c.orders} ${t('commandes')}`}</small></span>
              <strong>{fcfa(c.spent)}</strong>
            </li>
          ))}
        </ul>
      ) : <div className="db-empty">Aucun client</div>}
    </Card>
  );
}

const PIN_COLORS = { MATERIAL: '#d9a55b', RENTAL: '#60a5fa', EVACUATION: '#a78bfa' };

function LiveMap({ points, theme, alerts }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const tiles = useRef(null);

  useEffect(() => {
    if (!box.current || map.current) return undefined;
    map.current = L.map(box.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([6.4, 2.35], 10);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    tiles.current?.remove();
    tiles.current = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${theme === 'dark' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`, {
      attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 18,
    }).addTo(map.current);
  }, [theme]);

  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    const bounds = [];
    points.forEach((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
      const driver = p.kind === 'driver';
      const color = driver ? '#4ade80' : PIN_COLORS[p.type] || '#d9a55b';
      const icon = L.divIcon({
        className: '',
        html: `<div class="db-pin${driver ? ' db-pin--driver' : ''}" style="background:${color}"><span>${driver ? '🚚' : ''}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      const label = driver ? `${p.label} · ${t('En ligne')}` : `${p.label} · ${t(ORDER_STATUS[p.status]?.label || p.status)}`;
      // Texte (et non HTML) : le nom du chauffeur est saisi par l'utilisateur
      const tooltip = document.createElement('span');
      tooltip.textContent = label;
      L.marker([p.lat, p.lng], { icon, title: label }).bindTooltip(tooltip).addTo(layer.current);
      bounds.push([p.lat, p.lng]);
    });
    if (bounds.length > 1) map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  }, [points]);

  const count = (type) => points.filter((p) => p.kind === 'order' && p.type === type).length;
  return (
    <Card title="Carte d'activité" sub="Commandes en cours et chauffeurs en ligne">
      <div className="db-map" ref={box} />
      <div className="db-map__counts">
        <div><small>Matériaux</small><b>{count('MATERIAL')}</b></div>
        <div><small>Engins</small><b>{count('RENTAL')}</b></div>
        <div><small>Évacuations</small><b>{count('EVACUATION')}</b></div>
        <div><small>Litiges</small><b>{alerts.disputes}</b></div>
      </div>
    </Card>
  );
}

function Payments({ payments }) {
  return (
    <Card title="Paiements récents" action={<ViewAll to="/payments" />}>
      {payments.length ? (
        <div className="db-table-wrap">
          <table className="db-table">
            <thead><tr><th>Commande</th><th className="num">Montant</th><th>Statut</th></tr></thead>
            <tbody>
              {payments.map((p) => {
                const st = PAYMENT_STATUS[p.payment_status] || { label: p.payment_status, tone: 'neutral' };
                return (
                  <tr key={p.id}>
                    <td className="wrap">
                      <strong translate="no">{p.order_number}</strong>
                      <small><span translate="no">{p.client || '—'}</span>{` · ${date(p.payment_at)}`}</small>
                    </td>
                    <td className="num"><strong>{fcfa(p.amount)}</strong></td>
                    <td><span className={`db-pill db-pill--${st.tone}`}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="db-empty">Aucun paiement</div>}
    </Card>
  );
}

function Reviews({ reviews }) {
  return (
    <Card title="Avis récents" action={<ViewAll to="/reviews" />}>
      {reviews.length ? (
        <ul className="db-reviews">
          {reviews.map((r) => (
            <li key={r.id}>
              <p>
                <strong translate="no">{r.client || '—'}</strong>
                <span><span className="db-stars" aria-label={`${r.rating} / 5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span> {`${r.rating},0`}</span>
              </p>
              {r.review && <q translate="no">{r.review}</q>}
              <small className="db-card__sub">{date(r.rated_at)}</small>
            </li>
          ))}
        </ul>
      ) : <div className="db-empty">Aucun avis pour le moment</div>}
    </Card>
  );
}

function Reports() {
  const items = [
    ['/report', FileChartColumn, 'Rapport mensuel', 'Activité et chiffres du mois (PDF, CSV)'],
    ['/analytics', ChartSpline, 'Analyses détaillées', 'Projections, objectif, heures de pointe'],
    ['/payments', CreditCard, 'Paiements', 'Séquestre et versements aux chauffeurs'],
    ['/disputes', AlertTriangle, 'Litiges', 'Réclamations à la livraison'],
    ['/reviews', Star, 'Avis', 'Notes des clients'],
  ];
  return (
    <Card title="Rapports">
      <ul className="db-reports">
        {items.map(([to, Icon, label, sub]) => (
          <li key={to}>
            <span className="db-bars__icon"><Icon size={16} aria-hidden="true" /></span>
            <span><strong>{label}</strong><small>{sub}</small></span>
            <Link to={to} className="db-btn">Voir</Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Total({ icon: Icon, label, value, change, sub }) {
  return (
    <article className="db-card db-total">
      <span className="db-stat__icon"><Icon size={26} aria-hidden="true" /></span>
      <div>
        <p className="db-stat__label">{label}</p>
        <p className="db-stat__value">{value}</p>
        <Trend value={change} sub={sub} />
      </div>
    </article>
  );
}
