const express = require('express');
const { body, param } = require('express-validator');
const {
  estimatePrice, createOrder, createBulkOrders, getOrders, getOrder,
  acceptOrder, updateOrderStatus, confirmDelivery, confirmRental, confirmEvacuation,
  driverConfirmDump, cancelOrder, getTracking,
  getReceiptClient, getReceiptDriver,
} = require('../controllers/order.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// POST /api/orders/estimate - Estimateur de prix multi-services
router.post('/estimate', [
  body('order_type').optional().isIn(['MATERIAL', 'RENTAL', 'EVACUATION']),
  body('pickup_lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('pickup_lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('delivery_lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('delivery_lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
], validateRequest, estimatePrice);

// POST /api/orders - Créer une commande (Matériaux, Location Engin, Évacuation)
router.post('/', requireRole('client'), [
  body('order_type').optional().isIn(['MATERIAL', 'RENTAL', 'EVACUATION']),
  body('project_id').optional({ nullable: true }).isUUID(),
  body('vehicle_type_id').optional({ nullable: true }).isUUID(),
  body('pickup_lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('pickup_lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('pickup_address').optional({ nullable: true }).trim(),
  body('delivery_lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('delivery_lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('delivery_address').optional({ nullable: true }).trim(),
  body('quantity_m3').optional({ nullable: true }).isFloat({ min: 0.1, max: 500 }),
  body('duration_hours').optional({ nullable: true }).isFloat({ min: 1, max: 720 }),
  body('truck_type').optional().isString(),
  body('material_type_id').optional({ nullable: true }).isUUID(),
], validateRequest, createOrder);

// POST /api/orders/bulk - Planification massive B2B (LogiTruck Enterprise)
router.post('/bulk', requireRole('client'), [
  body('project_id').optional({ nullable: true }).isUUID(),
  body('order_type').optional().isIn(['MATERIAL', 'RENTAL', 'EVACUATION']),
  body('pickup_lat').isFloat({ min: -90, max: 90 }),
  body('pickup_lng').isFloat({ min: -180, max: 180 }),
  body('pickup_address').trim().notEmpty(),
  body('delivery_lat').isFloat({ min: -90, max: 90 }),
  body('delivery_lng').isFloat({ min: -180, max: 180 }),
  body('delivery_address').trim().notEmpty(),
  body('rotations_per_day').isInt({ min: 1, max: 50 }),
  body('number_of_days').isInt({ min: 1, max: 30 }),
], validateRequest, createBulkOrders);

// GET /api/orders - Liste des commandes
router.get('/', getOrders);

// GET /api/orders/:id - Détail d'une commande
router.get('/:id', [
  param('id').isUUID(),
], validateRequest, getOrder);

// PATCH /api/orders/:id/accept - Chauffeur ou conducteur d'engin accepte
router.patch('/:id/accept', requireRole('driver'), [
  param('id').isUUID(),
], validateRequest, acceptOrder);

// PATCH /api/orders/:id/status - Le chauffeur/opérateur fait avancer la mission
router.patch('/:id/status', requireRole('driver'), [
  param('id').isUUID(),
  body('status').isIn([
    'driver_en_route_pickup',
    'loading',
    'driver_en_route_delivery',
    'machine_operating',
    'dumping',
    'delivered',
  ]),
], validateRequest, updateOrderStatus);

// POST /api/orders/:id/driver-confirm-dump - Pour évacuation : chauffeur confirme la décharge
router.post('/:id/driver-confirm-dump', requireRole('driver'), [
  param('id').isUUID(),
], validateRequest, driverConfirmDump);

// POST /api/orders/:id/confirm-delivery - Le client confirme la réception standard
router.post('/:id/confirm-delivery', requireRole('client'), [
  param('id').isUUID(),
], validateRequest, confirmDelivery);

// POST /api/orders/:id/confirm-rental - Le client valide les heures d'opération de l'engin (libère séquestre)
router.post('/:id/confirm-rental', requireRole('client'), [
  param('id').isUUID(),
], validateRequest, confirmRental);

// POST /api/orders/:id/confirm-evacuation - Le client valide la propreté du chantier (libère séquestre)
router.post('/:id/confirm-evacuation', requireRole('client'), [
  param('id').isUUID(),
], validateRequest, confirmEvacuation);

// POST /api/orders/:id/cancel - Annulation (remboursement si déjà payé et pas encore accepté)
router.post('/:id/cancel', requireRole('client'), [
  param('id').isUUID(),
  body('reason').optional({ nullable: true }).isString().isLength({ max: 300 }),
], validateRequest, cancelOrder);

// GET /api/orders/:id/tracking - Position + trajet + déviations GPS
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
