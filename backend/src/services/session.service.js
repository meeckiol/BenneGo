/**
 * Sessions par appareil : chaque connexion crée une ligne user_sessions et son identifiant (sid) va dans le jeton.
 * Un appareil déconnecté (révoqué) perd l'accès tout de suite, même si son jeton n'a pas expiré.
 */
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Libellé lisible de l'appareil, à partir de ce que l'application envoie ou du navigateur
const deviceLabel = (req) => {
  const given = String(req.body?.device_label || req.headers['x-device-label'] || '').trim();
  if (given) return given.slice(0, 120);
  const ua = String(req.headers['user-agent'] || '');
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iOS/i.test(ua) ? 'iPhone' : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : null;
  const app = /Dart|okhttp/i.test(ua) ? 'Application' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : null;
  return [app, os].filter(Boolean).join(' · ') || 'Appareil inconnu';
};

/** Ouvre une session pour cet appareil et renvoie le jeton signé qui la porte. */
const issueToken = async (req, user, db = { query }) => {
  const { rows } = await db.query(
    `INSERT INTO user_sessions (user_id, device_label, user_agent, ip) VALUES ($1, $2, $3, $4) RETURNING id`,
    [user.id, deviceLabel(req), String(req.headers['user-agent'] || '').slice(0, 300), String(req.ip || '').slice(0, 64)]
  );
  return jwt.sign(
    { userId: user.id, role: user.role, sid: rows[0].id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Vérifie un jeton (requêtes HTTP et Socket.IO) : signature, compte actif, suppression non demandée,
 * appareil non déconnecté. Renvoie l'utilisateur (avec sessionId) ou lève une erreur au message lisible.
 */
const verifyToken = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  const { rows } = await query(
    `SELECT u.id, u.phone, u.full_name, u.role, u.is_active, u.deletion_requested_at, u.sessions_revoked_before,
            s.id AS session_id, s.revoked_at, s.user_id AS session_user
     FROM users u
     LEFT JOIN user_sessions s ON s.id = $2
     WHERE u.id = $1`,
    [decoded.userId, decoded.sid && /^[0-9a-f-]{36}$/i.test(decoded.sid) ? decoded.sid : null]
  );
  const user = rows[0];
  if (!user) throw Object.assign(new Error('Utilisateur introuvable'), { status: 401 });
  if (user.deletion_requested_at) throw Object.assign(new Error('Compte en cours de suppression'), { status: 401 });
  if (!user.is_active) throw Object.assign(new Error('Compte désactivé'), { status: 401 });
  if (decoded.sid) {
    if (!user.session_id || user.session_user !== user.id || user.revoked_at) {
      throw Object.assign(new Error('Appareil déconnecté, reconnectez-vous'), { status: 401 });
    }
    // Dernière activité, mise à jour au plus toutes les 5 minutes
    query(
      `UPDATE user_sessions SET last_seen_at = NOW() WHERE id = $1 AND last_seen_at < NOW() - INTERVAL '5 minutes'`,
      [user.session_id]
    ).catch(() => null);
  } else if (user.sessions_revoked_before && decoded.iat * 1000 < new Date(user.sessions_revoked_before).getTime()) {
    // Ancien jeton sans appareil : refusé après « déconnecter les autres appareils »
    throw Object.assign(new Error('Appareil déconnecté, reconnectez-vous'), { status: 401 });
  }
  return {
    id: user.id, phone: user.phone, full_name: user.full_name, role: user.role, is_active: user.is_active,
    sessionId: user.session_id || null,
  };
};

const listSessions = async (userId, currentId) => {
  const { rows } = await query(
    `SELECT id, device_label, created_at, last_seen_at FROM user_sessions
     WHERE user_id = $1 AND revoked_at IS NULL ORDER BY last_seen_at DESC LIMIT 50`,
    [userId]
  );
  return rows.map((row) => ({ ...row, current: row.id === currentId }));
};

const revokeSession = async (userId, sessionId) => {
  const { rowCount } = await query(
    'UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
    [sessionId, userId]
  );
  return rowCount > 0;
};

/** Déconnecte tous les appareils sauf celui-ci (exceptId nul = tous), y compris les anciens jetons sans appareil. */
const revokeOthers = async (userId, exceptId, db = { query }) => {
  const { rowCount } = await db.query(
    `UPDATE user_sessions SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [userId, exceptId || null]
  );
  await db.query('UPDATE users SET sessions_revoked_before = NOW() WHERE id = $1', [userId]);
  return rowCount;
};

module.exports = { deviceLabel, issueToken, verifyToken, listSessions, revokeSession, revokeOthers };
