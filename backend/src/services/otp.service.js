/**
 * Vérification du numéro par code à 6 chiffres, avant l'inscription.
 * - le code n'est jamais stocké en clair (HMAC avec JWT_SECRET) ;
 * - 5 minutes de validité, 5 essais max, 1 demande par minute, 5 demandes par heure et par numéro ;
 * - une vérification réussie ouvre une fenêtre de 15 minutes pour créer le compte, une seule fois.
 */
const crypto = require('crypto');
const { query } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');
const sms = require('./sms.service');

const CODE_TTL_MINUTES = 5;
const VERIFIED_WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_REQUESTS_PER_HOUR = 5;

const hashCode = (phone, code) => crypto
  .createHmac('sha256', process.env.JWT_SECRET)
  .update(`${phone}:${code}`)
  .digest('hex');

const sameHash = (a, b) => {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/** Envoie un nouveau code. Le précédent est aussitôt invalidé. */
const requestCode = async (phone) => {
  const recent = await query(
    `SELECT created_at FROM phone_otps
     WHERE phone = $1 AND created_at > NOW() - INTERVAL '1 hour'
     ORDER BY created_at DESC`,
    [phone]
  );
  if (recent.rows.length >= MAX_REQUESTS_PER_HOUR) {
    throw new AppError('Trop de demandes de code pour ce numéro. Réessayez plus tard.', 429);
  }
  if (recent.rows.length) {
    const elapsed = (Date.now() - new Date(recent.rows[0].created_at).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      throw new AppError(`Attendez ${Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)} secondes avant de redemander un code`, 429);
    }
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const hash = hashCode(phone, code);
  const { rows } = await query(
    `INSERT INTO phone_otps (phone, code_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval) RETURNING id`,
    [phone, hash, String(CODE_TTL_MINUTES)]
  );

  try {
    await sms.send(phone, `BenneGo : votre code de vérification est ${code}. Valable ${CODE_TTL_MINUTES} minutes. Ne le partagez avec personne.`);
  } catch (error) {
    await query('DELETE FROM phone_otps WHERE id = $1', [rows[0].id]);
    throw error;
  }
  await query(
    `UPDATE phone_otps SET expires_at = NOW()
     WHERE phone = $1 AND id <> $2 AND consumed_at IS NULL AND expires_at > NOW()`,
    [phone, rows[0].id]
  );
  return { expires_in_seconds: CODE_TTL_MINUTES * 60 };
};

/** Vérifie le code saisi. Réussite = numéro prouvé pendant 15 minutes. */
const verifyCode = async (phone, code) => {
  const { rows } = await query(
    `SELECT id, code_hash, attempts FROM phone_otps
     WHERE phone = $1 AND consumed_at IS NULL AND verified_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  const otp = rows[0];
  if (!otp) throw new AppError('Code expiré ou introuvable. Demandez un nouveau code.', 400);
  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new AppError('Trop de tentatives. Demandez un nouveau code.', 429);
  }
  if (!sameHash(hashCode(phone, code), otp.code_hash)) {
    await query('UPDATE phone_otps SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
    throw new AppError('Code incorrect', 400);
  }
  await query('UPDATE phone_otps SET verified_at = NOW() WHERE id = $1', [otp.id]);
  return { verified: true };
};

/**
 * Consomme une vérification réussie pour créer un compte. Appelée dans la transaction de
 * l'inscription : sans vérification valide, aucun compte n'est créé.
 */
const consumeVerifiedPhone = async (db, phone) => {
  const { rows } = await db.query(
    `UPDATE phone_otps SET consumed_at = NOW()
     WHERE id = (
       SELECT id FROM phone_otps
       WHERE phone = $1 AND verified_at IS NOT NULL AND consumed_at IS NULL
         AND verified_at > NOW() - ($2 || ' minutes')::interval
       ORDER BY verified_at DESC LIMIT 1
     )
     RETURNING id`,
    [phone, String(VERIFIED_WINDOW_MINUTES)]
  );
  if (!rows.length) {
    throw new AppError('Numéro non vérifié : validez le code reçu par SMS', 403);
  }
};

module.exports = { requestCode, verifyCode, consumeVerifiedPhone };
