/** Parrainage : primes selon le type de compte, réduction du filleul, crédit BenneGo et versement. */
jest.mock('../src/providers/kkiapay', () => ({
  verify: jest.fn(),
  refund: jest.fn(),
  widgetConfig: () => ({ api_key: 'pk_test', sandbox: true }),
}));
jest.mock('../src/services/pricing.service', () => ({
  ...jest.requireActual('../src/services/pricing.service'),
  calculateRoute: async () => ({ distance_km: 20, duration_min: 40 }),
}));

const request = require('supertest');
const { verifiedRegister } = require("./helpers/verified-register");
const bcrypt = require('bcryptjs');
const kkiapay = require('../src/providers/kkiapay');
const { query, pool } = require('../src/config/database');
const { app } = require('../src/server');

// 20 km, benne simple : 10 000 + 30 000 + 5 000 = 45 000 → minimum 35 000 FCFA, donc 45 000 FCFA
const TOTAL = 45000;
const COMMISSION = 4500;   // 10 %
const DRIVER_SHARE = 40500; // 90 %

let seq = 0;
const nextPhone = () => `+2299${String(Date.now()).slice(-5)}${String(++seq).padStart(2, '0')}`;

const register = async (role, name) => {
  const res = await verifiedRegister(app, { phone: nextPhone(), full_name: name, prenom: name, nom: 'Test', date_naissance: '1990-01-01', adresse: 'Cotonou', password: 'Motdepasse123', role });
  expect(res.status).toBe(201);
  return { token: res.body.token, id: res.body.user.id, auth: { Authorization: `Bearer ${res.body.token}` } };
};

const makeDriver = async (name = 'Koffi Chauffeur') => {
  const d = await register('driver', name);
  await request(app).post('/api/auth/driver/profile').set(d.auth).send({
    truck_type: 'simple_benne', truck_plate: 'RB 1234', license_number: 'P-998877',
    momo_number: '+22997000001', momo_provider: 'mtn',
  }).expect(200);
  await request(app).patch('/api/drivers/availability').set(d.auth).send({ is_available: true }).expect(200);
  return d;
};

const orderBody = {
  pickup_lat: 6.37, pickup_lng: 2.39, pickup_address: 'Carrière de Tori',
  delivery_lat: 6.36, delivery_lng: 2.41, delivery_address: 'Chantier Akpakpa',
  quantity_m3: 10, truck_type: 'simple_benne', material_description: 'Sable de rivière',
};

const createOrder = async (client) => {
  const res = await request(app).post('/api/orders').set(client.auth).send(orderBody);
  expect(res.status).toBe(201);
  return res.body.order;
};

let txSeq = 0;
const pay = async (client, order, { amount = TOTAL, transactionId = `tx_${Date.now()}_${++txSeq}` } = {}) => {
  kkiapay.verify.mockResolvedValueOnce({ status: 'SUCCESS', amount });
  return request(app).post(`/api/payments/orders/${order.id}/confirm`)
    .set(client.auth).send({ transaction_id: transactionId });
};

// Image JPEG minimale (signature valide) pour les photos de chargement
const JPEG = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(64)]);
const recordLoading = (driver, order, volume = 10) => request(app)
  .post(`/api/orders/${order.id}/loading`).set(driver.auth)
  .field('volume_m3', String(volume))
  .attach('photos', JPEG, { filename: 'chargement.jpg', contentType: 'image/jpeg' });

const advanceToDelivered = async (driver, order) => {
  for (const status of ['driver_en_route_pickup', 'loading']) {
    await request(app).patch(`/api/orders/${order.id}/status`).set(driver.auth).send({ status }).expect(200);
  }
  await recordLoading(driver, order).expect(200);
  for (const status of ['driver_en_route_delivery', 'delivered']) {
    await request(app).patch(`/api/orders/${order.id}/status`).set(driver.auth).send({ status }).expect(200);
  }
};


const registerWithCode = async (role, name, code) => {
  const res = await verifiedRegister(app, { phone: nextPhone(), prenom: name, nom: 'Test', date_naissance: '1990-01-01', adresse: 'Cotonou', password: 'Motdepasse123', role, referral_code: code });
  return res;
};
const codeOf = async (user) => (await request(app).get('/api/referrals/me').set(user.auth).expect(200)).body.referral_code;
const me = async (user) => (await request(app).get('/api/referrals/me').set(user.auth).expect(200)).body;

/** Commande payée, acceptée, livrée puis confirmée par le client. */
const completeOrder = async (client, driver, { useCredit = false } = {}) => {
  const res = await request(app).post('/api/orders').set(client.auth).send({ ...orderBody, use_credit: useCredit }).expect(201);
  const order = res.body.order;
  expect((await pay(client, order, { amount: order.amount_due })).status).toBe(200);
  await request(app).patch(`/api/orders/${order.id}/accept`).set(driver.auth).expect(200);
  await advanceToDelivered(driver, order);
  await request(app).post(`/api/orders/${order.id}/confirm-delivery`).set(client.auth).expect(200);
  await request(app).patch('/api/drivers/availability').set(driver.auth).send({ is_available: true });
  return order;
};

afterAll(async () => { await pool.end(); });

