/**
 * Préférences du compte : notifications par type, heures calmes et confidentialité.
 * Stockées dans users.settings (JSONB) et toujours fusionnées avec les valeurs par défaut du rôle,
 * pour qu'un réglage jamais touché garde sa valeur par défaut.
 */
const { query } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');

// Types de notifications proposés à chaque rôle (l'ordre est celui de l'écran)
const CATEGORIES = {
  client: ['order_updates', 'messages', 'promotions'],
  driver: ['new_orders', 'messages', 'earnings'],
  admin: ['disputes', 'reliefs', 'payouts', 'messages'],
};

const PRIVACY = {
  client: ['show_photo', 'hide_phone'],
  driver: ['show_photo', 'hide_phone'],
  admin: [],
};

// Heures calmes : fuseau du Bénin (UTC+1 toute l'année)
const LOCAL_OFFSET_MIN = 60;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const defaultsFor = (role) => ({
  notifications: {
    push: true,
    ...Object.fromEntries((CATEGORIES[role] || []).map((c) => [c, true])),
    sound: true,
    vibration: true,
    quiet_hours: { enabled: false, start: '22:00', end: '06:00' },
  },
  privacy: Object.fromEntries((PRIVACY[role] || []).map((k) => [k, k === 'show_photo'])),
});

const merge = (role, stored = {}) => {
  const d = defaultsFor(role);
  const n = stored.notifications || {};
  return {
    notifications: {
      ...d.notifications,
      ...Object.fromEntries(Object.keys(d.notifications).filter((k) => k !== 'quiet_hours' && typeof n[k] === 'boolean').map((k) => [k, n[k]])),
      quiet_hours: { ...d.notifications.quiet_hours, ...(n.quiet_hours || {}) },
    },
    privacy: {
      ...d.privacy,
      ...Object.fromEntries(Object.keys(d.privacy).filter((k) => typeof stored.privacy?.[k] === 'boolean').map((k) => [k, stored.privacy[k]])),
    },
  };
};

/** Valide une modification partielle : seules les clés connues du rôle, avec le bon type. */
const validatePatch = (role, patch) => {
  const d = defaultsFor(role);
  const out = {};
  if (patch.notifications !== undefined) {
    const n = patch.notifications;
    if (typeof n !== 'object' || n === null) throw new AppError('Réglages de notifications invalides', 400);
    out.notifications = {};
    for (const [key, value] of Object.entries(n)) {
      if (key === 'quiet_hours') {
        if (typeof value !== 'object' || value === null) throw new AppError('Heures calmes invalides', 400);
        const q = {};
        if (value.enabled !== undefined) {
          if (typeof value.enabled !== 'boolean') throw new AppError('Heures calmes invalides', 400);
          q.enabled = value.enabled;
        }
        for (const k of ['start', 'end']) {
          if (value[k] === undefined) continue;
          if (!TIME.test(value[k])) throw new AppError('Heure invalide (format HH:MM)', 400);
          q[k] = value[k];
        }
        out.notifications.quiet_hours = q;
      } else if (key in d.notifications) {
        if (typeof value !== 'boolean') throw new AppError(`Valeur invalide pour ${key}`, 400);
        out.notifications[key] = value;
      } else {
        throw new AppError(`Réglage inconnu : ${key}`, 400);
      }
    }
  }
  if (patch.privacy !== undefined) {
    if (typeof patch.privacy !== 'object' || patch.privacy === null) throw new AppError('Réglages de confidentialité invalides', 400);
    out.privacy = {};
    for (const [key, value] of Object.entries(patch.privacy)) {
      if (!(key in d.privacy)) throw new AppError(`Réglage inconnu : ${key}`, 400);
      if (typeof value !== 'boolean') throw new AppError(`Valeur invalide pour ${key}`, 400);
      out.privacy[key] = value;
    }
  }
  return out;
};

const getSettings = async (userId) => {
  const { rows } = await query('SELECT role, settings FROM users WHERE id = $1', [userId]);
  if (!rows.length) throw new AppError('Utilisateur introuvable', 404);
  return merge(rows[0].role, rows[0].settings);
};

const updateSettings = async (userId, role, patch) => {
  const clean = validatePatch(role, patch || {});
  const { rows } = await query('SELECT settings FROM users WHERE id = $1', [userId]);
  const stored = rows[0]?.settings || {};
  const next = {
    notifications: {
      ...(stored.notifications || {}),
      ...(clean.notifications || {}),
      quiet_hours: { ...(stored.notifications?.quiet_hours || {}), ...(clean.notifications?.quiet_hours || {}) },
    },
    privacy: { ...(stored.privacy || {}), ...(clean.privacy || {}) },
  };
  await query('UPDATE users SET settings = $2, updated_at = NOW() WHERE id = $1', [userId, JSON.stringify(next)]);
  return merge(role, next);
};

const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Vrai pendant les heures calmes choisies (heure du Bénin). Plage qui passe minuit acceptée (22:00 → 06:00). */
const inQuietHours = (settings, now = new Date()) => {
  const q = settings.notifications.quiet_hours;
  if (!q.enabled) return false;
  const local = (now.getUTCHours() * 60 + now.getUTCMinutes() + LOCAL_OFFSET_MIN) % 1440;
  const start = minutesOf(q.start);
  const end = minutesOf(q.end);
  if (start === end) return false;
  return start < end ? local >= start && local < end : local >= start || local < end;
};

/**
 * Décision d'envoi d'une notification push : null = ne pas envoyer, sinon { silent } (sans son).
 * Une notification urgente (course en cours) sonne même pendant les heures calmes.
 */
const pushDecision = (settings, category, { urgent = false, now } = {}) => {
  const n = settings.notifications;
  if (!n.push) return null;
  if (category && n[category] === false) return null;
  const silent = !n.sound || (!urgent && inQuietHours(settings, now));
  return { silent, vibrate: n.vibration && !silent };
};

module.exports = {
  CATEGORIES, PRIVACY, defaultsFor, merge, validatePatch, getSettings, updateSettings, inQuietHours, pushDecision,
};
