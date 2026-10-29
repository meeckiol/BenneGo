/**
 * Réglages du compte : préférences, appareils connectés, mot de passe, numéro, confidentialité,
 * suppression différée (récupérable 60 jours, numéro libéré à 60 jours, données effacées à 6 mois).
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-bennego-account-0123456789';
process.env.KKIAPAY_DEV_BYPASS = 'false';

jest.mock('../src/providers/kkiapay', () => ({ verify: jest.fn(), refund: jest.fn(), widgetConfig: () => ({ api_key: 'pk_test', sandbox: true }) }));
jest.mock('../src/services/pricing.service', () => ({
  ...jest.requireActual('../src/services/pricing.service'),
  calculateRoute: async () => ({ distance_km: 20, duration_min: 40 }),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { verifiedRegister } = require('./helpers/verified-register');
const sms = require('../src/services/sms.service');
const kkiapay = require('../src/providers/kkiapay');
const settings = require('../src/services/settings.service');
const { purgeDeletedAccounts } = require('../src/services/account.service');
const { query, pool } = require('../src/config/database');
const { app } = require('../src/server');

let seq = 0;
const nextPhone = () => `+2296${String(Date.now()).slice(-5)}${String(++seq).padStart(2, '0')}`;
const PASSWORD = 'Motdepasse123';

const register = async (role, name = 'Test') => {
  const phone = nextPhone();
  const res = await verifiedRegister(app, { phone, prenom: name, nom: 'Test', date_naissance: '1990-01-01', adresse: 'Cotonou', password: PASSWORD, role });
  expect(res.status).toBe(201);
  return { phone, id: res.body.user.id, token: res.body.token, auth: { Authorization: `Bearer ${res.body.token}` } };
};
const login = async (phone, deviceLabel) => request(app).post('/api/auth/login')
  .set('X-Device-Label', deviceLabel || 'Téléphone de test').send({ phone, password: PASSWORD });
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

const orderBody = {
  pickup_lat: 6.37, pickup_lng: 2.39, pickup_address: 'Carrière de Tori',
  delivery_lat: 6.36, delivery_lng: 2.41, delivery_address: 'Chantier Akpakpa',
  quantity_m3: 10, truck_type: 'simple_benne', material_description: 'Sable',
};

afterAll(async () => { await pool.end(); });

describe('préférences', () => {
  test('valeurs par défaut selon le rôle, modification partielle et validation', async () => {
    const client = await register('client');
    const first = (await request(app).get('/api/account/settings').set(client.auth).expect(200)).body;
    expect(first.categories).toEqual(['order_updates', 'messages', 'promotions']);
    expect(first.settings.notifications.promotions).toBe(true);
    expect(first.settings.privacy).toEqual({ show_photo: true, hide_phone: false });

    const saved = (await request(app).patch('/api/account/settings').set(client.auth).send({
      notifications: { promotions: false, quiet_hours: { enabled: true, start: '21:30' } },
      privacy: { hide_phone: true },
    }).expect(200)).body.settings;
    expect(saved.notifications.promotions).toBe(false);
    expect(saved.notifications.messages).toBe(true);
    expect(saved.notifications.quiet_hours).toEqual({ enabled: true, start: '21:30', end: '06:00' });
    expect(saved.privacy.hide_phone).toBe(true);

    await request(app).patch('/api/account/settings').set(client.auth).send({ notifications: { new_orders: false } }).expect(400);
    await request(app).patch('/api/account/settings').set(client.auth).send({ notifications: { quiet_hours: { start: '25:00' } } }).expect(400);
    await request(app).patch('/api/account/settings').set(client.auth).send({ privacy: { show_photo: 'oui' } }).expect(400);

    const driver = await register('driver');
    expect((await request(app).get('/api/account/settings').set(driver.auth)).body.categories).toEqual(['new_orders', 'messages', 'earnings']);
  });

  test('heures calmes (heure du Bénin, plage qui passe minuit) et décision d\'envoi push', () => {
    const s = settings.merge('client', { notifications: { quiet_hours: { enabled: true, start: '22:00', end: '06:00' } } });
    expect(settings.inQuietHours(s, new Date('2026-10-29T22:30:00Z'))).toBe(true); // 23 h 30 au Bénin
    expect(settings.inQuietHours(s, new Date('2026-10-29T05:30:00Z'))).toBe(false); // 6 h 30
    expect(settings.inQuietHours(s, new Date('2026-10-29T20:59:00Z'))).toBe(false); // 21 h 59
    const night = new Date('2026-10-29T23:00:00Z');
    expect(settings.pushDecision(s, 'messages', { now: night })).toEqual({ silent: true, vibrate: false });
    expect(settings.pushDecision(s, 'order_updates', { urgent: true, now: night })).toEqual({ silent: false, vibrate: true });
    const off = settings.merge('client', { notifications: { promotions: false } });
    expect(settings.pushDecision(off, 'promotions')).toBeNull();
    expect(settings.pushDecision(settings.merge('client', { notifications: { push: false } }), 'messages')).toBeNull();
  });
});

describe('appareils connectés et sécurité', () => {
  test('liste, déconnexion d\'un appareil, puis de tous les autres (anciens jetons compris)', async () => {
    const user = await register('client');
    const phoneB = (await login(user.phone, 'Tablette')).body.token;
    const phoneC = (await login(user.phone, 'Ordinateur')).body.token;
    const legacy = jwt.sign({ userId: user.id, role: 'client' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await request(app).get('/api/auth/me').set(bearer(legacy)).expect(200);

    const list = (await request(app).get('/api/account/sessions').set(user.auth).expect(200)).body.sessions;
    expect(list).toHaveLength(3);
    expect(list.filter((s) => s.current)).toHaveLength(1);
    const tablet = list.find((s) => s.device_label === 'Tablette');

    await request(app).delete(`/api/account/sessions/${tablet.id}`).set(user.auth).expect(200);
    const revoked = await request(app).get('/api/auth/me').set(bearer(phoneB));
    expect(revoked.status).toBe(401);
    expect(revoked.body.error).toMatch(/déconnecté/);

    await new Promise((r) => setTimeout(r, 1100)); // l'ancien jeton doit dater d'avant la révocation
    const res = await request(app).post('/api/account/sessions/revoke-others').set(user.auth).expect(200);
    expect(res.body.count).toBe(1);
    await request(app).get('/api/auth/me').set(bearer(phoneC)).expect(401);
    await request(app).get('/api/auth/me').set(bearer(legacy)).expect(401);
    await request(app).get('/api/auth/me').set(user.auth).expect(200);
  });

  test('changement de mot de passe : ancien refusé, autres appareils déconnectés', async () => {
    const user = await register('driver');
    const other = (await login(user.phone)).body.token;
    await request(app).post('/api/account/password').set(user.auth).send({ current_password: 'faux-mot', new_password: 'Nouveau12345' }).expect(401);
    await request(app).post('/api/account/password').set(user.auth).send({ current_password: PASSWORD, new_password: 'Nouveau12345' }).expect(200);
    await request(app).get('/api/auth/me').set(bearer(other)).expect(401);
    await request(app).get('/api/auth/me').set(user.auth).expect(200);
    await request(app).post('/api/auth/login').send({ phone: user.phone, password: PASSWORD }).expect(401);
    await request(app).post('/api/auth/login').send({ phone: user.phone, password: 'Nouveau12345' }).expect(200);
  });

  test('changement de numéro avec code SMS au nouveau numéro', async () => {
    const user = await register('client');
    const taken = await register('client');
    await request(app).post('/api/account/phone/request').set(user.auth).send({ phone: taken.phone }).expect(409);

    const newPhone = nextPhone();
    await request(app).post('/api/account/phone/request').set(user.auth).send({ phone: newPhone }).expect(200);
    const code = sms.lastMessageFor(newPhone).match(/(\d{6})/)[1];
    await request(app).post('/api/account/phone/confirm').set(user.auth).send({ phone: newPhone, code, password: 'mauvais' }).expect(401);
    await request(app).post('/api/account/phone/confirm').set(user.auth).send({ phone: newPhone, code, password: PASSWORD }).expect(200);
    expect((await request(app).get('/api/auth/me').set(user.auth)).body.user.phone).toBe(newPhone);
    await request(app).post('/api/auth/login').send({ phone: newPhone, password: PASSWORD }).expect(200);
    await request(app).post('/api/auth/login').send({ phone: user.phone, password: PASSWORD }).expect(401);
  });
});

describe('confidentialité', () => {
  test('numéro du camionneur visible au client seulement pendant la course et s\'il ne l\'a pas masqué', async () => {
    const client = await register('client');
    const driver = await register('driver');
    await request(app).post('/api/auth/driver/profile').set(driver.auth).send({
      truck_type: 'simple_benne', truck_plate: 'RB 4321', license_number: 'P-1', momo_number: '+22997000009', momo_provider: 'mtn',
    }).expect(200);
    await request(app).patch('/api/drivers/availability').set(driver.auth).send({ is_available: true }).expect(200);
    const order = (await request(app).post('/api/orders').set(client.auth).send(orderBody).expect(201)).body.order;
    kkiapay.verify.mockResolvedValueOnce({ status: 'SUCCESS', amount: Number(order.amount_due) });
    await request(app).post(`/api/payments/orders/${order.id}/confirm`).set(client.auth).send({ transaction_id: `tx_priv_${Date.now()}` }).expect(200);
    await request(app).patch(`/api/orders/${order.id}/accept`).set(driver.auth).expect(200);

    let seen = (await request(app).get(`/api/orders/${order.id}`).set(client.auth).expect(200)).body.order;
    expect(seen.driver_phone).toBe(driver.phone);
    expect(seen.client_settings).toBeUndefined();

    await request(app).patch('/api/account/settings').set(driver.auth).send({ privacy: { hide_phone: true, show_photo: false } }).expect(200);
    seen = (await request(app).get(`/api/orders/${order.id}`).set(client.auth).expect(200)).body.order;
    expect(seen.driver_phone).toBeUndefined();
    expect(seen.driver_phone_hidden).toBe(true);
    expect(seen.driver_photo_url).toBeUndefined();

    await request(app).patch('/api/account/settings').set(client.auth).send({ privacy: { hide_phone: true } }).expect(200);
    const forDriver = (await request(app).get(`/api/orders/${order.id}`).set(driver.auth).expect(200)).body.order;
    expect(forDriver.client_phone).toBeUndefined();
    expect(forDriver.client_phone_hidden).toBe(true);
  });
});

describe('suppression du compte', () => {
  test('bloquée pendant une commande payée en cours, avec explication', async () => {
    const client = await register('client');
    const order = (await request(app).post('/api/orders').set(client.auth).send(orderBody).expect(201)).body.order;
    kkiapay.verify.mockResolvedValueOnce({ status: 'SUCCESS', amount: Number(order.amount_due) });
    await request(app).post(`/api/payments/orders/${order.id}/confirm`).set(client.auth).send({ transaction_id: `tx_del_${Date.now()}` }).expect(200);

    const check = (await request(app).get('/api/account/deletion').set(client.auth).expect(200)).body;
    expect(check.can_delete).toBe(false);
    expect(check.blockers[0].message).toMatch(order.order_number);
    const refused = await request(app).post('/api/account/deletion').set(client.auth).send({ password: PASSWORD });
    expect(refused.status).toBe(409);
  });

  test('suppression, reprise dans les 60 jours, puis fermeture à 60 jours et effacement à 6 mois', async () => {
    const client = await register('client', 'Effacé');
    const unpaid = (await request(app).post('/api/orders').set(client.auth).send(orderBody).expect(201)).body.order;
    expect((await request(app).get('/api/account/deletion').set(client.auth)).body.can_delete).toBe(true);

    await request(app).post('/api/account/deletion').set(client.auth).send({ password: 'faux' }).expect(401);
    const done = (await request(app).post('/api/account/deletion').set(client.auth).send({ password: PASSWORD, reason: 'Test' }).expect(200)).body;
    expect(new Date(done.restore_until) - new Date(done.deletion_requested_at)).toBe(60 * 24 * 3600 * 1000);
    await request(app).get('/api/auth/me').set(client.auth).expect(401);
    expect((await query('SELECT status FROM orders WHERE id = $1', [unpaid.id])).rows[0].status).toBe('cancelled');

    const blocked = await login(client.phone);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('ACCOUNT_DELETION_PENDING');

    const restored = (await request(app).post('/api/auth/restore').send({ phone: client.phone, password: PASSWORD }).expect(200)).body;
    await request(app).get('/api/auth/me').set(bearer(restored.token)).expect(200);
    expect((await login(client.phone)).status).toBe(200);

    // Nouvelle suppression, vieillie de 61 jours : plus récupérable, numéro libéré
    await request(app).post('/api/account/deletion').set(bearer(restored.token)).send({ password: PASSWORD }).expect(200);
    await query("UPDATE users SET deletion_requested_at = NOW() - INTERVAL '61 days' WHERE id = $1", [client.id]);
    await request(app).post('/api/auth/restore').send({ phone: client.phone, password: PASSWORD }).expect(410);
    await purgeDeletedAccounts();
    let row = (await query('SELECT phone, deleted_phone, full_name, is_active FROM users WHERE id = $1', [client.id])).rows[0];
    expect(row.deleted_phone).toBe(client.phone);
    expect(row.phone).not.toBe(client.phone);
    expect(row.full_name).toBe('Effacé Test');
    expect(row.is_active).toBe(false);
    await query('DELETE FROM phone_otps WHERE phone = $1', [client.phone]); // délai entre deux codes SMS
    const again = await verifiedRegister(app, { phone: client.phone, prenom: 'Nouveau', nom: 'Compte', date_naissance: '1990-01-01', adresse: 'Cotonou', password: PASSWORD, role: 'client' });
    expect(again.status).toBe(201);

    // À 6 mois : données personnelles effacées, commandes conservées
    await query("UPDATE users SET deletion_requested_at = NOW() - INTERVAL '181 days' WHERE id = $1", [client.id]);
    await purgeDeletedAccounts();
    row = (await query('SELECT full_name, prenom, adresse, deleted_phone, anonymized_at FROM users WHERE id = $1', [client.id])).rows[0];
    expect(row).toMatchObject({ full_name: 'Compte supprimé', prenom: null, adresse: null, deleted_phone: null });
    expect(row.anonymized_at).not.toBeNull();
    expect((await query('SELECT 1 FROM orders WHERE id = $1', [unpaid.id])).rows).toHaveLength(1);
  });
});
