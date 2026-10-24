/**
 * Tests d'intégration des fonctions ajoutées avant la mise en production, sur une VRAIE base PostgreSQL :
 * vérification SMS à l'inscription, chargement avant départ, litige à la livraison, panne et relève,
 * baromètre des prix, canal WhatsApp, et retrait des Carrières.
 * Seuls KKiaPay et le calcul d'itinéraire sont simulés.
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
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const kkiapay = require('../src/providers/kkiapay');
const whatsapp = require('../src/services/whatsapp.service');
const sms = require('../src/services/sms.service');
const { purgeExpiredOtps } = require('../src/services/maintenance.service');
const { verifiedRegister } = require('./helpers/verified-register');
const { query, pool } = require('../src/config/database');
const { app } = require('../src/server');

const JPEG = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(64)]);
const NOT_AN_IMAGE = Buffer.from('ceci n\'est pas une image');

let seq = 0;
const nextPhone = () => `+2297${String(Date.now()).slice(-5)}${String(++seq).padStart(2, '0')}`;

const register = async (role, name) => {
  const phone = nextPhone();
  const res = await verifiedRegister(app, {
    phone, full_name: name, prenom: name, nom: 'Test', date_naissance: '1990-01-01',
    adresse: 'Cotonou', password: 'Motdepasse123', role,
  });
  expect(res.status).toBe(201);
  return { id: res.body.user.id, phone, auth: { Authorization: `Bearer ${res.body.token}` } };
};

const makeDriver = async (name) => {
  const d = await register('driver', name);
  await request(app).post('/api/auth/driver/profile').set(d.auth).send({
    truck_type: 'simple_benne', truck_plate: `RB ${seq}`, license_number: `P-${seq}`,
    momo_number: '+22997000002', momo_provider: 'mtn',
  }).expect(200);
  await request(app).patch('/api/drivers/availability').set(d.auth).send({ is_available: true }).expect(200);
  return d;
};

const orderBody = {
  pickup_lat: 6.37, pickup_lng: 2.39, pickup_address: 'Carrière de Tori',
  delivery_lat: 6.36, delivery_lng: 2.41, delivery_address: 'Chantier Akpakpa',
  quantity_m3: 10, truck_type: 'simple_benne', material_description: 'Sable de rivière',
};

/** Commande créée, payée (séquestre), acceptée par le chauffeur. */
const acceptedOrder = async (client, driver) => {
  const created = await request(app).post('/api/orders').set(client.auth).send(orderBody);
  expect(created.status).toBe(201);
  const order = created.body.order;
  kkiapay.verify.mockResolvedValueOnce({ status: 'SUCCESS', amount: Number(order.total_amount) });
  await request(app).post(`/api/payments/orders/${order.id}/confirm`).set(client.auth)
    .send({ transaction_id: `tx_${order.id}` }).expect(200);
  await request(app).patch(`/api/orders/${order.id}/accept`).set(driver.auth).expect(200);
  return order;
};

const setStatus = (driver, orderId, status) => request(app)
  .patch(`/api/orders/${orderId}/status`).set(driver.auth).send({ status });

const recordLoading = (driver, orderId, volume = 10) => request(app)
  .post(`/api/orders/${orderId}/loading`).set(driver.auth)
  .field('volume_m3', String(volume))
  .attach('photos', JPEG, { filename: 'chargement.jpg', contentType: 'image/jpeg' });

/** Commande livrée (pas encore confirmée par le client). */
const deliveredOrder = async (client, driver) => {
  const order = await acceptedOrder(client, driver);
  await setStatus(driver, order.id, 'driver_en_route_pickup').expect(200);
  await setStatus(driver, order.id, 'loading').expect(200);
  await recordLoading(driver, order.id).expect(200);
  await setStatus(driver, order.id, 'driver_en_route_delivery').expect(200);
  await setStatus(driver, order.id, 'delivered').expect(200);
  return order;
};

const dbOrder = async (id) => (await query('SELECT * FROM orders WHERE id = $1', [id])).rows[0];

