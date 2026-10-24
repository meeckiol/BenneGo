/**
 * Paiement avec séquestre (escrow) — BenneGo
 *
 *   1. Le client paie en même temps que la commande      → confirmEscrow()
 *      L'argent reste sur le compte plateforme, PAS chez le chauffeur (payment_status = escrow_held).
 *   2. Le chauffeur livre, le client suit le trajet en direct.
 *   3. Le client appuie sur "Confirmer la réception"      → confirmDelivery()
 *      Seulement à ce moment : 10 % de commission plateforme + 90 % à reverser au chauffeur.
 *   4. Reversement chauffeur                              → settlePayout() / markPayoutPaid()
 *
 * Toutes les opérations qui touchent à l'argent sont :
 *   - verrouillées (SELECT ... FOR UPDATE) pour éviter les doubles clics / appels concurrents,
 *   - idempotentes (index uniques en base : une seule transaction de chaque type par commande),
 *   - recoupées auprès de KKiaPay (on ne fait jamais confiance au corps d'un webhook).
 */
const crypto = require('crypto');
const { query, getClient } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');
const kkiapay = require('../providers/kkiapay');
const payout = require('./payout.service');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * KKiaPay joint à chaque webhook l'en-tête `x-kkiapay-secret` contenant le "secret hash"
 * défini dans le tableau de bord (ce n'est PAS une signature HMAC du corps).
 * Sans secret configuré, on refuse tout : jamais d'acceptation "par défaut".
 */
const verifyWebhookSecret = (headerValue) => {
  const secret = process.env.KKIAPAY_WEBHOOK_SECRET;
  if (!secret || typeof headerValue !== 'string') return false;
  const provided = Buffer.from(headerValue);
  const expected = Buffer.from(secret);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
};

const extractOrderId = (event) => {
  const raw = event?.stateData ?? event?.data;
  if (!raw) return null;
  if (typeof raw === 'string' && UUID_RE.test(raw)) return raw;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && UUID_RE.test(parsed.order_id || '') ? parsed.order_id : null;
  } catch {
    return null;
  }
};

/** Paramètres du widget de paiement KKiaPay pour une commande du client connecté */
const getCheckoutConfig = async (orderId, user) => {
  const { rows } = await query('SELECT * FROM orders WHERE id = $1 AND client_id = $2', [orderId, user.id]);
  if (!rows.length) throw new AppError('Commande introuvable', 404);
  const order = rows[0];
  if (order.payment_status !== 'unpaid' || order.status !== 'awaiting_payment') {
    throw new AppError('Cette commande ne peut plus être payée', 409);
  }
  return {
    order_id: order.id,
    order_number: order.order_number,
    amount: Number(order.total_amount),
    phone: user.phone,
    name: user.full_name,
    ...kkiapay.widgetConfig(),
  };
};

/**
 * ÉTAPE 1 — Bloque l'argent du client (escrow).
 * Appelée après le paiement du widget (le client envoie l'id de transaction) ET par le webhook.
 */
