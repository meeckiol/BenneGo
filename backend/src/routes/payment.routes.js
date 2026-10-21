const express = require('express');
const { param, body } = require('express-validator');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const payments = require('../services/payment.service');
const events = require('../services/order-events');
const { query } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');

const router = express.Router();

// POST /api/payments/webhook/kkiapay — appelé par KKiaPay (authentifié par x-kkiapay-secret)
const webhookLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de requêtes webhook' },
});
router.post('/webhook/kkiapay', webhookLimiter, payments.handleKKiaPayWebhook);

router.use(authenticate);

// GET /api/payments/orders/:orderId/checkout
// Paramètres du widget KKiaPay : le client paie en même temps qu'il commande.
router.get('/orders/:orderId/checkout', requireRole('client'),
  [param('orderId').isUUID()], validateRequest, async (req, res, next) => {
    try {
      res.json(await payments.getCheckoutConfig(req.params.orderId, req.user));
    } catch (error) {
      next(error);
    }
  });

// POST /api/payments/orders/:orderId/confirm  { transaction_id }
// Après le paiement : l'argent est bloqué en séquestre et la commande est publiée aux chauffeurs.
router.post('/orders/:orderId/confirm', requireRole('client'), [
  param('orderId').isUUID(),
  body('transaction_id').isString().trim().notEmpty().isLength({ max: 100 }),
], validateRequest, async (req, res, next) => {
  try {
    const { order, alreadyConfirmed } = await payments.confirmEscrow(
      req.params.orderId, req.body.transaction_id, { clientId: req.user.id }
    );
    if (!alreadyConfirmed) {
      const io = req.app.get('io');
      events.notifyPaymentSecured(io, order);
      events.notifyNewOrder(io, order);
    }
    res.json({
      message: 'Paiement sécurisé. Votre argent est bloqué sur BenneGo jusqu\'à la confirmation de la livraison.',
      payment_status: order.payment_status,
      status: order.status,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/orders/:orderId/status — état du paiement (propriétaire ou admin)
router.get('/orders/:orderId/status', [param('orderId').isUUID()], validateRequest, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT client_id, status, payment_status, total_amount, commission_amount, driver_amount FROM orders WHERE id = $1',
      [req.params.orderId]
    );
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    const o = rows[0];
    if (req.user.role !== 'admin' && o.client_id !== req.user.id) throw new AppError('Accès refusé', 403);
    res.json({
      status: o.status,
      payment_status: o.payment_status,
      total_amount: Number(o.total_amount),
      commission_amount: Number(o.commission_amount),
      driver_amount: Number(o.driver_amount),
    });
  } catch (error) {
    next(error);
  }
});

// ----- Administration -----

// POST /api/payments/orders/:orderId/release — libération des fonds vers le chauffeur (admin)                                                                    
    router.post('/orders/:orderId/release', requireRole('admin'), [param('orderId').isUUID()],                                                                                             
      validateRequest, async (req, res, next) => {                                                                                                                                         
        try {                                                                                                                                                                              
          res.json(await payments.settlePayout(req.params.orderId));                                                                                                                       
        } catch (error) {                                                                                                                                                                  
          next(error);                                                                                                                                                                     
        }                                                                                                                                                                                  
      });

// POST /api/payments/orders/:orderId/refund — remboursement (litige / chauffeur absent)
router.post('/orders/:orderId/refund', requireRole('admin'), [param('orderId').isUUID()],
  validateRequest, async (req, res, next) => {
    try {
      await payments.refundEscrow(req.params.orderId, { actor: req.user, reason: req.body.reason });
      res.json({ message: 'Client remboursé' });
    } catch (error) {
      next(error);
    }
  });

// POST /api/payments/orders/:orderId/retry-payout — relance d'un reversement chauffeur échoué
router.post('/orders/:orderId/retry-payout', requireRole('admin'), [param('orderId').isUUID()],
  validateRequest, async (req, res, next) => {
    try {
      res.json(await payments.settlePayout(req.params.orderId));
    } catch (error) {
      next(error);
    }
  });

// POST /api/payments/orders/:orderId/mark-paid { reference } — reversement manuel effectué
router.post('/orders/:orderId/mark-paid', requireRole('admin'), [
  param('orderId').isUUID(),
  body('reference').isString().trim().notEmpty().isLength({ max: 100 }),
], validateRequest, async (req, res, next) => {
  try {
    await payments.markPayoutPaid(req.params.orderId, req.body.reference);
    res.json({ message: 'Reversement enregistré, commande terminée' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
