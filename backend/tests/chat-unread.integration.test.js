/** Messagerie : alerte du destinataire, messages non lus, lecture et abonnement push. */
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
const { verifiedRegister } = require("./helpers/verified-register");
const { io: connect } = require('socket.io-client');
const { query, pool } = require('../src/config/database');
const { app, server } = require('../src/server');

let port;
const phone = () => `+2298${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
const reg = async (role, name) => {
  const r = await verifiedRegister(app, { phone: phone(), full_name: name, prenom: name, nom: 'Test', date_naissance: '1990-01-01', adresse: 'Cotonou', password: 'Motdepasse123', role });
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

test('message du client → alerte du chauffeur, non lus, lecture ; un tiers ne peut pas marquer lu', async () => {
  const client = await reg('client', 'Chat Client');
  const driver = await reg('driver', 'Chat Chauffeur');
  const intruder = await reg('client', 'Chat Intrus');

  await request(app).post('/api/auth/driver/profile').set(driver.auth).send({
    truck_type: 'simple_benne', truck_plate: 'RB 78', license_number: 'L2', momo_number: '+22997222222', momo_provider: 'mtn' });
  await request(app).patch('/api/drivers/availability').set(driver.auth).send({ is_available: true }).expect(200);
  const o = (await request(app).post('/api/orders').set(client.auth).send({
    pickup_lat: 6.37, pickup_lng: 2.39, pickup_address: 'A', delivery_lat: 6.36, delivery_lng: 2.41,
    delivery_address: 'B', quantity_m3: 5 })).body.order;
  await request(app).post(`/api/payments/orders/${o.id}/confirm`).set(client.auth).send({ transaction_id: `tx_chat_${Date.now()}` }).expect(200);
  await request(app).patch(`/api/orders/${o.id}/accept`).set(driver.auth).expect(200);

  const cs = await sock(client.token);
  const ds = await sock(driver.token);

  // Le chauffeur n'a pas ouvert la discussion : il est quand même prévenu
  const alert = once(ds, 'chat_notify');
  cs.emit('chat_join', { order_id: o.id });
  await once(cs, 'chat_joined');
  cs.emit('chat_message', { order_id: o.id, message: 'Bonjour, portail bleu.' });
  expect(await alert).toMatchObject({ order_id: o.id, message: 'Bonjour, portail bleu.', sender_role: 'client', order_number: o.order_number });

  const unread = (await request(app).get('/api/orders/chat/unread').set(driver.auth).expect(200)).body;
  expect(unread.total).toBe(1);
  expect(unread.unread).toEqual([{ order_id: o.id, unread: 1 }]);
  // Ses propres messages ne comptent pas comme non lus
  expect((await request(app).get('/api/orders/chat/unread').set(client.auth)).body.total).toBe(0);

  await request(app).post(`/api/orders/${o.id}/chat/read`).set(intruder.auth).expect(403);
  await request(app).post(`/api/orders/${o.id}/chat/read`).set(driver.auth).expect(200);
  expect((await request(app).get('/api/orders/chat/unread').set(driver.auth)).body.total).toBe(0);

  // Abonnement push de l'appareil
  const sub = { endpoint: `https://push.example.com/${Date.now()}`, keys: { p256dh: 'BOr6pA5LpVYF8bQ2xq0v9wB0Yk1c', auth: 'c2VjcmV0LWF1dGgtMTY' } };
  expect((await request(app).get('/api/push/public-key').expect(200)).body.public_key).toBeTruthy();
  await request(app).post('/api/push/subscribe').send(sub).expect(401);
  await request(app).post('/api/push/subscribe').set(driver.auth).send(sub).expect(201);
  const saved = await query('SELECT user_id FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
  expect(saved.rows[0].user_id).toBe(driver.id);
  await request(app).delete('/api/push/subscribe').set(driver.auth).send({ endpoint: sub.endpoint }).expect(200);

  [cs, ds].forEach((s) => s.close());
});

test('le chauffeur reste disponible tant qu\'une autre connexion est ouverte', async () => {
  const driver = await reg('driver', 'Chat Deux Onglets');
  await request(app).post('/api/auth/driver/profile').set(driver.auth).send({
    truck_type: 'simple_benne', truck_plate: 'RB 79', license_number: 'L3', momo_number: '+22997333333', momo_provider: 'mtn' });
  const a = await sock(driver.token);
  const b = await sock(driver.token);
  a.emit('driver_available');
  await once(a, 'availability_updated');
  b.close();
  await new Promise((r) => setTimeout(r, 300));
  let row = await query('SELECT is_available FROM driver_profiles WHERE user_id = $1', [driver.id]);
  expect(row.rows[0].is_available).toBe(true);
  a.close();
  await new Promise((r) => setTimeout(r, 300));
  row = await query('SELECT is_available FROM driver_profiles WHERE user_id = $1', [driver.id]);
  expect(row.rows[0].is_available).toBe(false);
});