const confirmEscrow = async (orderId, transactionId, { clientId } = {}) => {
  if (!transactionId || typeof transactionId !== 'string') {
    throw new AppError('Identifiant de transaction requis', 400);
  }

  // Vérification directe auprès de KKiaPay : statut ET montant.
  let result;
  try {
    result = await kkiapay.verify(transactionId, orderId);
  } catch (error) {
    console.error('KKiaPay verify:', error.message);
    throw new AppError('Paiement introuvable chez KKiaPay', 402);
  }
  if (!result || result.status !== 'SUCCESS') {
    throw new AppError('Paiement non confirmé par KKiaPay', 402);
  }

  const db = await getClient();
  try {
    await db.query('BEGIN');
    const { rows } = await db.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    const order = rows[0];

    if (clientId && order.client_id !== clientId) throw new AppError('Accès refusé', 403);

    // Idempotent : webhook + confirmation client peuvent arriver tous les deux
    if (order.payment_status === 'escrow_held' && order.payment_reference === transactionId) {
      await db.query('COMMIT');
      return { order, alreadyConfirmed: true };
    }
    if (order.payment_status !== 'unpaid' || order.status !== 'awaiting_payment') {
      throw new AppError('Cette commande ne peut plus être payée', 409);
    }
    if (Number(result.amount) !== Number(order.total_amount)) {
      throw new AppError('Le montant payé ne correspond pas au montant de la commande', 402);
    }

    await db.query(
      `INSERT INTO transactions (order_id, type, amount, provider, provider_reference, status, metadata)
       VALUES ($1, 'escrow_hold', $2, 'kkiapay', $3, 'success', $4)`,
      [order.id, order.total_amount, transactionId, JSON.stringify({ source: clientId ? 'client' : 'webhook' })]
    );
    const updated = await db.query(
      `UPDATE orders SET payment_status = 'escrow_held', payment_reference = $1, payment_at = NOW(),
              status = 'pending', updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [transactionId, order.id]
    );
    await db.query('COMMIT');
    return { order: updated.rows[0], alreadyConfirmed: false };
  } catch (error) {
    await db.query('ROLLBACK');
    if (error.code === '23505') {
      throw new AppError('Cette transaction a déjà été utilisée pour une autre commande', 409);
    }
    throw error;
  } finally {
    db.release();
  }
};

/**
 * ÉTAPE 3 — Le client confirme la livraison.
 * Prélève les 10 % (commission) et ouvre le reversement des 90 % au chauffeur.
 */
const confirmDelivery = async (orderId, clientId, { adminOverride = false } = {}) => {
  const db = await getClient();
  let order;
  let alreadyDone = false;
  try {
    await db.query('BEGIN');
    const { rows } = await db.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    order = rows[0];

    if (!adminOverride && order.client_id !== clientId) throw new AppError('Accès refusé', 403);

    if (['validated', 'completed'].includes(order.status)) {
      alreadyDone = true; // double clic / rejeu : rien à refaire
    } else {
      if (order.status !== 'delivered') {
        throw new AppError('Le chauffeur n\'a pas encore marqué la commande comme livrée', 400);
      }
      if (order.payment_status !== 'escrow_held') {
        throw new AppError('Aucun paiement en séquestre pour cette commande', 409);
      }
      if (order.dispute_status === 'open' && !adminOverride) {
        throw new AppError('Un litige est en cours sur cette commande', 409);
      }
      const total = Number(order.total_amount);
      const commission = Number(order.commission_amount);
      const driverAmount = Number(order.driver_amount);
      if (Math.abs(commission + driverAmount - total) > 0.01) {
        throw new AppError('Incohérence de montants, contactez le support', 500);
      }

      const driver = await db.query(
        'SELECT momo_number, momo_provider FROM driver_profiles WHERE user_id = $1', [order.driver_id]
      );
      const momo = driver.rows[0] || {};

      await db.query(
        `UPDATE orders SET status = 'validated', validated_at = NOW(),
                payment_status = 'payout_pending',
                dispute_status = CASE WHEN dispute_status = 'open' THEN 'released' ELSE dispute_status END,
                dispute_resolved_at = CASE WHEN dispute_status = 'open' THEN NOW() ELSE dispute_resolved_at END,
                updated_at = NOW() WHERE id = $1`,
        [order.id]
      );
      // 10 % : prélevés par la plateforme
      await db.query(
        `INSERT INTO transactions (order_id, type, amount, provider, status)
         VALUES ($1, 'platform_fee', $2, 'kkiapay', 'success')`,
        [order.id, commission]
      );
      // 90 % : à reverser au chauffeur
      await db.query(
        `INSERT INTO transactions (order_id, type, amount, provider, status, metadata)
         VALUES ($1, 'driver_payout', $2, 'kkiapay', 'pending', $3)`,
        [order.id, driverAmount, JSON.stringify({ momo_number: momo.momo_number, momo_provider: momo.momo_provider })]
      );
      await db.query(
        'UPDATE driver_profiles SET total_trips = total_trips + 1, updated_at = NOW() WHERE user_id = $1',
        [order.driver_id]
      );
    }
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }

  const settlement = alreadyDone ? { status: 'already_done' } : await settlePayout(order.id);
  return { orderId: order.id, driverId: order.driver_id, order, alreadyDone, settlement };
};

/** Termine la commande une fois le chauffeur effectivement payé. */
const finalizeRelease = async (db, orderId, reference) => {
  await db.query(
    `UPDATE transactions SET status = 'success', provider_reference = COALESCE($2, provider_reference)
     WHERE order_id = $1 AND type = 'driver_payout'`,
    [orderId, reference]
  );
  await db.query(
    `UPDATE orders SET payment_status = 'released', status = 'completed',
            released_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [orderId]
  );
};

/**
 * Tente le reversement chauffeur. Le "claim" (pending/failed → processing) garantit
 * qu'un seul appel concurrent peut déclencher le virement : pas de double versement.
 */
const settlePayout = async (orderId) => {
  const claim = await query(
    `UPDATE transactions SET status = 'processing'
     WHERE order_id = $1 AND type = 'driver_payout' AND status IN ('pending', 'failed')
     RETURNING amount, metadata`,
    [orderId]
  );
  if (!claim.rows.length) return { status: 'already_processing_or_done' };

  const tx = claim.rows[0];
  const meta = tx.metadata || {};
  const { rows } = await query('SELECT order_number FROM orders WHERE id = $1', [orderId]);

  let outcome;
  try {
    outcome = await payout.execute({
      orderId,
      orderNumber: rows[0]?.order_number,
      amount: Number(tx.amount),
      momoNumber: meta.momo_number,
      momoProvider: meta.momo_provider,
    });
  } catch (error) {
    console.error(`Reversement échoué (commande ${orderId}):`, error.message);
    await query(
      `UPDATE transactions SET status = 'failed', metadata = metadata || $2::jsonb
       WHERE order_id = $1 AND type = 'driver_payout'`,
      [orderId, JSON.stringify({ last_error: String(error.message).slice(0, 300) })]
    );
    return { status: 'failed' };
  }

  if (outcome.status === 'success') {
    const db = await getClient();
    try {
      await db.query('BEGIN');
      await finalizeRelease(db, orderId, outcome.reference);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      console.error(`CRITIQUE: virement envoyé mais base non mise à jour (commande ${orderId})`, error);
      throw error;
    } finally {
      db.release();
    }
    return { status: 'released' };
  }

  // Mode manuel : en attente d'un versement par l'admin
  await query(
    `UPDATE transactions SET status = 'pending' WHERE order_id = $1 AND type = 'driver_payout'`,
    [orderId]
  );
  return { status: 'pending' };
};

/** Admin : marque un reversement manuel comme effectué (référence Mobile Money obligatoire). */
const markPayoutPaid = async (orderId, reference) => {
  if (!reference || !String(reference).trim()) throw new AppError('Référence du versement requise', 400);
  const db = await getClient();
  try {
    await db.query('BEGIN');
    const { rows } = await db.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    if (rows[0].payment_status !== 'payout_pending') {
      throw new AppError('Aucun reversement en attente pour cette commande', 409);
    }
    await finalizeRelease(db, orderId, String(reference).trim().slice(0, 100));
    await db.query('COMMIT');
    return { orderId };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
};

/**
 * Remboursement du client (annulation avant livraison / litige).
 * Réservé : au client tant qu'aucun chauffeur n'a accepté, à l'admin sinon.
 */
const refundEscrow = async (orderId, { actor, reason }) => {
  const db = await getClient();
  try {
    await db.query('BEGIN');
    const { rows } = await db.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    const order = rows[0];

    if (actor.role === 'client') {
      if (order.client_id !== actor.id) throw new AppError('Accès refusé', 403);
      if (order.status !== 'pending') {
        throw new AppError('Annulation impossible : un chauffeur a déjà accepté la course', 409);
      }
    } else if (actor.role !== 'admin') {
      throw new AppError('Accès refusé', 403);
    }
    if (order.payment_status !== 'escrow_held') {
      throw new AppError('Aucun paiement en séquestre à rembourser', 409);
    }
    if (['validated', 'completed', 'cancelled'].includes(order.status)) {
      throw new AppError('Cette commande ne peut plus être remboursée', 409);
    }

    try {
      await kkiapay.refund(order.payment_reference);
    } catch (error) {
      console.error('KKiaPay refund:', error.message);
      throw new AppError('Le remboursement a été refusé par KKiaPay', 502);
    }

    await db.query(
      `INSERT INTO transactions (order_id, type, amount, provider, provider_reference, status, metadata)
       VALUES ($1, 'refund', $2, 'kkiapay', $3, 'success', $4)`,
      [order.id, order.total_amount, order.payment_reference, JSON.stringify({ by: actor.role, reason: reason || null })]
    );
    await db.query(
      `UPDATE orders SET payment_status = 'refunded', status = 'cancelled', cancelled_at = NOW(),
              cancellation_reason = $2,
              dispute_status = CASE WHEN dispute_status = 'open' THEN 'refunded' ELSE dispute_status END,
              dispute_resolved_at = CASE WHEN dispute_status = 'open' THEN NOW() ELSE dispute_resolved_at END,
              updated_at = NOW() WHERE id = $1`,
      [order.id, reason || null]
    );
    await db.query('COMMIT');
    return { order };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
};

/** Webhook KKiaPay — filet de sécurité si le client ferme la page après avoir payé */
const handleKKiaPayWebhook = async (req, res, next) => {
  try {
    if (!verifyWebhookSecret(req.headers['x-kkiapay-secret'])) {
      console.warn('Webhook KKiaPay rejeté : secret absent ou invalide');
      return res.status(401).json({ error: 'Secret invalide' });
    }

    const event = req.body || {};
    const isSuccess = event.event === 'transaction.success' || event.isPaymentSucces === true;
    if (!isSuccess) return res.json({ received: true });

    const orderId = extractOrderId(event);
    if (!orderId) {
      console.warn('Webhook KKiaPay : commande non identifiable', event.transactionId);
      return res.json({ received: true });
    }

    try {
      const { order, alreadyConfirmed } = await confirmEscrow(orderId, event.transactionId);
      if (!alreadyConfirmed) require('./order-events').notifyNewOrder(req.app.get('io'), order);
    } catch (error) {
      // Erreur "métier" : inutile que KKiaPay réessaie. Erreur technique : on laisse réessayer.
      if (!error.statusCode || error.statusCode >= 500) throw error;
      console.warn(`Webhook KKiaPay ignoré (${error.statusCode}) : ${error.message}`);
    }
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyWebhookSecret,
  extractOrderId,
  getCheckoutConfig,
  confirmEscrow,
  confirmDelivery,
  settlePayout,
  markPayoutPaid,
  refundEscrow,
  handleKKiaPayWebhook,
};