let adminAuth;
beforeAll(async () => {
  await query('TRUNCATE users, material_types, phone_otps RESTART IDENTITY CASCADE');
  const hash = await bcrypt.hash('AdminPassword123', 4);
  await query(`INSERT INTO users (phone, full_name, role, password_hash) VALUES ('+22900000009','Admin','admin',$1)`, [hash]);
  const login = await request(app).post('/api/auth/login').send({ phone: '+22900000009', password: 'AdminPassword123' });
  adminAuth = { Authorization: `Bearer ${login.body.token}` };
});
beforeEach(() => jest.clearAllMocks());
afterAll(async () => { await pool.end(); });

describe('Vérification du numéro (OTP) à l\'inscription', () => {
  const regBody = (phone) => ({
    phone, full_name: 'Awa Test', prenom: 'Awa', nom: 'Test', date_naissance: '1990-01-01',
    adresse: 'Cotonou', password: 'Motdepasse123', role: 'client',
  });

  test('sans code validé, aucun compte n\'est créé', async () => {
    const phone = nextPhone();
    const res = await request(app).post('/api/auth/register').send(regBody(phone));
    expect(res.status).toBe(403);
    const { rows } = await query('SELECT id FROM users WHERE phone = $1', [phone]);
    expect(rows).toHaveLength(0);
  });

  test('le code est envoyé par SMS, jamais stocké en clair', async () => {
    const phone = nextPhone();
    await request(app).post('/api/auth/otp/request').send({ phone }).expect(200);
    const code = sms.lastMessageFor(phone).match(/(\d{6})/)[1];
    const { rows } = await query('SELECT code_hash FROM phone_otps WHERE phone = $1', [phone]);
    expect(rows[0].code_hash).toHaveLength(64);
    expect(rows[0].code_hash).not.toContain(code);
  });

  test('une seule demande par minute par numéro', async () => {
    const phone = nextPhone();
    await request(app).post('/api/auth/otp/request').send({ phone }).expect(200);
    const again = await request(app).post('/api/auth/otp/request').send({ phone });
    expect(again.status).toBe(429);
  });

  test('5 codes faux épuisent les essais : même le bon code est refusé ensuite', async () => {
    const phone = nextPhone();
    await request(app).post('/api/auth/otp/request').send({ phone }).expect(200);
    const good = sms.lastMessageFor(phone).match(/(\d{6})/)[1];
    const wrong = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/otp/verify').send({ phone, code: wrong }).expect(400);
    }
    await request(app).post('/api/auth/otp/verify').send({ phone, code: good }).expect(429);
  });

  test('un code validé ouvre une seule inscription ; il ne peut pas être réutilisé', async () => {
    const phone = nextPhone();
    await request(app).post('/api/auth/otp/request').send({ phone }).expect(200);
    const code = sms.lastMessageFor(phone).match(/(\d{6})/)[1];
    await request(app).post('/api/auth/otp/verify').send({ phone, code }).expect(200);
    await request(app).post('/api/auth/register').send(regBody(phone)).expect(201);
    await request(app).post('/api/auth/otp/verify').send({ phone, code }).expect(400);
  });
});

