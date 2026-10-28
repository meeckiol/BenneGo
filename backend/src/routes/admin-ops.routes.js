/**
 * Administration des opérations : litiges à la livraison, pannes/reliefs, baromètre des prix.
 */
const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { AppError } = require('../middlewares/error.middleware');
const { query } = require('../config/database');
const payments = require('../services/payment.service');
const relief = require('../services/sla-quarry.service');
const { CHAT_CLOSED, postAdminMessage } = require('../services/chat.service');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// GET /api/admin/disputes — litiges ouverts, avec photos du chargement et de la livraison contestée
router.get('/disputes', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT o.id, o.order_number, o.status, o.payment_status, o.total_amount, o.driver_amount,
              o.dispute_reason, o.dispute_opened_at, o.dispute_status,
              u_c.full_name AS client_name, u_c.phone AS client_phone,
              u_d.full_name AS driver_name, u_d.phone AS driver_phone,
              COALESCE((SELECT json_agg(p.url ORDER BY p.created_at) FROM order_photos p
                        WHERE p.order_id = o.id AND p.kind = 'dispute'), '[]') AS dispute_photos,
              COALESCE((SELECT json_agg(p.url ORDER BY p.created_at) FROM order_photos p
                        WHERE p.order_id = o.id AND p.kind = 'loading'), '[]') AS loading_photos,
              o.loading_volume_m3
       FROM orders o
       LEFT JOIN users u_c ON u_c.id = o.client_id
       LEFT JOIN users u_d ON u_d.id = o.driver_id
       WHERE o.dispute_status = 'open'
       ORDER BY o.dispute_opened_at ASC`
    );
    res.json({ disputes: rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/conversations?scope=active|dispute|all&q= — discussions client ↔ chauffeur
// active : commandes en cours avec chauffeur ; dispute : litiges ouverts ; all : toute commande ayant des messages
router.get('/conversations', async (req, res, next) => {
  try {
    const scope = ['active', 'dispute', 'all'].includes(req.query.scope) ? req.query.scope : 'active';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    const params = [CHAT_CLOSED];
    const where = [];
    if (scope === 'active') where.push('o.driver_id IS NOT NULL AND o.status <> ALL($1)');
    if (scope === 'dispute') where.push("o.dispute_status = 'open'");
    if (scope === 'all') where.push('m.message_count > 0');
    if (q) {
      params.push(`%${q}%`);
      where.push(`(o.order_number ILIKE $${params.length} OR u_c.full_name ILIKE $${params.length} OR u_d.full_name ILIKE $${params.length})`);
    }
    const { rows } = await query(
      `SELECT o.id, o.order_number, o.status, o.dispute_status, o.created_at,
              u_c.full_name AS client_name, u_c.phone AS client_phone,
              u_d.full_name AS driver_name, u_d.phone AS driver_phone,
              COALESCE(m.message_count, 0)::int AS message_count,
              last.message AS last_message, last.sender_role AS last_sender_role, last.created_at AS last_at,
              (o.status = ANY($1)) AS closed
       FROM orders o
       LEFT JOIN users u_c ON u_c.id = o.client_id
       LEFT JOIN users u_d ON u_d.id = o.driver_id
       LEFT JOIN LATERAL (SELECT COUNT(*) AS message_count FROM order_chat_messages WHERE order_id = o.id) m ON true
       LEFT JOIN LATERAL (SELECT message, sender_role, created_at FROM order_chat_messages
                          WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) last ON true
       WHERE ${where.join(' AND ') || 'true'}
       ORDER BY COALESCE(last.created_at, o.created_at) DESC
       LIMIT 100`,
      params
    );
    res.json({ conversations: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/orders/:id/chat — { message } : l'assistance écrit au client et au chauffeur
router.post('/orders/:id/chat', [
  param('id').isUUID(),
  body('message').isString().trim().notEmpty().withMessage('Message vide').isLength({ max: 1000 }),
], validateRequest, async (req, res, next) => {
  try {
    const msg = await postAdminMessage(req.app.get('io'), req.params.id, req.user, req.body.message.trim());
    if (!msg) throw new AppError('Commande introuvable', 404);
    res.status(201).json({ message: msg });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/orders/:id/dispute/resolve — { decision: 'refund' | 'release', note }
router.post('/orders/:id/dispute/resolve', [
  param('id').isUUID(),
  body('decision').isIn(['refund', 'release']).withMessage('Décision invalide (refund ou release)'),
  body('note').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
], validateRequest, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, dispute_status FROM orders WHERE id = $1', [req.params.id]);
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    if (rows[0].dispute_status !== 'open') throw new AppError('Aucun litige ouvert sur cette commande', 409);

    if (req.body.decision === 'refund') {
      await payments.refundEscrow(req.params.id, {
        actor: req.user,
        reason: req.body.note || 'Litige à la livraison : remboursement',
      });
      return res.json({ message: 'Client remboursé, litige clos' });
    }
    await payments.confirmDelivery(req.params.id, null, { adminOverride: true });
    return res.json({ message: 'Livraison validée, reversement au chauffeur lancé' });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reliefs — pannes en attente + chauffeurs de réserve disponibles
router.get('/reliefs', async (req, res, next) => {
  try {
    const [requests, candidates] = await Promise.all([
      relief.listOpenReliefs(),
      relief.listReliefCandidates(),
    ]);
    res.json({ requests, candidates });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/reliefs/:id/assign — { relief_driver_id } : réassigne la course à la benne de réserve
router.post('/reliefs/:id/assign', [
  param('id').isUUID(),
  body('relief_driver_id').isUUID().withMessage('Chauffeur de réserve requis'),
], validateRequest, async (req, res, next) => {
  try {
    const request = await relief.assignReliefDriver(req.params.id, req.body.relief_driver_id);
    const io = req.app.get('io');
    if (io) {
      const payload = { order_id: request.order_id };
      io.to(`driver_${request.relief_driver_id}`).emit('order_reassigned', payload);
      io.to(`driver_${request.original_driver_id}`).emit('order_reassigned', payload);
    }
    res.json({ message: 'Course réassignée à la benne de réserve', request });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/barometer — publication hebdomadaire d'un indice (upsert par matériau et semaine)
router.post('/barometer', [
  body('material_name').trim().notEmpty().isLength({ max: 100 }),
  body('min_price_m3').isFloat({ min: 0 }),
  body('avg_price_m3').isFloat({ min: 0 }),
  body('max_price_m3').isFloat({ min: 0 }),
  body('trend').isIn(['up', 'down', 'stable']),
  body('week_number').isInt({ min: 1, max: 53 }),
  body('year').isInt({ min: 2024, max: 2100 }),
], validateRequest, async (req, res, next) => {
  try {
    const { material_name, min_price_m3, avg_price_m3, max_price_m3, trend, week_number, year } = req.body;
    if (!(Number(min_price_m3) <= Number(avg_price_m3) && Number(avg_price_m3) <= Number(max_price_m3))) {
      throw new AppError('Prix : min ≤ moyen ≤ max', 400);
    }
    const { rows } = await query(
      `INSERT INTO btp_price_barometer (material_name, avg_price_m3, min_price_m3, max_price_m3, week_number, year, trend)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (material_name, week_number, year)
       DO UPDATE SET avg_price_m3 = EXCLUDED.avg_price_m3, min_price_m3 = EXCLUDED.min_price_m3,
                     max_price_m3 = EXCLUDED.max_price_m3, trend = EXCLUDED.trend
       RETURNING *`,
      [material_name, avg_price_m3, min_price_m3, max_price_m3, week_number, year, trend]
    );
    res.status(201).json({ message: 'Indice publié', barometer: rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
