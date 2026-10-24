/**
 * Test d'intégration du flux complet avec séquestre, sur une VRAIE base PostgreSQL.
 * Seul KKiaPay (verify/refund) et le calcul d'itinéraire sont simulés.
 *
 *   DB_HOST=localhost DB_PORT=5432 DB_NAME=lt_test DB_USER=lt DB_PASSWORD=lt_test npm test
 * (la base doit avoir reçu docker/init.sql : npm run migrate)
 */
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

const dbOrder = async (id) => (await query('SELECT * FROM orders WHERE id = $1', [id])).rows[0];
const txOf = async (id) => (await query('SELECT type, amount, status FROM transactions WHERE order_id = $1', [id])).rows;

beforeAll(async () => {
  await query('TRUNCATE users, material_types RESTART IDENTITY CASCADE');
  const hash = await bcrypt.hash('AdminPassword123', 4);
  await query(`INSERT INTO users (phone, full_name, role, password_hash) VALUES ('+22900000001','Admin','admin',$1)`, [hash]);
});
beforeEach(() => jest.clearAllMocks());
afterAll(async () => { await pool.end(); });

describe('parcours complet : paiement bloqué → livraison → confirmation → 10 % / 90 % → avis', () => {
  let client, driver, order;

  test('1. la commande est créée NON payée et invisible des chauffeurs', async () => {
    client = await register('client', 'Awa Cliente');
    driver = await makeDriver();
    order = await createOrder(client);

    expect(order.status).toBe('awaiting_payment');
    expect(order.payment_status).toBe('unpaid');
    expect(Number(order.total_amount)).toBe(TOTAL);

    const list = await request(app).get('/api/orders').set(driver.auth).expect(200);
    expect(list.body.orders.find((o) => o.id === order.id)).toBeUndefined();

    await request(app).patch(`/api/orders/${order.id}/accept`).set(driver.auth).expect(409);
  });

  test('2. paiement : mauvais montant refusé, statut KKiaPay non SUCCESS refusé', async () => {
    const wrong = await pay(client, order, { amount: 1000 });
    expect(wrong.status).toBe(402);

    kkiapay.verify.mockResolvedValueOnce({ status: 'FAILED', amount: TOTAL });
    const failed = await request(app).post(`/api/payments/orders/${order.id}/confirm`)
      .set(client.auth).send({ transaction_id: 'tx_failed' });
    expect(failed.status).toBe(402);

    expect((await dbOrder(order.id)).payment_status).toBe('unpaid');
  });

  test('3. un autre client ne peut pas confirmer le paiement de cette commande', async () => {
    const other = await register('client', 'Intrus Client');
    const res = await pay(other, order);
    expect(res.status).toBe(403);
  });

  test('4. paiement valide → argent bloqué (escrow), commande publiée, rien versé au chauffeur', async () => {
    const res = await pay(client, order, { transactionId: 'tx_main' });
    expect(res.status).toBe(200);
    const o = await dbOrder(order.id);
    expect(o.payment_status).toBe('escrow_held');
    expect(o.status).toBe('pending');
    expect(await txOf(order.id)).toEqual([{ type: 'escrow_hold', amount: 45000, status: 'success' }]);

    const list = await request(app).get('/api/orders').set(driver.auth).expect(200);
    expect(list.body.orders.map((x) => x.id)).toContain(order.id);
  });

  test('5. rejouer la confirmation ne double rien ; réutiliser la transaction sur une autre commande est refusé', async () => {
    const replay = await pay(client, order, { transactionId: 'tx_main' });
    expect(replay.status).toBe(200);
    expect((await txOf(order.id)).filter((t) => t.type === 'escrow_hold')).toHaveLength(1);

    const second = await createOrder(client);
    const reuse = await pay(client, second, { transactionId: 'tx_main' });
    expect(reuse.status).toBe(409);
    expect((await dbOrder(second.id)).payment_status).toBe('unpaid');
  });

  test('6. le chauffeur accepte, avance, envoie sa position ; le client la voit', async () => {
    await request(app).patch(`/api/orders/${order.id}/accept`).set(driver.auth).expect(200);

    // un autre chauffeur ne peut ni avancer la course ni injecter de position
    const rival = await makeDriver('Rival');
    await request(app).patch(`/api/orders/${order.id}/status`).set(rival.auth)
      .send({ status: 'driver_en_route_pickup' }).expect(403);
    await request(app).patch('/api/drivers/location').set(rival.auth)
      .send({ lat: 6.4, lng: 2.4, order_id: order.id }).expect(403);

    await request(app).patch('/api/drivers/location').set(driver.auth)
      .send({ lat: 6.371, lng: 2.392, order_id: order.id }).expect(200);
    await request(app).patch('/api/drivers/location').set(driver.auth)
      .send({ lat: 999, lng: 2.392, order_id: order.id }).expect(400); // hors bornes

    const tracking = await request(app).get(`/api/orders/${order.id}/tracking`).set(client.auth).expect(200);
    expect(tracking.body.last).toMatchObject({ lat: 6.371, lng: 2.392 });

    const stranger = await register('client', 'Autre Client');
    await request(app).get(`/api/orders/${order.id}/tracking`).set(stranger.auth).expect(403);
  });

  test('7. avant la livraison : le client ne peut pas libérer l\'argent, le chauffeur non plus', async () => {
    await request(app).post(`/api/orders/${order.id}/confirm-delivery`).set(client.auth).expect(400);
    await request(app).patch(`/api/orders/${order.id}/status`).set(driver.auth)
      .send({ status: 'validated' }).expect(400);
    expect((await dbOrder(order.id)).payment_status).toBe('escrow_held');
  });

  test('8. livré : toujours rien de versé tant que le client n\'a pas confirmé', async () => {
    await advanceToDelivered(driver, order);
    const o = await dbOrder(order.id);
    expect(o.status).toBe('delivered');
    expect(o.payment_status).toBe('escrow_held');
    expect((await txOf(order.id)).map((t) => t.type)).toEqual(['escrow_hold']);

    const stranger = await register('client', 'Pas Le Bon');
    await request(app).post(`/api/orders/${order.id}/confirm-delivery`).set(stranger.auth).expect(403);
    await request(app).post(`/api/orders/${order.id}/confirm-delivery`).set(driver.auth).expect(403);
  });

  test('9. avis impossible avant confirmation', async () => {
    await request(app).post(`/api/reviews/orders/${order.id}/driver`).set(client.auth)
      .send({ rating: 5, comment: 'Top' }).expect(409);
  });

  test('10. le client confirme → 10 % plateforme, 90 % à reverser, un seul prélèvement même en cas de double clic', async () => {
    const [a, b] = await Promise.all([
      request(app).post(`/api/orders/${order.id}/confirm-delivery`).set(client.auth),
      request(app).post(`/api/orders/${order.id}/confirm-delivery`).set(client.auth),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.commission_amount).toBe(COMMISSION);
    expect(a.body.driver_amount).toBe(DRIVER_SHARE);

    const o = await dbOrder(order.id);
    expect(o.status).toBe('validated');
    expect(o.payment_status).toBe('payout_pending'); // mode manuel : en attente du versement admin

    const tx = await txOf(order.id);
    expect(tx.filter((t) => t.type === 'platform_fee')).toEqual([{ type: 'platform_fee', amount: 4500, status: 'success' }]);
    expect(tx.filter((t) => t.type === 'driver_payout')).toEqual([{ type: 'driver_payout', amount: 40500, status: 'pending' }]);

    const summary = await request(app).get('/api/drivers/me/summary').set(driver.auth).expect(200);
    expect(summary.body.total_trips).toBe(1);
    expect(summary.body.earnings.pending_payout).toBe(DRIVER_SHARE);
  });

  test('11. l\'admin voit le reversement, le marque payé avec une référence → commande terminée', async () => {
    const login = await request(app).post('/api/auth/login').send({ phone: '+22900000001', password: 'AdminPassword123' });
    const admin = { Authorization: `Bearer ${login.body.token}` };

    const due = await request(app).get('/api/admin/payouts').set(admin).expect(200);
    expect(due.body.payouts.find((p) => p.order_id === order.id)).toMatchObject({ driver_amount: 40500 });

    await request(app).post(`/api/payments/orders/${order.id}/mark-paid`).set(admin).send({}).expect(400);
    await request(app).post(`/api/payments/orders/${order.id}/mark-paid`).set(admin).send({ reference: 'MOMO-8841' }).expect(200);
    await request(app).post(`/api/payments/orders/${order.id}/mark-paid`).set(admin).send({ reference: 'MOMO-8841' }).expect(409);

    const o = await dbOrder(order.id);
    expect(o.status).toBe('completed');
    expect(o.payment_status).toBe('released');

    const stats = await request(app).get('/api/admin/stats').set(admin).expect(200);
    expect(Number(stats.body.revenue.total_revenue)).toBe(COMMISSION);
  });

  test('12. le client note son chauffeur (1-5 ★) + avis, une seule fois ; la moyenne se met à jour', async () => {
    await request(app).post(`/api/reviews/orders/${order.id}/driver`).set(client.auth).send({ rating: 6 }).expect(400);
    await request(app).post(`/api/reviews/orders/${order.id}/driver`).set(client.auth).send({ rating: 0 }).expect(400);

    const res = await request(app).post(`/api/reviews/orders/${order.id}/driver`).set(client.auth)
      .send({ rating: 4, comment: 'Livraison rapide, chauffeur courtois.' }).expect(201);
    expect(res.body.driver_rating).toBe(4);

    await request(app).post(`/api/reviews/orders/${order.id}/driver`).set(client.auth).send({ rating: 1 }).expect(409);

    const reviews = await request(app).get(`/api/reviews/drivers/${driver.id}`).set(client.auth).expect(200);
    expect(reviews.body).toMatchObject({ rating: 4, rating_count: 1 });
    expect(reviews.body.reviews[0]).toMatchObject({ rating: 4, client_first_name: 'Awa' });
  });

  test('13. le client donne aussi son avis sur la plateforme (une fois par commande)', async () => {
    await request(app).post('/api/reviews/platform').set(client.auth)
      .send({ comment: 'Paiement sécurisé, ça met en confiance.', rating: 5, order_id: order.id }).expect(201);
    await request(app).post('/api/reviews/platform').set(client.auth)
      .send({ comment: 'Encore un avis', order_id: order.id }).expect(409);
    await request(app).post('/api/reviews/platform').set(client.auth).send({ comment: '' }).expect(400);
  });
});

describe('webhook KKiaPay', () => {
  test('refusé sans secret / avec mauvais secret ; accepté avec le bon et re-vérifié auprès de KKiaPay', async () => {
    const client = await register('client', 'Webhook Client');
    const order = await createOrder(client);
    const event = { event: 'transaction.success', transactionId: 'tx_wh_1', stateData: order.id };

    await request(app).post('/api/payments/webhook/kkiapay').send(event).expect(401);
    await request(app).post('/api/payments/webhook/kkiapay').set('x-kkiapay-secret', 'nope').send(event).expect(401);
    expect((await dbOrder(order.id)).payment_status).toBe('unpaid');

    // le corps du webhook affirme un succès mais KKiaPay dit le contraire → rien ne change
    kkiapay.verify.mockResolvedValueOnce({ status: 'FAILED', amount: TOTAL });
    await request(app).post('/api/payments/webhook/kkiapay')
      .set('x-kkiapay-secret', process.env.KKIAPAY_WEBHOOK_SECRET).send(event).expect(200);
    expect((await dbOrder(order.id)).payment_status).toBe('unpaid');

    kkiapay.verify.mockResolvedValueOnce({ status: 'SUCCESS', amount: TOTAL });
    await request(app).post('/api/payments/webhook/kkiapay')
      .set('x-kkiapay-secret', process.env.KKIAPAY_WEBHOOK_SECRET).send(event).expect(200);
    expect((await dbOrder(order.id)).payment_status).toBe('escrow_held');
  });
});

describe('annulation et remboursement', () => {
  test('payée mais pas encore acceptée → remboursée ; après acceptation → refusée', async () => {
    const client = await register('client', 'Annule Client');
    const driver = await makeDriver('Chauffeur Annulation');

    const o1 = await createOrder(client);
    await pay(client, o1);
    kkiapay.refund.mockResolvedValueOnce({ status: 'SUCCESS' });
    await request(app).post(`/api/orders/${o1.id}/cancel`).set(client.auth).send({}).expect(200);
    expect(kkiapay.refund).toHaveBeenCalledTimes(1);
    const refunded = await dbOrder(o1.id);
    expect([refunded.status, refunded.payment_status]).toEqual(['cancelled', 'refunded']);

    const o2 = await createOrder(client);
    await pay(client, o2);
    await request(app).patch(`/api/orders/${o2.id}/accept`).set(driver.auth).expect(200);
    await request(app).post(`/api/orders/${o2.id}/cancel`).set(client.auth).send({}).expect(409);
    expect((await dbOrder(o2.id)).payment_status).toBe('escrow_held');
  });

  test('commande jamais payée → simple annulation, aucun appel de remboursement', async () => {
    const client = await register('client', 'Sans Paiement');
    const o = await createOrder(client);
    await request(app).post(`/api/orders/${o.id}/cancel`).set(client.auth).send({}).expect(200);
    expect(kkiapay.refund).not.toHaveBeenCalled();
    expect((await dbOrder(o.id)).status).toBe('cancelled');
  });
});

describe('garde-fous chauffeur', () => {
  test('un chauffeur sans numéro Mobile Money ne peut ni se mettre disponible ni accepter', async () => {
    const d = await register('driver', 'Sans Momo');
    await request(app).post('/api/auth/driver/profile').set(d.auth).send({
      truck_type: 'plateau', truck_plate: 'RB 0001', license_number: 'X1', momo_number: '+22997000009', momo_provider: 'moov',
    }).expect(200);
    await query('UPDATE driver_profiles SET momo_number = NULL, is_available = true WHERE user_id = $1', [d.id]);

    const client = await register('client', 'Client Momo');
    const o = await createOrder(client);
    await pay(client, o);
    const res = await request(app).patch(`/api/orders/${o.id}/accept`).set(d.auth);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Mobile Money/);
  });
});

