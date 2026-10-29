/**
 * Console Analyses : chiffres d'une période, comparaison à la période précédente, projections, objectif mensuel.
 * Les commandes de test sont datées en 2031 pour ne pas croiser celles des autres tests.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-bennego-analytics-0123456789';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { query, pool } = require('../src/config/database');
const { app } = require('../src/server');
const analytics = require('../src/services/analytics.service');

const NOW = '2031-03-15T12:00:00Z';
let seq = 0;
const phone = () => `+2295${String(Date.now()).slice(-6)}${String(++seq).padStart(2, '0')}`;

const user = async (role, name) => (await query(
  `INSERT INTO users (phone, full_name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
  [phone(), name, role, await bcrypt.hash('Motdepasse123', 4)]
)).rows[0].id;

const order = (fields) => query(
  `INSERT INTO orders (order_number, client_id, driver_id, order_type, pickup_address, delivery_address,
     pickup_lat, pickup_lng, delivery_lat, delivery_lng, distance_km, quantity_m3, total_amount, commission_amount, driver_amount,
     status, payment_status, created_at, payment_at, accepted_at, delivered_at, client_rating)
   VALUES ($1, $2, $3, 'MATERIAL', 'Carrière', $4, 6.4, 2.3, 6.37, 2.39, 10, 10, $5, $5 * 0.1, $5 * 0.9,
     $6, $7, $8, $8, $9, $10, $11)`,
  [
    `BG-AN-${String(Date.now()).slice(-7)}${++seq}`, fields.client, fields.driver, fields.address || 'Chantier, Cotonou', fields.amount,
    fields.status, fields.payment, fields.at, fields.accepted || null, fields.delivered || null, fields.rating || null,
  ]
);

// L'objectif déjà enregistré est remis en place après les tests
let savedObjective;
beforeAll(async () => {
  savedObjective = (await query(`SELECT value FROM platform_settings WHERE key = 'monthly_objective'`)).rows[0]?.value;
});

afterAll(async () => {
  // Rien ne reste dans la base partagée : commandes de test et objectif modifié
  await query(`DELETE FROM orders WHERE order_number LIKE 'BG-AN-%'`);
  if (savedObjective) await query(`UPDATE platform_settings SET value = $1 WHERE key = 'monthly_objective'`, [savedObjective]);
  else await query(`DELETE FROM platform_settings WHERE key = 'monthly_objective'`);
  await pool.end();
});

test('tendance et prévision : droite des moindres carrés, jamais négative', () => {
  expect(analytics.linearTrend([1, 2, 3])).toEqual({ slope: 1, intercept: 1 });
  expect(analytics.forecast([1, 2, 3], 2)).toEqual([4, 5]);
  expect(analytics.forecast([3, 2, 1], 3)).toEqual([0, 0, 0]);
  expect(analytics.forecast([], 2)).toEqual([0, 0]);
});

test('chiffres de la période, période précédente, classements et objectif', async () => {
  const client = await user('client', 'Client Analyses');
  const driver = await user('driver', 'Chauffeur Analyses');
  const done = (at, amount, rating) => order({
    client, driver, amount, status: 'completed', payment: 'released', at,
    accepted: at.replace('12:00', '12:30'), delivered: at.replace('12:00', '15:00'), rating,
  });
  // Période (7 jours jusqu'au 15 mars) : 3 livraisons et 1 commande annulée non payée
  await done('2031-03-10T12:00:00Z', 100000, 4);
  await done('2031-03-12T12:00:00Z', 200000, 5);
  await done('2031-03-14T12:00:00Z', 300000);
  await order({ client, driver: null, amount: 50000, status: 'cancelled', payment: 'unpaid', at: '2031-03-13T12:00:00Z' });
  // Période précédente (2 au 8 mars)
  await done('2031-03-05T12:00:00Z', 300000);

  const a = await analytics.getAnalytics({ days: 7, now: NOW });
  expect(a.period).toMatchObject({ days: 7, from: '2031-03-09', to: '2031-03-15', previous_from: '2031-03-02' });
  expect(a.revenue).toMatchObject({ total: 600000, previous: 300000, change: 1, commission: 60000 });
  expect(a.kpis).toMatchObject({
    orders: 4, paid_orders: 3, delivery_rate: 1, cancellation_rate: 0.25, avg_basket: 200000,
    avg_delivery_hours: 3, avg_accept_minutes: 30, avg_rating: 4.5, active_clients: 1, active_drivers: 1, repeat_rate: 1,
  });
  expect(a.series).toHaveLength(7);
  expect(a.series.find((d) => d.day === '2031-03-10')).toMatchObject({ revenue: 100000, orders: 1, delivered: 1 });
  expect(a.funnel).toMatchObject({ created: 4, paid: 3, accepted: 3, delivered: 3, confirmed: 3 });
  expect(a.top_clients[0]).toMatchObject({ name: 'Client Analyses', orders: 3, revenue: 600000, returning: true });
  expect(a.top_drivers[0]).toMatchObject({ name: 'Chauffeur Analyses', deliveries: 3, rating: 4.5 });
  expect(a.zones[0]).toMatchObject({ zone: 'Cotonou', orders: 3 });
  expect(a.forecast).toHaveLength(7);
  expect(a.forecast[0].day).toBe('2031-03-16');
  // Mois de mars : 900 000 FCFA réalisés, projection = réalisé + tendance sur les 16 jours restants
  expect(a.projection).toMatchObject({ month_to_date: 900000, days_in_month: 31, days_remaining: 16 });
  expect(a.projection.month_end).toBeGreaterThanOrEqual(900000);

  // Une période inconnue retombe sur 30 jours
  expect((await analytics.getAnalytics({ days: 12, now: NOW })).period.days).toBe(30);
});

test('API : réservée à l\'admin, objectif mensuel modifiable', async () => {
  const adminPhone = phone();
  await query(`INSERT INTO users (phone, full_name, role, password_hash) VALUES ($1, 'Admin Analyses', 'admin', $2)`,
    [adminPhone, await bcrypt.hash('AdminPassword123', 4)]);
  const admin = (await request(app).post('/api/auth/login').send({ phone: adminPhone, password: 'AdminPassword123' }).expect(200)).body;
  const auth = { Authorization: `Bearer ${admin.token}` };

  const clientPhone = phone();
  await query(`INSERT INTO users (phone, full_name, role, password_hash) VALUES ($1, 'Client Curieux', 'client', $2)`,
    [clientPhone, await bcrypt.hash('Motdepasse123', 4)]);
  const client = (await request(app).post('/api/auth/login').send({ phone: clientPhone, password: 'Motdepasse123' }).expect(200)).body;
  await request(app).get('/api/admin/analytics').set({ Authorization: `Bearer ${client.token}` }).expect(403);

  const res = await request(app).get('/api/admin/analytics?days=90').set(auth).expect(200);
  expect(res.body.period.days).toBe(90);
  expect(res.body.series).toHaveLength(90);
  expect(res.body).toHaveProperty('objective.amount');

  await request(app).put('/api/admin/analytics/objective').set(auth).send({ amount: -5 }).expect(400);
  await request(app).put('/api/admin/analytics/objective').set(auth).send({ amount: 7500000 }).expect(200);
  const after = await request(app).get('/api/admin/analytics?days=7').set(auth).expect(200);
  expect(after.body.objective.amount).toBe(7500000);
});
