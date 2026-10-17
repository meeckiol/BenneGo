const axios = require('axios');
const crypto = require('crypto');
const { query, getClient } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');

// KKiaPay API - https://docs.kkiapay.me
const KKIAPAY_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.kkiapay.me'
  : 'https://sandbox-api.kkiapay.me';

/**
 * Vérifie la signature HMAC d'un webhook KKiaPay
 */
const verifyKKiaPaySignature = (payload, signature) => {
  const secret = process.env.KKIAPAY_SECRET;
  if (!secret) return true; // sandbox sans secret configuré

  if (!signature || typeof signature !== 'string') {
    return false;
  }

  const normalizedSignature = signature.replace(/^sha256=/i, '').trim();
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(normalizedSignature, 'hex');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch (error) {
    return false;
  }
};

/**
 * Initie un paiement Mobile Money via KKiaPay (escrow)
 * Retourne un lien de paiement que le client ouvre sur son téléphone
 *
 * @param {string} orderId       - UUID de la commande
 * @param {number} amount        - Montant en FCFA
 * @param {string} customerPhone - Numéro MTN/Moov du client
 * @param {string} customerName  - Nom du client
 */
const createEscrowPayment = async (orderId, amount, customerPhone, customerName) => {
  try {
    const response = await axios.post(
      `${KKIAPAY_BASE_URL}/v1/payments`,
      {
        amount,
        reason: `LogiTruck - Livraison de matériaux`,
        phone: customerPhone,
        name: customerName,
        // URL de callback après paiement réussi/échoué
        callback: `${process.env.API_BASE_URL}/api/payments/webhook/kkiapay`,
        // Données personnalisées pour retrouver la commande dans le webhook
        data: JSON.stringify({ order_id: orderId, type: 'escrow_hold' }),
      },
      {
        headers: {
          'x-private-key': process.env.KKIAPAY_PRIVATE_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const { transactionId, paymentUrl } = response.data;

    return {
      transaction_id: transactionId,
      payment_url: paymentUrl,
      reference: transactionId,
    };
  } catch (error) {
    console.error('KKiaPay erreur création paiement:', error.response?.data || error.message);
    throw new AppError('Erreur lors de la création du paiement KKiaPay', 500);
  }
};

/**
 * Vérifie le statut d'une transaction KKiaPay
 * Utilisé pour confirmer un paiement avant de libérer la commande
 *
 * @param {string} transactionId - ID de transaction KKiaPay
 */
const verifyTransaction = async (transactionId) => {
  try {
    const response = await axios.get(
      `${KKIAPAY_BASE_URL}/v1/payments/${transactionId}/verify`,
      {
        headers: { 'x-private-key': process.env.KKIAPAY_PRIVATE_KEY },
        timeout: 10000,
      }
    );
    return response.data; // { status, amount, transactionId, ... }
  } catch (error) {
    console.error('KKiaPay erreur vérification:', error.response?.data || error.message);
    throw new AppError('Impossible de vérifier la transaction KKiaPay', 500);
  }
};

/**
 * Effectue un virement (payout) vers le compte Mobile Money du chauffeur
 * via l'API KKiaPay Transfer
 *
 * @param {string} momoNumber   - Numéro Mobile Money du chauffeur
 * @param {string} momoProvider - 'mtn' ou 'moov'
 * @param {number} amount       - Montant en FCFA
 * @param {string} reason       - Libellé du virement
 */
const payoutToDriver = async (momoNumber, momoProvider, amount, reason) => {
  try {
    const response = await axios.post(
      `${KKIAPAY_BASE_URL}/v1/transfers`,
      {
        amount,
        phone: momoNumber,
        network: momoProvider.toUpperCase(), // 'MTN' ou 'MOOV'
        reason,
      },
      {
        headers: {
          'x-private-key': process.env.KKIAPAY_PRIVATE_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    return response.data;
  } catch (error) {
    console.error('KKiaPay erreur payout:', error.response?.data || error.message);
    throw new AppError('Erreur lors du virement vers le chauffeur', 500);
  }
};

/**
 * Libère les fonds vers le chauffeur après validation de la livraison par le client
 * Flux : escrow_held → payout 90% chauffeur + 10% plateforme
 */
const releaseFundsToDriver = async (orderId) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const orderResult = await dbClient.query(
      `SELECT o.*, dp.momo_number, dp.momo_provider, u.full_name AS driver_name
       FROM orders o
       JOIN driver_profiles dp ON dp.user_id = o.driver_id
       JOIN users u ON u.id = o.driver_id
       WHERE o.id = $1`,
      [orderId]
    );

    if (!orderResult.rows.length) {
      throw new AppError('Commande introuvable', 404);
    }

    const order = orderResult.rows[0];

    if (order.payment_status !== 'escrow_held') {
      throw new AppError('Les fonds ne sont pas en escrow', 400);
    }

    // Effectuer le virement vers le chauffeur via KKiaPay
    const payout = await payoutToDriver(
      order.momo_number,
      order.momo_provider,
      order.driver_amount,
      `LogiTruck - Course ${order.order_number || orderId}`
    );

    // Enregistrer la transaction de payout chauffeur
    await dbClient.query(
      `INSERT INTO transactions
        (order_id, type, amount, provider, status, provider_reference, metadata)
       VALUES ($1, 'driver_payout', $2, 'kkiapay', 'success', $3, $4)`,
      [
        orderId,
        order.driver_amount,
        payout.transactionId || null,
        JSON.stringify({
          momo_number: order.momo_number,
          momo_provider: order.momo_provider,
          driver_name: order.driver_name,
        }),
      ]
    );

    // Enregistrer la commission plateforme (10%)
    await dbClient.query(
      `INSERT INTO transactions
        (order_id, type, amount, provider, status)
       VALUES ($1, 'platform_fee', $2, 'kkiapay', 'success')`,
      [orderId, order.commission_amount]
    );

    // Mettre à jour le statut de paiement
    await dbClient.query(
      `UPDATE orders SET
        payment_status = 'released',
        status = 'completed',
        updated_at = NOW()
       WHERE id = $1`,
      [orderId]
    );

    // Remettre le chauffeur disponible et incrémenter ses stats
    await dbClient.query(
      `UPDATE driver_profiles SET
        total_trips = total_trips + 1,
        is_available = true,
        updated_at = NOW()
       WHERE user_id = $1`,
      [order.driver_id]
    );

    await dbClient.query('COMMIT');

    console.log(`Fonds libérés: ${order.driver_amount.toLocaleString()} FCFA → chauffeur ${order.driver_name}`);

    return {
      success: true,
      driver_amount: order.driver_amount,
      platform_fee: order.commission_amount,
    };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

/**
 * Traite le webhook KKiaPay (callback après paiement client)
 * KKiaPay envoie un POST quand le paiement est confirmé ou échoué
 */
const handleKKiaPayWebhook = async (req, res, next) => {
  try {
    const event = req.body;
    const signature = req.headers['x-kkiapay-signature'];

    // Vérifier la signature pour sécuriser le webhook
    if (!verifyKKiaPaySignature(event, signature)) {
      console.warn('Webhook KKiaPay: signature invalide');
      return res.status(401).json({ error: 'Signature invalide' });
    }

    const { status, transactionId, data: rawData } = event;

    // Parser les données personnalisées
    let customData = {};
    try {
      customData = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData || {});
    } catch {
      customData = {};
    }

    const { order_id, type } = customData;

    if (status === 'SUCCESS' && type === 'escrow_hold' && order_id) {
      // Paiement client confirmé → bloquer les fonds
      await query(
        `UPDATE orders SET
          payment_status = 'escrow_held',
          payment_reference = $1,
          payment_at = NOW(),
          status = 'pending',
          updated_at = NOW()
         WHERE id = $2 AND payment_status = 'unpaid'`,
        [transactionId, order_id]
      );

      // Enregistrer la transaction en base
      await query(
        `INSERT INTO transactions
          (order_id, type, amount, provider, status, provider_reference)
         SELECT id, 'escrow_hold', total_amount, 'kkiapay', 'success', $1
         FROM orders WHERE id = $2
         ON CONFLICT DO NOTHING`,
        [transactionId, order_id]
      );

      console.log(`Escrow KKiaPay confirmé - Commande ${order_id} - Ref: ${transactionId}`);

    } else if (status === 'FAILED' && order_id) {
      // Paiement échoué → notifier
      console.warn(`Paiement KKiaPay échoué - Commande ${order_id}`);
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyKKiaPaySignature,
  createEscrowPayment,
  verifyTransaction,
  payoutToDriver,
  releaseFundsToDriver,
  handleKKiaPayWebhook,
};
