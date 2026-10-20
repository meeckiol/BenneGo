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

// POST /api/orders/bulk - Planification massive B2B (BenneGo Enterprise)
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

// =============================================
// PREUVE DE LIVRAISON (PoD) & CHAT EN MISSION
// =============================================
const multer = require('multer');
const { query } = require('../config/database');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 5 }, // max 2Mo par photo, 5 photos
  fileFilter: (req, file, cb) => (
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Format image invalide (JPEG, PNG ou WebP uniquement)'))
  ),
});
// Vérifie la signature réelle du fichier (le mimetype vient du client)
const hasImageSignature = (buf) => (
  (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF)
  || (buf.slice(0, 4).toString('hex') === '89504e47')
  || (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP')
);
const POD_ALLOWED_STATUSES = ['driver_en_route_delivery', 'dumping', 'machine_operating', 'delivered'];
const MAX_POD_PHOTOS = 10;

// POST /api/orders/:id/pod - Upload photos preuve de livraison (Chauffeur)
router.post('/:id/pod', requireRole('driver'), upload.array('photos', 5), [
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

    const files = req.files || [];
    if (files.some((f) => !hasImageSignature(f.buffer))) {
      return res.status(400).json({ error: 'Fichier image invalide' });
    }
    const photoData = files.map((f) => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`);
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
      [JSON.stringify(photoData), notes, req.params.id]
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

module.exports = router;
