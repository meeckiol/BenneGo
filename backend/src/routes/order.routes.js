const express = require('express');
const { body, param } = require('express-validator');
const {
  estimatePrice, createOrder, createBulkOrders, getOrders, getOrder,
  acceptOrder, updateOrderStatus, confirmDelivery, confirmRental, confirmEvacuation,
  driverConfirmDump, cancelOrder, getTracking,
  getReceiptClient, getReceiptDriver,
  recordLoading, openDispute, reportBreakdown,
} = require('../controllers/order.controller');
const { uploadPhotos, saveImage } = require('../services/photo.service');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { unreadFor, markRead } = require('../services/chat.service');
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
  body('project_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
  body('vehicle_type_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
  body('pickup_lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('pickup_lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('pickup_address').optional({ nullable: true }).trim(),
  body('delivery_lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('delivery_lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('delivery_address').optional({ nullable: true }).trim(),
  body('quantity_m3').optional({ nullable: true }).isFloat({ min: 0.1, max: 500 }),
  body('duration_hours').optional({ nullable: true }).isFloat({ min: 1, max: 720 }),
  body('truck_type').optional().isString(),
  body('material_type_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
], validateRequest, createOrder);

// POST /api/orders/bulk - Planification massive B2B (BenneGo Enterprise)
router.post('/bulk', requireRole('client'), [
  body('project_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
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
// GET /api/orders/chat/unread : messages non lus par discussion en cours
router.get('/chat/unread', async (req, res, next) => {
  try {
    const rows = await unreadFor(req.user.id);
    res.json({ unread: rows, total: rows.reduce((sum, r) => sum + r.unread, 0) });
  } catch (error) {
    next(error);
  }
});

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

// =============================================
// PREUVE DE LIVRAISON (PoD) & CHAT EN MISSION
// =============================================
const { query } = require('../config/database');
const POD_ALLOWED_STATUSES = ['driver_en_route_delivery', 'dumping', 'machine_operating', 'delivered'];
const MAX_POD_PHOTOS = 10;

// POST /api/orders/:id/pod - Upload photos preuve de livraison (Chauffeur)
router.post('/:id/pod', requireRole('driver'), uploadPhotos.array('photos', 5), [
  param('id').isUUID(),
], validateRequest, async (req, res, next) => {
  try {
    const orderRes = await query(
      'SELECT id, driver_id, status FROM orders WHERE id = $1',
      [req.params.id]
    );
    if (!orderRes.rows.length) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    if (orderRes.rows[0].driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Vous n\'êtes pas le chauffeur de cette commande' });
    }

    if (!POD_ALLOWED_STATUSES.includes(orderRes.rows[0].status)) {
      return res.status(409).json({ error: 'Cette commande n\'accepte plus de photos de livraison' });
    }

    const photoUrls = await Promise.all((req.files || []).map(saveImage));
    const notes = typeof req.body.notes === 'string' ? req.body.notes.slice(0, 500) : null;

    const updateRes = await query(
      `UPDATE orders
       SET pod_photos = COALESCE(pod_photos, '[]'::jsonb) || $1::jsonb,
           pod_notes = COALESCE($2, pod_notes),
           pod_submitted_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
         AND jsonb_array_length(COALESCE(pod_photos, '[]'::jsonb)) + jsonb_array_length($1::jsonb) <= ${MAX_POD_PHOTOS}
       RETURNING id, order_number, pod_photos, pod_notes, pod_submitted_at`,
      [JSON.stringify(photoUrls), notes, req.params.id]
    );

    if (!updateRes.rows.length) {
      return res.status(409).json({ error: `Maximum ${MAX_POD_PHOTOS} photos par commande atteint` });
    }

    res.json({
      message: 'Preuve de livraison enregistrée avec succès',
      order: updateRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// CHARGEMENT, LITIGE & PANNE
// =============================================

// POST /api/orders/:id/loading - Volume chargé + photos du chargement (et ticket de pesée) avant le départ
router.post('/:id/loading', requireRole('driver'), uploadPhotos.fields([
  { name: 'photos', maxCount: 5 },
  { name: 'weighbridge', maxCount: 1 },
]), [
  param('id').isUUID(),
  body('volume_m3').isFloat({ min: 0.5, max: 100 }).withMessage('Volume chargé invalide (0,5 à 100 m³)'),
  body('weighbridge_net_kg').optional({ checkFalsy: true }).isInt({ min: 1, max: 100000 }).withMessage('Poids net invalide'),
], validateRequest, recordLoading);

// POST /api/orders/:id/dispute - Le client refuse la livraison (photos + motif) avant de confirmer
router.post('/:id/dispute', requireRole('client'), uploadPhotos.array('photos', 5), [
  param('id').isUUID(),
  body('reason').isString().trim().isLength({ min: 10, max: 1000 }).withMessage('Décrivez le problème (10 à 1000 caractères)'),
], validateRequest, openDispute);

// POST /api/orders/:id/breakdown - Le chauffeur signale une panne ou une crevaison en course
router.post('/:id/breakdown', requireRole('driver'), [
  param('id').isUUID(),
  body('reason').isIn(['crevaison', 'panne_moteur', 'accident', 'autre']).withMessage('Motif invalide'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Position GPS requise'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Position GPS requise'),
], validateRequest, reportBreakdown);

// GET /api/orders/:id/chat - Historique du chat
router.get('/:id/chat', [
  param('id').isUUID(),
], validateRequest, async (req, res, next) => {
  try {
    const orderRes = await query(
      'SELECT id, client_id, driver_id FROM orders WHERE id = $1',
      [req.params.id]
    );
    if (!orderRes.rows.length) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    const order = orderRes.rows[0];
    if (req.user.role !== 'admin' && order.client_id !== req.user.id && order.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé à cette discussion' });
    }

    const { rows } = await query(
      `SELECT id, order_id, sender_id, sender_name, sender_role, message, created_at
       FROM order_chat_messages
       WHERE order_id = $1
       ORDER BY created_at ASC
       LIMIT 100`,
      [req.params.id]
    );

    res.json({ messages: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/:id/chat/read : la discussion a été lue jusqu'à maintenant
router.post('/:id/chat/read', [
  param('id').isUUID(),
], validateRequest, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT client_id, driver_id FROM orders WHERE id = $1', [req.params.id]);
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
    if (order.client_id !== req.user.id && order.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé à cette discussion' });
    }
    await markRead(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