describe('reversement automatique (PAYOUT_MODE=webhook)', () => {
  const axios = require('axios');
  const payments = require('../src/services/payment.service');
  let spy;
  beforeEach(() => {
    process.env.PAYOUT_MODE = 'webhook';
    process.env.PAYOUT_WEBHOOK_URL = 'https://payout.example.test/send';
  });
  afterEach(() => { process.env.PAYOUT_MODE = 'manual'; spy && spy.mockRestore(); });

  const deliveredPaidOrder = async () => {
    const client = await register('client', 'Client Auto');
    const driver = await makeDriver('Chauffeur Auto');
    const order = await createOrder(client);
    await pay(client, order);
    await request(app).patch(`/api/orders/${order.id}/accept`).set(driver.auth).expect(200);
    await advanceToDelivered(driver, order);
    return { client, driver, order };
  };

  test('90 % envoyés UNE seule fois, même si deux déclenchements arrivent en même temps', async () => {
    const { client, order } = await deliveredPaidOrder();
    spy = jest.spyOn(axios, 'post').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { data: { reference: 'PAY-1' } };
    });

    const res = await request(app).post(`/api/orders/${order.id}/confirm-delivery`).set(client.auth).expect(200);
    expect(res.body.payout).toBe('released');
    await Promise.all([payments.settlePayout(order.id), payments.settlePayout(order.id)]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toMatchObject({ amount: 40500, idempotency_key: `payout-${order.id}`, network: 'MTN' });
    const o = await dbOrder(order.id);
    expect([o.status, o.payment_status]).toEqual(['completed', 'released']);
  });

  test('si le reversement échoue, le client a bien confirmé, l\'argent reste dû et l\'admin peut relancer', async () => {
    const { client, order } = await deliveredPaidOrder();
    spy = jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('réseau')).mockResolvedValue({ data: { reference: 'PAY-2' } });

    const res = await request(app).post(`/api/orders/${order.id}/confirm-delivery`).set(client.auth).expect(200);
    expect(res.body.payout).toBe('failed');
    expect((await dbOrder(order.id)).payment_status).toBe('payout_pending');
    expect((await txOf(order.id)).find((t) => t.type === 'driver_payout').status).toBe('failed');

    expect((await payments.settlePayout(order.id)).status).toBe('released');
    expect((await dbOrder(order.id)).payment_status).toBe('released');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
