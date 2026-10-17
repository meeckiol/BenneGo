const express = require('express');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const {
  createEscrowPayment,
  verifyTransaction,
  releaseFundsToDriver,
  handleKKiaPayWebhook,
} = require('../services/payment.service');
const { query } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');

const router = express.Router();

// POST /api/payments/orders/:orderId/pay
// Client initie le paiement escrow via KKiaPay
router.post('/orders/:orderId/pay', authenticate, requireRole('client'), async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { payment_method = 'mtn_momo' } = req.body;

    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1 AND client_id = $2',
      [orderId, req.user.id]
    );

    if (!orderResult.rows.length) {
      throw new AppError('Commande introuvable', 404);
    }

    const order = orderResult.rows[0];

    if (order.payment_status !== 'unpaid') {
      throw new AppError('Cette commande a déjà été payée', 409);
    }

    // Créer le paiement KKiaPay
    const payment = await createEscrowPayment(
      order.id,
      order.total_amount,
      req.user.phone,
      req.user.full_name
    );

    // Sauvegarder la méthode et la référence
    await query(
      `UPDATE orders SET
        payment_method = $1,
        payment_reference = $2,
        updated_at = NOW()
       WHERE id = $3`,
      [payment_method, payment.reference, orderId]
    );

    res.json({
      message: 'Lien de paiement KKiaPay généré',
      payment_url: payment.payment_url,
      transaction_id: payment.transaction_id,
      amount: order.total_amount,
      instructions: 'Ouvrez ce lien sur votre téléphone et payez via MTN MoMo ou Moov Money',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/orders/:orderId/verify
// Vérifie le statut d'un paiement KKiaPay
router.get('/orders/:orderId/verify', authenticate, async (req, res, next) => {
  try {
    const orderResult = await query(
      'SELECT payment_reference, payment_status FROM orders WHERE id = $1',
      [req.params.orderId]
    );

    if (!orderResult.rows.length) {
      throw new AppError('Commande introuvable', 404);
    }

    const { payment_reference, payment_status } = orderResult.rows[0];

    if (!payment_reference) {
      return res.json({ payment_status: 'unpaid', verified: false });
    }

    // Vérifier directement auprès de KKiaPay
    const kkiaStatus = await verifyTransaction(payment_reference);

    res.json({
      payment_status,
      kkiapay_status: kkiaStatus.status,
      verified: kkiaStatus.status === 'SUCCESS',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/webhook/kkiapay
// Webhook KKiaPay — appelé automatiquement par KKiaPay après chaque paiement
router.post(
  '/webhook/kkiapay',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    // Convertir le buffer en objet si nécessaire
    if (Buffer.isBuffer(req.body)) {
      try { req.body = JSON.parse(req.body.toString()); } catch { req.body = {}; }
    }
    next();
  },
  handleKKiaPayWebhook
);

// POST /api/payments/orders/:orderId/release
// Admin libère manuellement les fonds vers le chauffeur
router.post(
  '/orders/:orderId/release',
  authenticate,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const result = await releaseFundsToDriver(req.params.orderId);
      res.json({
        message: 'Fonds libérés via KKiaPay vers le chauffeur',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
