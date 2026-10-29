const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const { query } = require('../config/database');
const settings = require('./settings.service');

/**
 * Notifications push (Web Push, VAPID) : elles arrivent même application fermée.
 * Clés : VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. Sans elles, hors production, une paire est créée
 * une fois dans backend/.vapid-keys.json (ignoré par git) pour que les tests marchent tout de suite.
 */
const KEYS_FILE = path.join(__dirname, '../../.vapid-keys.json');
let keys = null;

const loadKeys = () => {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else if (process.env.NODE_ENV === 'production') {
    return null;
  } else {
    try {
      keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
    } catch {
      keys = webpush.generateVAPIDKeys();
      try { fs.writeFileSync(KEYS_FILE, JSON.stringify(keys), { mode: 0o600 }); } catch { /* clés gardées en mémoire */ }
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@bennego.com', keys.publicKey, keys.privateKey);
  return keys;
};

const publicKey = () => loadKeys()?.publicKey || null;

const saveSubscription = async (userId, sub) => {
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  );
};

const removeSubscription = (userId, endpoint) => query(
  'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
  [userId, endpoint]
);

/**
 * Envoie une notification à tous les appareils d'un utilisateur, selon ses réglages : type coupé = rien,
 * heures calmes ou son coupé = notification silencieuse (sauf `urgent`). Les abonnements expirés sont supprimés.
 */
const sendToUser = async (userId, payload, { category, urgent = false } = {}) => {
  if (!loadKeys()) return;
  const { rows: users } = await query('SELECT role, settings, deletion_requested_at FROM users WHERE id = $1', [userId]);
  if (!users.length || users[0].deletion_requested_at) return;
  const decision = settings.pushDecision(settings.merge(users[0].role, users[0].settings), category, { urgent });
  if (!decision) return;
  payload = { ...payload, silent: decision.silent, vibrate: decision.vibrate };
  const { rows } = await query('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [userId]);
  await Promise.all(rows.map((row) => webpush
    .sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(payload), { TTL: 3600 })
    .catch((err) => {
      if (err.statusCode === 404 || err.statusCode === 410) {
        return query('DELETE FROM push_subscriptions WHERE endpoint = $1', [row.endpoint]);
      }
      return null;
    })));
};

/** Prévient tous les administrateurs actifs (litiges, relèves, versements, messages) selon leurs réglages. */
const sendToAdmins = async (payload, options) => {
  const { rows } = await query("SELECT id FROM users WHERE role = 'admin' AND is_active = true");
  await Promise.all(rows.map((row) => sendToUser(row.id, payload, options).catch(() => null)));
};

module.exports = { publicKey, saveSubscription, removeSubscription, sendToUser, sendToAdmins };
