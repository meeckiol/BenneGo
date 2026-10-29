/**
 * Analyses de la console admin : indicateurs clés, comparaison à la période précédente, projections,
 * objectif mensuel, répartitions, classements et heures de pointe.
 * Les jours sont comptés à l'heure du Bénin ; le chiffre d'affaires (CA) est le montant des commandes payées.
 */
const { query } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');

const TZ = 'Africa/Porto-Novo';
const PERIODS = [7, 30, 90];
const PAID = `('escrow_held', 'payout_pending', 'released')`;
const DELIVERED = `('delivered', 'validated', 'completed')`;
const DEFAULT_OBJECTIVE = 10000000;
// Jours utilisés pour la tendance (projections) : assez pour lisser les variations d'une semaine
const TREND_DAYS = 28;

const num = (v) => Number(v) || 0;
const round = (v, digits = 0) => {
  const f = 10 ** digits;
  return Math.round((Number(v) || 0) * f) / f;
};
const ratio = (part, total) => (total > 0 ? part / total : null);
const change = (now, before) => (before > 0 ? (now - before) / before : null);

/** Droite des moindres carrés sur une série (x = 0, 1, 2…) : { slope, intercept }. */
function linearTrend(values) {
  const n = values.length;
  if (!n) return { slope: 0, intercept: 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num2 = 0;
  let den = 0;
  values.forEach((y, x) => {
    num2 += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  const slope = den ? num2 / den : 0;
  return { slope, intercept: meanY - slope * meanX };
}

/** Valeurs prévues pour les `count` jours suivant la série (jamais négatives). */
function forecast(values, count) {
  const { slope, intercept } = linearTrend(values);
  return Array.from({ length: count }, (_, i) => Math.max(0, intercept + slope * (values.length + i)));
}

const isoDay = (d) => d.toISOString().slice(0, 10);
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
};

async function getObjective() {
  const { rows } = await query(`SELECT value FROM platform_settings WHERE key = 'monthly_objective'`);
  return rows[0] ? num(rows[0].value.amount) : DEFAULT_OBJECTIVE;
}

async function setObjective(amount, adminId) {
  const value = Math.round(Number(amount));
  if (!Number.isFinite(value) || value < 0 || value > 1e12) throw new AppError('Objectif invalide', 400);
  await query(
    `INSERT INTO platform_settings (key, value, updated_by, updated_at)
     VALUES ('monthly_objective', $1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [{ amount: value }, adminId]
  );
  return value;
}

// Une ligne par jour local entre deux dates : CA, commissions, commandes créées, livrées, annulées
const DAILY_SQL = `
  WITH days AS (
    SELECT d::date AS day FROM generate_series($1::date, $2::date, INTERVAL '1 day') AS d
  ),
  created AS (
    SELECT (created_at AT TIME ZONE '${TZ}')::date AS day,
      COUNT(*)::int AS orders,
      COALESCE(SUM(total_amount) FILTER (WHERE payment_status IN ${PAID}), 0)::float AS revenue,
      COALESCE(SUM(commission_amount) FILTER (WHERE payment_status IN ${PAID}), 0)::float AS commission
    FROM orders
    WHERE created_at >= ($1::date::timestamp AT TIME ZONE '${TZ}')
    GROUP BY 1
  ),
  delivered AS (
    SELECT (COALESCE(delivered_at, validated_at) AT TIME ZONE '${TZ}')::date AS day, COUNT(*)::int AS delivered
    FROM orders
    WHERE status IN ${DELIVERED} AND COALESCE(delivered_at, validated_at) IS NOT NULL
      AND COALESCE(delivered_at, validated_at) >= ($1::date::timestamp AT TIME ZONE '${TZ}')
    GROUP BY 1
  ),
  cancelled AS (
    SELECT (COALESCE(cancelled_at, updated_at) AT TIME ZONE '${TZ}')::date AS day, COUNT(*)::int AS cancelled
    FROM orders
    WHERE status = 'cancelled' AND COALESCE(cancelled_at, updated_at) >= ($1::date::timestamp AT TIME ZONE '${TZ}')
    GROUP BY 1
  )
  SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
    COALESCE(c.orders, 0) AS orders, COALESCE(c.revenue, 0) AS revenue, COALESCE(c.commission, 0) AS commission,
    COALESCE(d.delivered, 0) AS delivered, COALESCE(x.cancelled, 0) AS cancelled
  FROM days
  LEFT JOIN created c ON c.day = days.day
  LEFT JOIN delivered d ON d.day = days.day
  LEFT JOIN cancelled x ON x.day = days.day
  ORDER BY days.day`;

// Libellé de la catégorie vendue : matériau, location d'engin ou évacuation
const CATEGORY_SQL = `
  CASE
    WHEN o.order_type = 'RENTAL' THEN 'Location d''engins'
    WHEN o.order_type = 'EVACUATION' THEN 'Évacuation de gravats'
    ELSE COALESCE(mt.name_local, mt.name, 'Matériaux')
  END`;

/**
 * Toutes les analyses d'une période (7, 30 ou 90 derniers jours, aujourd'hui compris).
 * `now` permet aux tests de fixer la date du jour.
 */
async function getAnalytics({ days = 30, now } = {}) {
  const period = PERIODS.includes(Number(days)) ? Number(days) : 30;
  const { rows: [{ today }] } = await query(
    `SELECT to_char((COALESCE($1::timestamptz, NOW()) AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS today`,
    [now || null]
  );
  const from = addDays(today, -(period - 1));
  const prevFrom = addDays(from, -period);
  const span = Math.max(period * 2, TREND_DAYS);
  const seriesFrom = addDays(today, -(span - 1));
  const monthStart = `${today.slice(0, 7)}-01`;
  // Bornes de la période en instants (minuit heure du Bénin)
  const range = [from, addDays(today, 1)];
  const inPeriod = `o.created_at >= ($1::date::timestamp AT TIME ZONE '${TZ}') AND o.created_at < ($2::date::timestamp AT TIME ZONE '${TZ}')`;

  const [daily, kpis, funnel, clients, drivers, categories, types, heat, zones, newClients, objective] = await Promise.all([
    query(DAILY_SQL, [seriesFrom, today]),
    query(`SELECT
        COUNT(*)::int AS orders,
        COUNT(*) FILTER (WHERE o.payment_status IN ${PAID} OR o.payment_status = 'refunded')::int AS paid,
        COUNT(*) FILTER (WHERE o.status IN ${DELIVERED})::int AS delivered,
        COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled,
        COALESCE(AVG(o.total_amount) FILTER (WHERE o.payment_status IN ${PAID}), 0)::float AS avg_basket,
        AVG(EXTRACT(EPOCH FROM (COALESCE(o.delivered_at, o.validated_at) - COALESCE(o.payment_at, o.created_at))) / 3600)
          FILTER (WHERE o.status IN ${DELIVERED} AND COALESCE(o.delivered_at, o.validated_at) IS NOT NULL)::float AS avg_delivery_hours,
        AVG(EXTRACT(EPOCH FROM (o.accepted_at - COALESCE(o.payment_at, o.created_at))) / 60)
          FILTER (WHERE o.accepted_at IS NOT NULL)::float AS avg_accept_minutes,
        AVG(o.client_rating)::float AS avg_rating,
        COUNT(DISTINCT o.client_id) FILTER (WHERE o.payment_status IN ${PAID})::int AS active_clients,
        COUNT(DISTINCT o.driver_id) FILTER (WHERE o.status IN ${DELIVERED})::int AS active_drivers,
        (SELECT COUNT(*) FROM (SELECT o.client_id FROM orders o WHERE ${inPeriod} AND o.payment_status IN ${PAID}
          GROUP BY o.client_id HAVING COUNT(*) >= 2) AS fideles)::int AS repeat_clients
      FROM orders o WHERE ${inPeriod}`, range),
    query(`SELECT
        COUNT(*)::int AS created,
        COUNT(*) FILTER (WHERE o.payment_status <> 'unpaid')::int AS paid,
        COUNT(*) FILTER (WHERE o.accepted_at IS NOT NULL OR o.status IN ('accepted', 'driver_en_route_pickup', 'loading', 'driver_en_route_delivery', 'delivered', 'validated', 'completed'))::int AS accepted,
        COUNT(*) FILTER (WHERE o.status IN ${DELIVERED})::int AS delivered,
        COUNT(*) FILTER (WHERE o.status IN ('validated', 'completed'))::int AS confirmed
      FROM orders o WHERE ${inPeriod}`, range),
    // Meilleurs clients de la période ; « fidèle » = déjà client avant la période
    query(`SELECT u.id, u.full_name AS name,
        COUNT(*) FILTER (WHERE ${inPeriod})::int AS orders,
        SUM(o.total_amount) FILTER (WHERE ${inPeriod})::float AS revenue,
        BOOL_OR(o.created_at < ($1::date::timestamp AT TIME ZONE '${TZ}')) AS returning
      FROM orders o JOIN users u ON u.id = o.client_id
      WHERE o.payment_status IN ${PAID} AND o.created_at < ($2::date::timestamp AT TIME ZONE '${TZ}')
      GROUP BY u.id HAVING COUNT(*) FILTER (WHERE ${inPeriod}) > 0
      ORDER BY 4 DESC LIMIT 5`, range),
    query(`SELECT u.id, u.full_name AS name, COUNT(*)::int AS deliveries,
        SUM(o.driver_amount)::float AS earnings, AVG(o.client_rating)::float AS rating,
        AVG(EXTRACT(EPOCH FROM (COALESCE(o.delivered_at, o.validated_at) - o.accepted_at)) / 3600)::float AS avg_hours
      FROM orders o JOIN users u ON u.id = o.driver_id
      WHERE ${inPeriod} AND o.status IN ${DELIVERED}
      GROUP BY u.id ORDER BY COUNT(*) DESC, SUM(o.driver_amount) DESC LIMIT 5`, range),
    query(`SELECT ${CATEGORY_SQL} AS label, COUNT(*)::int AS orders, SUM(o.total_amount)::float AS revenue
      FROM orders o LEFT JOIN material_types mt ON mt.id = o.material_type_id
      WHERE ${inPeriod} AND o.payment_status IN ${PAID}
      GROUP BY 1 ORDER BY 3 DESC`, range),
    query(`SELECT COALESCE(o.order_type, 'MATERIAL') AS type, COUNT(*)::int AS orders, SUM(o.total_amount)::float AS revenue
      FROM orders o WHERE ${inPeriod} AND o.payment_status IN ${PAID}
      GROUP BY 1 ORDER BY 3 DESC`, range),
    query(`SELECT EXTRACT(ISODOW FROM o.created_at AT TIME ZONE '${TZ}')::int AS dow,
        EXTRACT(HOUR FROM o.created_at AT TIME ZONE '${TZ}')::int AS hour, COUNT(*)::int AS orders
      FROM orders o WHERE ${inPeriod} AND o.payment_status <> 'unpaid'
      GROUP BY 1, 2`, range),
    query(`SELECT NULLIF(trim(regexp_replace(o.delivery_address, '^.*,', '')), '') AS zone,
        COUNT(*)::int AS orders, SUM(o.total_amount)::float AS revenue
      FROM orders o WHERE ${inPeriod} AND o.payment_status IN ${PAID} AND o.delivery_address IS NOT NULL
      GROUP BY 1 ORDER BY 3 DESC LIMIT 6`, range),
    query(`SELECT COUNT(*)::int AS total FROM users
      WHERE role = 'client' AND created_at >= ($1::date::timestamp AT TIME ZONE '${TZ}')
        AND created_at < ($2::date::timestamp AT TIME ZONE '${TZ}')`, range),
    getObjective(),
  ]);

  const series = daily.rows.map((r) => ({
    day: r.day, orders: r.orders, revenue: r.revenue, commission: r.commission, delivered: r.delivered, cancelled: r.cancelled,
  }));
  const current = series.filter((r) => r.day >= from);
  const previous = series.filter((r) => r.day >= prevFrom && r.day < from);
  const sum = (rows, key) => rows.reduce((a, r) => a + r[key], 0);

  // Projections : tendance des 28 derniers jours prolongée
  const trendValues = series.slice(-TREND_DAYS).map((r) => r.revenue);
  const next7 = forecast(trendValues, 7);
  const daysInMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  const remaining = daysInMonth - Number(today.slice(8, 10));
  const monthToDate = sum(series.filter((r) => r.day >= monthStart), 'revenue');
  const monthEnd = monthToDate + forecast(trendValues, remaining).reduce((a, b) => a + b, 0);
  const { slope } = linearTrend(trendValues);
  const meanTrend = trendValues.reduce((a, b) => a + b, 0) / (trendValues.length || 1);

  const k = kpis.rows[0];
  const revenueNow = sum(current, 'revenue');
  const revenueBefore = sum(previous, 'revenue');
  const typeLabels = { MATERIAL: 'Matériaux', RENTAL: "Location d'engins", EVACUATION: 'Évacuation de gravats' };

  return {
    period: { days: period, from, to: today, previous_from: prevFrom },
    generated_at: new Date().toISOString(),
    kpis: {
      orders: k.orders,
      paid_orders: k.paid,
      delivery_rate: ratio(k.delivered, k.paid),
      cancellation_rate: ratio(k.cancelled, k.orders),
      avg_basket: round(k.avg_basket),
      avg_delivery_hours: k.avg_delivery_hours === null ? null : round(k.avg_delivery_hours, 1),
      avg_accept_minutes: k.avg_accept_minutes === null ? null : round(k.avg_accept_minutes),
      avg_rating: k.avg_rating === null ? null : round(k.avg_rating, 2),
      active_clients: k.active_clients,
      active_drivers: k.active_drivers,
      new_clients: newClients.rows[0].total,
      repeat_rate: ratio(k.repeat_clients, k.active_clients),
    },
    revenue: {
      total: revenueNow,
      previous: revenueBefore,
      change: change(revenueNow, revenueBefore),
      commission: sum(current, 'commission'),
      commission_previous: sum(previous, 'commission'),
      orders_change: change(sum(current, 'orders'), sum(previous, 'orders')),
    },
    projection: {
      next_7_days: round(next7.reduce((a, b) => a + b, 0)),
      // Pente rapportée à la moyenne : +0,05 = le CA quotidien gagne 5 % de la moyenne chaque jour
      trend: meanTrend > 0 ? slope / meanTrend : null,
      month_to_date: monthToDate,
      month_end: round(monthEnd),
      days_in_month: daysInMonth,
      days_remaining: remaining,
    },
    objective: {
      amount: objective,
      reached: monthToDate,
      progress: ratio(monthToDate, objective),
      projected_progress: ratio(monthEnd, objective),
    },
    series: current,
    forecast: next7.map((v, i) => ({ day: addDays(today, i + 1), revenue: round(v) })),
    funnel: funnel.rows[0],
    top_clients: clients.rows.map((c) => ({ id: c.id, name: c.name, orders: c.orders, revenue: c.revenue, returning: c.returning })),
    top_drivers: drivers.rows.map((d) => ({
      id: d.id, name: d.name, deliveries: d.deliveries, earnings: d.earnings,
      rating: d.rating === null ? null : round(d.rating, 1), avg_hours: d.avg_hours === null ? null : round(d.avg_hours, 1),
    })),
    categories: categories.rows,
    types: types.rows.map((t) => ({ ...t, label: typeLabels[t.type] || t.type })),
    heatmap: heat.rows,
    zones: zones.rows.filter((z) => z.zone),
  };
}

module.exports = { getAnalytics, getObjective, setObjective, linearTrend, forecast, PERIODS };
