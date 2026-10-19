const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { query } = require('../config/database');

const router = express.Router();

// Toutes les routes requièrent une authentification client
router.use(authenticate, requireRole('client'));

// POST /api/orders/recurring — créer un template de commande récurrente
router.post('/', [
  body('frequency').isIn(['daily', 'weekly', 'biweekly', 'monthly']).withMessage('Fréquence invalide'),
  body('order_template').isObject().withMessage('Template de commande requis'),
  body('next_run_date').isISO8601().withMessage('Date de prochaine exécution invalide (YYYY-MM-DD)'),
], validateRequest, async (req, res, next) => {
  try {
    const { frequency, order_template, next_run_date } = req.body;

    const { rows } = await query(
      `INSERT INTO recurring_orders (client_id, frequency, order_template, next_run_date, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [req.user.id, frequency, JSON.stringify(order_template), next_run_date]
    );

    res.status(201).json({
      recurring_order: rows[0],
      message: 'Commande récurrente créée avec succès',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/recurring — lister ses commandes récurrentes
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM recurring_orders
       WHERE client_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ recurring_orders: rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/orders/recurring/:id — modifier une commande récurrente
router.patch('/:id', [
  param('id').isUUID(),
  body('frequency').optional().isIn(['daily', 'weekly', 'biweekly', 'monthly']),
  body('order_template').optional().isObject(),
  body('next_run_date').optional().isISO8601(),
  body('is_active').optional().isBoolean(),
], validateRequest, async (req, res, next) => {
  try {
    const fields = ['frequency', 'next_run_date', 'is_active'];
    const updates = [];
    const params = [];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        params.push(req.body[f]);
        updates.push(`${f} = $${params.length}`);
      }
    });

    if (req.body.order_template !== undefined) {
      params.push(JSON.stringify(req.body.order_template));
      updates.push(`order_template = $${params.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'Aucun champ à modifier' });

    params.push(req.params.id, req.user.id);
    const { rows } = await query(
      `UPDATE recurring_orders
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length - 1} AND client_id = $${params.length}
       RETURNING *`,
      params
    );

    if (!rows.length) return res.status(404).json({ error: 'Commande récurrente non trouvée' });
    res.json({ recurring_order: rows[0], message: 'Commande récurrente mise à jour' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/orders/recurring/:id — supprimer une commande récurrente
router.delete('/:id', [
  param('id').isUUID(),
], validateRequest, async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM recurring_orders WHERE id = $1 AND client_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Commande récurrente non trouvée' });
    res.json({ message: 'Commande récurrente supprimée' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