test('client parraine client : 1 500 de réduction au filleul, 1 500 de crédit au parrain après sa 1re commande livrée', async () => {
  const parrain = await register('client', 'Parrain Client');
  const driver = await makeDriver('Chauffeur Parrainage');

  // Code invalide : inscription refusée avec un message clair
  const bad = await registerWithCode('client', 'Filleul Faux', 'ZZZZZZ');
  expect(bad.status).toBe(404);

  const res = await registerWithCode('client', 'Filleul Client', await codeOf(parrain));
  expect(res.status).toBe(201);
  const filleul = { id: res.body.user.id, auth: { Authorization: `Bearer ${res.body.token}` } };
  expect((await me(filleul)).welcome).toMatchObject({ amount: 1500, status: 'pending' });

  // Devis puis commande : la réduction est appliquée d'office, la part du chauffeur ne change pas
  const quote = (await request(app).post('/api/orders/estimate').set(filleul.auth).send(orderBody).expect(200)).body;
  expect(quote.referral_discount).toBe(1500);
  expect(quote.amount_due).toBe(TOTAL - 1500);
  const order = await completeOrder(filleul, driver);
  expect(Number(order.discount_amount)).toBe(1500);
  expect(order.amount_due).toBe(TOTAL - 1500);
  const fee = await query("SELECT amount FROM transactions WHERE order_id = $1 AND type = 'platform_fee'", [order.id]);
  expect(Number(fee.rows[0].amount)).toBe(COMMISSION - 1500);
  const payout = await query("SELECT amount FROM transactions WHERE order_id = $1 AND type = 'driver_payout'", [order.id]);
  expect(Number(payout.rows[0].amount)).toBe(DRIVER_SHARE);

  const stats = await me(parrain);
  expect(stats.credit_balance).toBe(1500);
  expect(stats.referees).toEqual([expect.objectContaining({ name: 'Filleul T.', role: 'client', status: 'rewarded', reward: 1500 })]);

  // Plus de réduction sur la 2e commande, et le code ne se saisit plus après la 1re commande
  const second = (await request(app).post('/api/orders/estimate').set(filleul.auth).send(orderBody)).body;
  expect(second.referral_discount).toBe(0);
  const late = await register('client', 'Trop Tard');
  const o = await request(app).post('/api/orders').set(late.auth).send(orderBody).expect(201);
  expect((await pay(late, o.body.order)).status).toBe(200);
  const refused = await request(app).post('/api/referrals').set(late.auth).send({ referral_code: await codeOf(parrain) });
  expect(refused.status).toBe(409);

  // Le parrain choisit d'utiliser son crédit ; annulée avant paiement, la commande lui rend son crédit
  const withCredit = (await request(app).post('/api/orders').set(parrain.auth).send({ ...orderBody, use_credit: true }).expect(201)).body.order;
  expect(Number(withCredit.credit_used)).toBe(1500);
  expect((await me(parrain)).credit_balance).toBe(0);
  await request(app).post(`/api/orders/${withCredit.id}/cancel`).set(parrain.auth).send({}).expect(200);
  expect((await me(parrain)).credit_balance).toBe(1500);
});

test('camionneur parraine camionneur : 1 500 chacun ; croisé client → camionneur : 1 000 au parrain ; versement du crédit', async () => {
  const client = await register('client', 'Client Courses');
  const parrain = await makeDriver('Parrain Camion');
  const filleul = await makeDriver('Filleul Camion');
  const clientParrain = await register('client', 'Client Parrain');
  const filleulCroise = await makeDriver('Croise Camion');

  await request(app).post('/api/referrals').set(filleul.auth).send({ referral_code: await codeOf(parrain) }).expect(201);
  await request(app).post('/api/referrals').set(filleulCroise.auth).send({ referral_code: await codeOf(clientParrain) }).expect(201);

  // Rien tant que la course n'est pas livrée et confirmée
  expect((await me(parrain)).credit_balance).toBe(0);
  await completeOrder(client, filleul);
  expect((await me(parrain)).credit_balance).toBe(1500);
  expect((await me(filleul)).credit_balance).toBe(1500);

  await completeOrder(client, filleulCroise);
  expect((await me(clientParrain)).credit_balance).toBe(1000);
  expect((await me(filleulCroise)).credit_balance).toBe(0);

  // Le camionneur demande le versement : le crédit est réservé, l'admin le marque versé
  const asked = await request(app).post('/api/referrals/credit/payout').set(parrain.auth).expect(201);
  expect(Number(asked.body.payout.amount)).toBe(1500);
  expect((await me(parrain)).credit_balance).toBe(0);
  await request(app).post('/api/referrals/credit/payout').set(parrain.auth).expect(400);
  await request(app).post('/api/referrals/credit/payout').set(clientParrain.auth).expect(403);

  const hash = await bcrypt.hash('AdminPassword123', 4);
  const adminPhone = nextPhone();
  await query("INSERT INTO users (phone, full_name, role, password_hash) VALUES ($1, 'Admin Parrainage', 'admin', $2)", [adminPhone, hash]);
  const admin = (await request(app).post('/api/auth/login').send({ phone: adminPhone, password: 'AdminPassword123' })).body;
  const list = (await request(app).get('/api/referrals/admin/payouts').set({ Authorization: `Bearer ${admin.token}` }).expect(200)).body.payouts;
  expect(list.find((p) => p.id === asked.body.payout.id)).toMatchObject({ status: 'requested' });
  await request(app).post(`/api/referrals/admin/payouts/${asked.body.payout.id}`)
    .set({ Authorization: `Bearer ${admin.token}` }).send({ decision: 'paid', reference: 'MOMO-123' }).expect(200);
  expect((await me(parrain)).payouts[0]).toMatchObject({ status: 'paid' });
});