describe('Chargement avant départ (volume + photos)', () => {
  test('impossible de partir sans volume ni photo de chargement', async () => {
    const client = await register('client', 'Client Charge');
    const driver = await makeDriver('Chauffeur Charge');
    const order = await acceptedOrder(client, driver);
    await setStatus(driver, order.id, 'driver_en_route_pickup').expect(200);
    await setStatus(driver, order.id, 'loading').expect(200);
    const res = await setStatus(driver, order.id, 'driver_en_route_delivery');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/volume chargé/);
  });

  test('un fichier qui n\'est pas une image est refusé', async () => {
    const client = await register('client', 'Client Fichier');
    const driver = await makeDriver('Chauffeur Fichier');
    const order = await acceptedOrder(client, driver);
    await setStatus(driver, order.id, 'driver_en_route_pickup').expect(200);
    await setStatus(driver, order.id, 'loading').expect(200);
    const res = await request(app).post(`/api/orders/${order.id}/loading`).set(driver.auth)
      .field('volume_m3', '10')
      .attach('photos', NOT_AN_IMAGE, { filename: 'faux.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  test('volume + photo enregistrés : départ autorisé, photos visibles par le client', async () => {
    const client = await register('client', 'Client Photo');
    const driver = await makeDriver('Chauffeur Photo');
    const order = await acceptedOrder(client, driver);
    await setStatus(driver, order.id, 'driver_en_route_pickup').expect(200);
    await setStatus(driver, order.id, 'loading').expect(200);
    const loaded = await recordLoading(driver, order.id, 9.5);
    expect(loaded.status).toBe(200);
    await setStatus(driver, order.id, 'driver_en_route_delivery').expect(200);

    const detail = await request(app).get(`/api/orders/${order.id}`).set(client.auth).expect(200);
    const loadingPhoto = detail.body.order.photos.find((p) => p.kind === 'loading');
    expect(loadingPhoto).toBeDefined();
    const image = await request(app).get(loadingPhoto.url).expect(200);
    expect(image.headers['content-type']).toMatch(/image\/jpeg/);
  });
});

describe('Litige à la livraison (refus avec photo)', () => {
  test('le client ouvre un litige : la confirmation est bloquée, l\'admin rembourse', async () => {
    const client = await register('client', 'Client Litige');
    const driver = await makeDriver('Chauffeur Litige');
    const order = await deliveredOrder(client, driver);

    const dispute = await request(app).post(`/api/orders/${order.id}/dispute`).set(client.auth)
      .field('reason', 'Le sable livré est argileux et il manque 3 m³')
      .attach('photos', JPEG, { filename: 'livraison.jpg', contentType: 'image/jpeg' });
    expect(dispute.status).toBe(201);

    const blocked = await request(app).post(`/api/orders/${order.id}/confirm-delivery`).set(client.auth);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/litige/i);

    kkiapay.refund.mockResolvedValueOnce({ status: 'SUCCESS' });
    const resolved = await request(app).post(`/api/admin/orders/${order.id}/dispute/resolve`)
      .set(adminAuth).send({ decision: 'refund', note: 'Sable non conforme' });
    expect(resolved.status).toBe(200);
    expect(kkiapay.refund).toHaveBeenCalledTimes(1);

    const after = await dbOrder(order.id);
    expect([after.payment_status, after.dispute_status]).toEqual(['refunded', 'refunded']);
  });

  test('l\'admin valide la livraison malgré le litige : le reversement part', async () => {
    const client = await register('client', 'Client Litige 2');
    const driver = await makeDriver('Chauffeur Litige 2');
    const order = await deliveredOrder(client, driver);
    await request(app).post(`/api/orders/${order.id}/dispute`).set(client.auth)
      .field('reason', 'Photo de la benne non conforme au volume')
      .attach('photos', JPEG, { filename: 'livraison.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const resolved = await request(app).post(`/api/admin/orders/${order.id}/dispute/resolve`)
      .set(adminAuth).send({ decision: 'release' });
    expect(resolved.status).toBe(200);

    const after = await dbOrder(order.id);
    expect(after.status).toBe('validated');
    expect(after.dispute_status).toBe('released');
    expect(after.payment_status).toBe('payout_pending');
  });

  test('motif trop court refusé ; un seul litige par commande', async () => {
    const client = await register('client', 'Client Litige 3');
    const driver = await makeDriver('Chauffeur Litige 3');
    const order = await deliveredOrder(client, driver);
    const short = await request(app).post(`/api/orders/${order.id}/dispute`).set(client.auth)
      .field('reason', 'non')
      .attach('photos', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(short.status).toBe(400);

    await request(app).post(`/api/orders/${order.id}/dispute`).set(client.auth)
      .field('reason', 'Le chargement est incomplet et hors spécification')
      .attach('photos', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const second = await request(app).post(`/api/orders/${order.id}/dispute`).set(client.auth)
      .field('reason', 'Encore le même problème ici aussi')
      .attach('photos', JPEG, { filename: 'b.jpg', contentType: 'image/jpeg' });
    expect(second.status).toBe(409);
  });
});

describe('Panne en cours de course et relève', () => {
  test('le chauffeur signale une panne ; l\'admin réassigne la course à une benne de réserve', async () => {
    const client = await register('client', 'Client Relève');
    const driver = await makeDriver('Chauffeur En Panne');
    const reserve = await makeDriver('Chauffeur Réserve');
    const order = await acceptedOrder(client, driver);
    await setStatus(driver, order.id, 'driver_en_route_pickup').expect(200);

    const breakdown = await request(app).post(`/api/orders/${order.id}/breakdown`).set(driver.auth)
      .send({ reason: 'crevaison', lat: 6.37, lng: 2.39 });
    expect(breakdown.status).toBe(201);
    const requestId = breakdown.body.request.id;

    const list = await request(app).get('/api/admin/reliefs').set(adminAuth).expect(200);
    expect(list.body.requests.map((r) => r.id)).toContain(requestId);
    expect(list.body.candidates.map((c) => c.id)).toContain(reserve.id);

    const duplicate = await request(app).post(`/api/orders/${order.id}/breakdown`).set(driver.auth)
      .send({ reason: 'crevaison', lat: 6.37, lng: 2.39 });
    expect(duplicate.status).toBe(409);

    const assigned = await request(app).post(`/api/admin/reliefs/${requestId}/assign`).set(adminAuth)
      .send({ relief_driver_id: reserve.id });
    expect(assigned.status).toBe(200);
    expect((await dbOrder(order.id)).driver_id).toBe(reserve.id);

    const again = await request(app).post(`/api/admin/reliefs/${requestId}/assign`).set(adminAuth)
      .send({ relief_driver_id: reserve.id });
    expect(again.status).toBe(409);
  });

  test('seul le chauffeur de la course peut signaler une panne', async () => {
    const client = await register('client', 'Client Panne');
    const driver = await makeDriver('Chauffeur Titulaire');
    const other = await makeDriver('Autre Chauffeur');
    const order = await acceptedOrder(client, driver);
    const res = await request(app).post(`/api/orders/${order.id}/breakdown`).set(other.auth)
      .send({ reason: 'panne_moteur', lat: 6.37, lng: 2.39 });
    expect(res.status).toBe(403);
  });
});

describe('Baromètre des prix BTP', () => {
  test('l\'admin publie un indice ; le public voit la dernière semaine', async () => {
    const published = await request(app).post('/api/admin/barometer').set(adminAuth).send({
      material_name: 'Sable lavé de test', min_price_m3: 9000, avg_price_m3: 9500, max_price_m3: 10500,
      trend: 'up', week_number: 44, year: 2026,
    });
    expect(published.status).toBe(201);
    await request(app).post('/api/admin/barometer').set(adminAuth).send({
      material_name: 'Sable lavé de test', min_price_m3: 9100, avg_price_m3: 9600, max_price_m3: 10600,
      trend: 'stable', week_number: 45, year: 2026,
    }).expect(201);

    const board = await request(app).get('/api/barometer').expect(200);
    const item = board.body.items.find((i) => i.material_name === 'Sable lavé de test');
    expect(item).toMatchObject({ week_number: 45, avg_price_m3: 9600, trend: 'stable' });
  });

  test('prix incohérents refusés (min ≤ moyen ≤ max)', async () => {
    const res = await request(app).post('/api/admin/barometer').set(adminAuth).send({
      material_name: 'Gravier test', min_price_m3: 9000, avg_price_m3: 8000, max_price_m3: 10500,
      trend: 'up', week_number: 46, year: 2026,
    });
    expect(res.status).toBe(400);
  });
});

describe('Canal WhatsApp', () => {
  const secret = 'wa-test-secret';
  const sign = (body) => `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  const textMessage = (from, body) => ({
    entry: [{ changes: [{ value: { messages: [{ from, type: 'text', text: { body } }] } }] }],
  });

  beforeAll(() => {
    process.env.WHATSAPP_APP_SECRET = secret;
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-test';
  });

  test('vérification de l\'abonnement Meta : bon jeton uniquement', async () => {
    const bad = await request(app).get('/api/whatsapp/webhook')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'mauvais', 'hub.challenge': '123' });
    expect(bad.status).toBe(403);
    const good = await request(app).get('/api/whatsapp/webhook')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-test', 'hub.challenge': '4242' });
    expect(good.status).toBe(200);
    expect(good.text).toBe('4242');
  });

  test('message non signé refusé', async () => {
    const res = await request(app).post('/api/whatsapp/webhook').send(textMessage('22997000000', '10 m3 de gravier'));
    expect(res.status).toBe(401);
  });

  test('client connu : la commande écrite est lue et une réponse est envoyée', async () => {
    const client = await register('client', 'Client WhatsApp');
    const sendSpy = jest.spyOn(whatsapp, 'sendText').mockResolvedValue();
    const payload = JSON.stringify(textMessage(client.phone.replace('+', ''), '16 m3 de sable lavé'));
    const res = await request(app).post('/api/whatsapp/webhook')
      .set('Content-Type', 'application/json').set('x-hub-signature-256', sign(payload)).send(payload);
    expect(res.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sendSpy).toHaveBeenCalledWith(
      client.phone.replace('+', ''),
      expect.stringContaining('16 m³ de sable lavé'),
    );
    sendSpy.mockRestore();
  });

  test('numéro inconnu : invitation à créer un compte', async () => {
    const sendSpy = jest.spyOn(whatsapp, 'sendText').mockResolvedValue();
    const payload = JSON.stringify(textMessage('22999999999', '5 m3 de gravier'));
    await request(app).post('/api/whatsapp/webhook')
      .set('Content-Type', 'application/json').set('x-hub-signature-256', sign(payload)).send(payload)
      .expect(200);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sendSpy).toHaveBeenCalledWith('22999999999', expect.stringContaining('/register'));
    sendSpy.mockRestore();
  });
});

describe('Retrait des Carrières (page d\'emploi)', () => {
  test('la route n\'existe plus', async () => {
    const res = await request(app).get('/api/careers');
    expect(res.status).toBe(404);
  });
});

describe('Corrections : relève en temps réel, confirmations sous litige, purge des codes', () => {
  test('la relève prévient le chauffeur de réserve et le chauffeur initial', async () => {
    const client = await register('client', 'Client Événement');
    const driver = await makeDriver('Chauffeur Événement');
    const reserve = await makeDriver('Réserve Événement');
    const order = await acceptedOrder(client, driver);
    await setStatus(driver, order.id, 'driver_en_route_pickup').expect(200);
    const breakdown = await request(app).post(`/api/orders/${order.id}/breakdown`).set(driver.auth)
      .send({ reason: 'crevaison', lat: 6.37, lng: 2.39 });
    expect(breakdown.status).toBe(201);

    const emitted = [];
    const previousIo = app.get('io');
    app.set('io', { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) });
    try {
      await request(app).post(`/api/admin/reliefs/${breakdown.body.request.id}/assign`).set(adminAuth)
        .send({ relief_driver_id: reserve.id }).expect(200);
    } finally {
      app.set('io', previousIo);
    }
    expect(emitted).toEqual(expect.arrayContaining([
      { room: `driver_${reserve.id}`, event: 'order_reassigned', payload: { order_id: order.id } },
      { room: `driver_${driver.id}`, event: 'order_reassigned', payload: { order_id: order.id } },
    ]));
  });

  test('location : confirmer les heures est refusé pendant un litige, sans rien écrire', async () => {
    const client = await register('client', 'Client Location');
    const driver = await makeDriver('Chauffeur Location');
    const order = await deliveredOrder(client, driver);
    await query(`UPDATE orders SET order_type = 'RENTAL' WHERE id = $1`, [order.id]);
    await request(app).post(`/api/orders/${order.id}/dispute`).set(client.auth)
      .field('reason', 'Les heures facturées ne sont pas celles travaillées')
      .attach('photos', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const res = await request(app).post(`/api/orders/${order.id}/confirm-rental`).set(client.auth);
    expect(res.status).toBe(409);
    expect((await dbOrder(order.id)).rental_hours_confirmed).toBe(false);
  });

  test('les codes SMS expirés depuis plus de 24 h sont purgés, les autres conservés', async () => {
    const phone = nextPhone();
    await query(
      `INSERT INTO phone_otps (phone, code_hash, expires_at, created_at)
       VALUES ($1, 'old', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')`,
      [phone]
    );
    await query(
      `INSERT INTO phone_otps (phone, code_hash, expires_at) VALUES ($1, 'fresh', NOW() + INTERVAL '5 minutes')`,
      [phone]
    );
    const removed = await purgeExpiredOtps();
    expect(removed).toBeGreaterThanOrEqual(1);
    const left = await query('SELECT code_hash FROM phone_otps WHERE phone = $1', [phone]);
    expect(left.rows.map((r) => r.code_hash)).toEqual(['fresh']);
  });
});
