const express = require('express');
const { body, param } = require('express-validator');
const {
  estimatePrice, createOrder, getOrders, getOrder,
  acceptOrder, updateOrderStatus,
} = require('../controllers/order.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// POST /api/orders/estimate - Estimateur de prix
router.post('/estimate', [
  body('pickup_lat').isFloat({ min: -90, max: 90 }),
  body('pickup_lng').isFloat({ min: -180, max: 180 }),
  body('delivery_lat').isFloat({ min: -90, max: 90 }),
  body('delivery_lng').isFloat({ min: -180, max: 180 }),
], validateRequest, estimatePrice);

// POST /api/orders - Créer une commande
router.post('/', requireRole('client'), [
  body('pickup_lat').isFloat({ min: -90, max: 90 }),
  body('pickup_lng').isFloat({ min: -180, max: 180 }),
  body('pickup_address').trim().notEmpty(),
  body('delivery_lat').isFloat({ min: -90, max: 90 }),
  body('delivery_lng').isFloat({ min: -180, max: 180 }),
  body('delivery_address').trim().notEmpty(),
  body('quantity_m3').isFloat({ min: 0.1 }),
], validateRequest, createOrder);

// GET /api/orders - Liste des commandes
router.get('/', getOrders);

// GET /api/orders/:id - Détail d'une commande
router.get('/:id', [
  param('id').isUUID(),
], validateRequest, getOrder);

// PATCH /api/orders/:id/accept - Chauffeur accepte
router.patch('/:id/accept', requireRole('driver'), [
  param('id').isUUID(),
], validateRequest, acceptOrder);

// PATCH /api/orders/:id/status - Mise à jour statut
router.patch('/:id/status', [
  param('id').isUUID(),
  body('status').notEmpty(),
], validateRequest, updateOrderStatus);

module.exports = router;
