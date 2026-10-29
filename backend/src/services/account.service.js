/**
 * Sécurité et cycle de vie du compte : mot de passe, numéro de téléphone, suppression différée.
 *
 * Suppression : le compte est fermé tout de suite (plus de connexion, plus de notifications) mais
 *  - pendant 60 jours, l'utilisateur peut le reprendre en se reconnectant ;
 *  - à 60 jours, il n'est plus récupérable et son numéro est libéré (réinscription possible) ;
 *  - à 6 mois, les données personnelles sont effacées ; les commandes restent pour la comptabilité.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, getClient } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');
const otp = require('./otp.service');
const sessions = require('./session.service');

const RESTORE_DAYS = 60;
const RETENTION_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

const restoreDeadline = (requestedAt) => new Date(new Date(requestedAt).getTime() + RESTORE_DAYS * DAY_MS);
const erasureDate = (requestedAt) => new Date(new Date(requestedAt).getTime() + RETENTION_DAYS * DAY_MS);

const checkPassword = async (userId, password) => {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows.length || !password || !(await bcrypt.compare(String(password), rows[0].password_hash))) {
    throw new AppError('Mot de passe incorrect', 401);
  }
};

/** Change le mot de passe et déconnecte les autres appareils. */
const changePassword = async (user, currentPassword, newPassword) => {
  await checkPassword(user.id, currentPassword);
  if (String(newPassword).length < 8) throw new AppError('Le nouveau mot de passe doit faire au moins 8 caractères', 400);
  if (currentPassword === newPassword) throw new AppError('Choisissez un mot de passe différent de l\'actuel', 400);
  const hash = await bcrypt.hash(String(newPassword), 12);
  await query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [user.id, hash]);
  return sessions.revokeOthers(user.id, user.sessionId);
};

const assertPhoneFree = async (phone, userId) => {
  const { rows } = await query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (rows.length && rows[0].id !== userId) throw new AppError('Ce numéro est déjà utilisé par un autre compte', 409);
  if (rows.length) throw new AppError('C\'est déjà votre numéro', 400);
};

/** 1re étape du changement de numéro : code envoyé par SMS au NOUVEAU numéro. */
const requestPhoneChange = async (user, phone) => {
  await assertPhoneFree(phone, user.id);
  return otp.requestCode(phone);
};

/** 2e étape : code reçu + mot de passe ; le numéro change et les autres appareils sont déconnectés. */
const confirmPhoneChange = async (user, { phone, code, password }) => {
  await checkPassword(user.id, password);
  await assertPhoneFree(phone, user.id);
  await otp.verifyCode(phone, code);
  const db = await getClient();
  try {
    await db.query('BEGIN');
    await otp.consumeVerifiedPhone(db, phone);
    await db.query('UPDATE users SET phone = $2, updated_at = NOW() WHERE id = $1', [user.id, phone]);
    await sessions.revokeOthers(user.id, user.sessionId, db);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    if (error.code === '23505') throw new AppError('Ce numéro est déjà utilisé par un autre compte', 409);
    throw error;
  } finally {
    db.release();
  }
  return phone;
};

/**
 * Ce qui empêche la suppression : une commande ou course en cours, un litige ouvert, un paiement pas encore
 * versé au camionneur, une demande de versement du crédit en attente. Le crédit restant est seulement signalé.
 */
const deletionCheck = async (user) => {
  const blockers = [];
  if (user.role === 'admin') {
    blockers.push({ code: 'admin', message: 'Un compte administrateur se supprime depuis la gestion des comptes.' });
  }
  const { rows: active } = await query(
    `SELECT order_number, status, dispute_status, payment_status FROM orders
     WHERE (client_id = $1 OR driver_id = $1)
       AND (
         status NOT IN ('completed', 'cancelled', 'validated', 'awaiting_payment')
         OR dispute_status = 'open'
         OR (driver_id = $1 AND status = 'validated' AND payment_status = 'escrow_held')
       )
     ORDER BY created_at DESC LIMIT 5`,
    [user.id]
  );
  for (const order of active) {
    if (order.dispute_status === 'open') {
      blockers.push({ code: 'dispute', message: `Litige en cours sur la commande ${order.order_number}.` });
    } else if (order.status === 'validated') {
      blockers.push({ code: 'payout', message: `Le paiement de la course ${order.order_number} ne vous a pas encore été versé.` });
    } else {
      blockers.push({
        code: 'order',
        message: user.role === 'driver'
          ? `Course ${order.order_number} en cours : terminez-la d'abord.`
          : `Commande ${order.order_number} en cours : attendez la livraison ou annulez-la.`,
      });
    }
  }
  const { rows: payouts } = await query("SELECT 1 FROM credit_payouts WHERE user_id = $1 AND status = 'requested' LIMIT 1", [user.id]);
  if (payouts.length) blockers.push({ code: 'credit_payout', message: 'Une demande de versement de votre crédit est en cours.' });
  const { rows: credit } = await query('SELECT COALESCE(SUM(amount), 0) AS balance FROM user_credits WHERE user_id = $1', [user.id]);
  return { can_delete: blockers.length === 0, blockers, credit_balance: Number(credit[0].balance) || 0, restore_days: RESTORE_DAYS };
};

