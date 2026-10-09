const express = require('express');
const { body, param } = require('express-validator');
const {
  estimatePrice, createOrder, getOrders, getOrder,
  acceptOrder, updateOrderStatus, confirmDelivery, cancelOrder, getTracking,
  getReceiptClient, getReceiptDriver,
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
  body('quantity_m3').isFloat({ min: 0.1, max: 200 }),
  body('truck_type').optional().isIn(['simple_benne', 'double_benne', 'plateau']),
  body('material_type_id').optional({ nullable: true }).isUUID(),
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

// PATCH /api/orders/:id/status - Le chauffeur fait avancer la course
router.patch('/:id/status', requireRole('driver'), [
  param('id').isUUID(),
  body('status').isIn(['driver_en_route_pickup', 'loading', 'driver_en_route_delivery', 'delivered']),
], validateRequest, updateOrderStatus);

// POST /api/orders/:id/confirm-delivery - Le client confirme la réception → libération des fonds
router.post('/:id/confirm-delivery', requireRole('client'), [
  param('id').isUUID(),
], validateRequest, confirmDelivery);

// POST /api/orders/:id/cancel - Annulation (remboursement si déjà payé et pas encore accepté)
router.post('/:id/cancel', requireRole('client'), [
  param('id').isUUID(),
  body('reason').optional({ nullable: true }).isString().isLength({ max: 300 }),
], validateRequest, cancelOrder);

// GET /api/orders/:id/tracking - Position + trajet du chauffeur
router.get('/:id/tracking', [
  param('id').isUUID(),
], validateRequest, getTracking);

// GET /api/orders/:id/receipt - Reçu client (PDF téléchargeable)
router.get('/:id/receipt', [
  param('id').isUUID(),
], validateRequest, getReceiptClient);

// GET /api/orders/:id/receipt/driver - Reçu conducteur (PDF téléchargeable)
router.get('/:id/receipt/driver', [
  param('id').isUUID(),
], validateRequest, getReceiptDriver);

module.exports = router;
