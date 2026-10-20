/** Suivi temps réel : le client reçoit la position du chauffeur, un tiers non. */
jest.mock('../src/providers/kkiapay', () => ({
  verify: jest.fn(async () => ({ status: 'SUCCESS', amount: 45000 })),
  refund: jest.fn(),
  widgetConfig: () => ({}),
}));
jest.mock('../src/services/pricing.service', () => ({
  ...jest.requireActual('../src/services/pricing.service'),
  calculateRoute: async () => ({ distance_km: 20, duration_min: 40 }),
}));

const request = require('supertest');
const { io: connect } = require('socket.io-client');
const { query, pool } = require('../src/config/database');
const { app, server } = require('../src/server');

let port;
const phone = () => `+2298${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
const reg = async (role, name) => {
  const r = await request(app).post('/api/auth/register').send({ phone: phone(), full_name: name, prenom: name, nom: 'Test', date_naissance: '1990-01-01', adresse: 'Cotonou', password: 'Motdepasse123', role });
  return { token: r.body.token, id: r.body.user.id, auth: { Authorization: `Bearer ${r.body.token}` } };
};
const sock = (token) => new Promise((resolve, reject) => {
  const s = connect(`http://localhost:${port}`, { auth: { token }, transports: ['websocket'] });
  s.on('connect', () => resolve(s));
  s.on('connect_error', reject);
});
const once = (s, ev, ms = 2000) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), ms);
  s.once(ev, (d) => { clearTimeout(t); res(d); });
});

beforeAll((done) => { server.listen(0, () => { port = server.address().port; done(); }); });
afterAll(async () => { await new Promise((r) => server.close(r)); await pool.end(); });

test('position du chauffeur → client suiveur (temps réel) ; intrus refusé ; connexion sans token refusée', async () => {
  const client = await reg('client', 'Suivi Client');
  const driver = await reg('driver', 'Suivi Chauffeur');
  const intruder = await reg('client', 'Intrus Suivi');

  await request(app).post('/api/auth/driver/profile').set(driver.auth).send({
    truck_type: 'simple_benne', truck_plate: 'RB 77', license_number: 'L1', momo_number: '+22997111111', momo_provider: 'mtn' });
  await request(app).patch('/api/drivers/availability').set(driver.auth).send({ is_available: true }).expect(200);

  const o = (await request(app).post('/api/orders').set(client.auth).send({
    pickup_lat: 6.37, pickup_lng: 2.39, pickup_address: 'A', delivery_lat: 6.36, delivery_lng: 2.41,
    delivery_address: 'B', quantity_m3: 5 })).body.order;
  await request(app).post(`/api/payments/orders/${o.id}/confirm`).set(client.auth).send({ transaction_id: `tx_sock_${Date.now()}` }).expect(200);
  await request(app).patch(`/api/orders/${o.id}/accept`).set(driver.auth).expect(200);

  await expect(sock('pas-un-jeton')).rejects.toBeTruthy();

  const cs = await sock(client.token);
  const ds = await sock(driver.token);
  const is = await sock(intruder.token);

  cs.emit('track_order', o.id);
  await once(cs, 'tracking_started');

  is.emit('track_order', o.id);
  expect((await once(is, 'error_message')).error).toMatch(/refusé/);

  const got = once(cs, 'driver_position');
  ds.emit('driver_location', { lat: 6.3705, lng: 2.3921, order_id: o.id });
  expect(await got).toMatchObject({ order_id: o.id, lat: 6.3705, lng: 2.3921 });

  // l'intrus ne reçoit rien ; une position pour une course qui n'est pas la sienne est rejetée
  let leaked = false;
  is.on('driver_position', () => { leaked = true; });
  const rival = await reg('driver', 'Rival Socket');
  const rs = await sock(rival.token);
  rs.emit('driver_location', { lat: 1, lng: 1, order_id: o.id });
  expect((await once(rs, 'error_message')).error).toMatch(/non active|introuvable/);
  await new Promise((r) => setTimeout(r, 200));
  expect(leaked).toBe(false);

  const rows = await query('SELECT COUNT(*)::int AS n FROM order_tracking WHERE order_id = $1', [o.id]);
  expect(rows.rows[0].n).toBe(1);
  [cs, ds, is, rs].forEach((s) => s.close());
});