/** Demande de suppression : mot de passe exigé, compte fermé tout de suite, récupérable 60 jours. */
const requestDeletion = async (user, { password, reason }, io) => {
  await checkPassword(user.id, password);
  const check = await deletionCheck(user);
  if (!check.can_delete) {
    throw new AppError(check.blockers.map((b) => b.message).join(' '), 409);
  }
  const db = await getClient();
  let requestedAt;
  try {
    await db.query('BEGIN');
    const { rows } = await db.query(
      `UPDATE users SET deletion_requested_at = NOW(), deletion_reason = $2, updated_at = NOW()
       WHERE id = $1 RETURNING deletion_requested_at`,
      [user.id, reason ? String(reason).slice(0, 300) : null]
    );
    requestedAt = rows[0].deletion_requested_at;
    // Commandes jamais payées : annulées ; camionneur hors ligne ; plus aucune notification
    await db.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW()
       WHERE client_id = $1 AND status = 'awaiting_payment' AND payment_status = 'unpaid'`,
      [user.id]
    );
    await db.query('UPDATE driver_profiles SET is_available = false, updated_at = NOW() WHERE user_id = $1', [user.id]);
    await db.query('DELETE FROM push_subscriptions WHERE user_id = $1', [user.id]);
    await sessions.revokeOthers(user.id, null, db);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
  if (io) io.in(`user_${user.id}`).disconnectSockets(true);
  return { deletion_requested_at: requestedAt, restore_until: restoreDeadline(requestedAt), erased_at: erasureDate(requestedAt) };
};

/** Reprise du compte dans les 60 jours : numéro + mot de passe, nouvelle session. */
const restoreAccount = async (req, phone, password) => {
  const { rows } = await query(
    `SELECT id, role, phone, full_name, email, password_hash, deletion_requested_at FROM users WHERE phone = $1`,
    [phone]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
    throw new AppError('Numéro ou mot de passe incorrect', 401);
  }
  if (!user.deletion_requested_at) throw new AppError('Ce compte n\'est pas en cours de suppression', 400);
  if (restoreDeadline(user.deletion_requested_at) <= new Date()) {
    throw new AppError('Le délai de 60 jours est dépassé : ce compte ne peut plus être repris', 410);
  }
  await query('UPDATE users SET deletion_requested_at = NULL, deletion_reason = NULL, updated_at = NOW() WHERE id = $1', [user.id]);
  const token = await sessions.issueToken(req, user);
  return { token, user: { id: user.id, phone: user.phone, full_name: user.full_name, email: user.email, role: user.role } };
};

/**
 * Entretien quotidien des suppressions :
 *  - après 60 jours, compte fermé pour de bon et numéro libéré (gardé à part pour l'administration) ;
 *  - après 6 mois, données personnelles effacées (nom, contacts, photo, Mobile Money, appareils).
 */
const purgeDeletedAccounts = async () => {
  const closed = await query(
    `UPDATE users SET is_active = false, deleted_phone = phone,
            phone = 'X' || SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 19), updated_at = NOW()
     WHERE deletion_requested_at < NOW() - ($1 || ' days')::interval AND deleted_phone IS NULL AND anonymized_at IS NULL`,
    [String(RESTORE_DAYS)]
  );
  const { rows } = await query(
    `SELECT id FROM users
     WHERE deletion_requested_at < NOW() - ($1 || ' days')::interval AND anonymized_at IS NULL`,
    [String(RETENTION_DAYS)]
  );
  for (const { id } of rows) {
    const db = await getClient();
    try {
      await db.query('BEGIN');
      await db.query(
        `UPDATE users SET full_name = 'Compte supprimé', prenom = NULL, nom = NULL, email = NULL, adresse = NULL,
                date_naissance = NULL, profile_photo_url = NULL, deleted_phone = NULL, deletion_reason = NULL,
                password_hash = $2, settings = '{}'::jsonb, is_active = false, anonymized_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [id, `!${crypto.randomBytes(24).toString('hex')}`]
      );
      await db.query(
        `UPDATE driver_profiles SET momo_number = NULL, license_photo_url = NULL, truck_photo_url = NULL,
                is_available = false, updated_at = NOW()
         WHERE user_id = $1`,
        [id]
      );
      await db.query('DELETE FROM user_sessions WHERE user_id = $1', [id]);
      await db.query('DELETE FROM push_subscriptions WHERE user_id = $1', [id]);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      console.error('Effacement du compte', id, ':', error.message);
    } finally {
      db.release();
    }
  }
  return { closed: closed.rowCount, erased: rows.length };
};

module.exports = {
  RESTORE_DAYS, RETENTION_DAYS, restoreDeadline, erasureDate, checkPassword, changePassword,
  requestPhoneChange, confirmPhoneChange, deletionCheck, requestDeletion, restoreAccount, purgeDeletedAccounts,
};
