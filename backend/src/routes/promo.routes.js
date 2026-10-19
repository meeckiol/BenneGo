const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { query } = require('../config/database');

const router = express.Router();

// =============================================
// CLIENT — Validation d'un code promo
// =============================================

// POST /api/promo/validate — valide un code promo
router.post('/validate', authenticate, [
  body('code').trim().notEmpty().withMessage('Le code promo est requis'),
  body('order_amount').isFloat({ min: 0 }).withMessage('Le montant de la commande est requis'),
], validateRequest, async (req, res, next) => {
  try {
    const { code, order_amount } = req.body;

    const { rows } = await query(
      `SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1)`,
      [code]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Code promo invalide ou inexistant' });
    }

    const promo = rows[0];

    if (!promo.is_active) {
      return res.status(400).json({ error: 'Ce code promo est inactif' });
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Ce code promo a expiré' });
    }

    if (promo.usage_limit !== null && promo.times_used >= promo.usage_limit) {
      return res.status(400).json({ error: 'Ce code promo a atteint sa limite d\'utilisation' });
    }

    if (promo.min_order_amount !== null && parseFloat(order_amount) < parseFloat(promo.min_order_amount)) {
      return res.status(400).json({
        error: `Ce code promo nécessite un montant minimum de ${promo.min_order_amount} XOF`,
      });
    }

    let discount_amount = 0;
    if (promo.discount_type === 'percentage') {
      discount_amount = (parseFloat(order_amount) * parseFloat(promo.discount_value)) / 100;
    } else {
      // fixed
      discount_amount = parseFloat(promo.discount_value);
    }

    // Plafonner par max_discount
    if (promo.max_discount !== null && discount_amount > parseFloat(promo.max_discount)) {
      discount_amount = parseFloat(promo.max_discount);
    }

    // Ne pas dépasser le montant total
    discount_amount = Math.min(discount_amount, parseFloat(order_amount));
    discount_amount = Math.round(discount_amount);

    const final_amount = Math.max(0, parseFloat(order_amount) - discount_amount);

    res.json({
      code: promo.code,
      discount_amount,
      final_amount,
      message: `Code promo appliqué : -${discount_amount} XOF`,
      promo_id: promo.id,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// ADMIN — Gestion des codes promo
// =============================================

// GET /api/admin/promos — liste tous les codes promo
router.get('/admin', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM promo_codes ORDER BY created_at DESC`
    );
    res.json({ promos: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/promos — créer un code promo
router.post('/admin', authenticate, requireRole('admin'), [
  body('code').trim().notEmpty().toUpperCase().withMessage('Le code est requis'),
  body('discount_type').isIn(['percentage', 'fixed']).withMessage('Type invalide'),
  body('discount_value').isFloat({ min: 0 }).withMessage('Valeur de réduction requise'),
  body('max_discount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('min_order_amount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('usage_limit').optional({ nullable: true }).isInt({ min: 1 }),
  body('expires_at').optional({ nullable: true }).isISO8601(),
  body('is_active').optional().isBoolean(),
], validateRequest, async (req, res, next) => {
  try {
    const {
      code, discount_type, discount_value, max_discount = null,
      min_order_amount = null, usage_limit = null, expires_at = null, is_active = true,
    } = req.body;

    const { rows } = await query(
      `INSERT INTO promo_codes (code, discount_type, discount_value, max_discount,
        min_order_amount, usage_limit, expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [code.toUpperCase(), discount_type, discount_value, max_discount,
        min_order_amount, usage_limit, expires_at, is_active]
    );

    res.status(201).json({ promo: rows[0], message: 'Code promo créé avec succès' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ce code promo existe déjà' });
    }
    next(error);
  }
});

// PATCH /api/admin/promos/:id — modifier un code promo
router.patch('/admin/:id', authenticate, requireRole('admin'), [
  param('id').isUUID(),
  body('discount_type').optional().isIn(['percentage', 'fixed']),
  body('discount_value').optional().isFloat({ min: 0 }),
  body('max_discount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('min_order_amount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('usage_limit').optional({ nullable: true }).isInt({ min: 1 }),
  body('expires_at').optional({ nullable: true }).isISO8601(),
  body('is_active').optional().isBoolean(),
], validateRequest, async (req, res, next) => {
  try {
    const fields = ['discount_type', 'discount_value', 'max_discount', 'min_order_amount',
      'usage_limit', 'expires_at', 'is_active'];
    const updates = [];
    const params = [];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        params.push(req.body[f]);
        updates.push(`${f} = $${params.length}`);
      }
    });

    if (!updates.length) return res.status(400).json({ error: 'Aucun champ à modifier' });

    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE promo_codes SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (!rows.length) return res.status(404).json({ error: 'Code promo non trouvé' });
    res.json({ promo: rows[0], message: 'Code promo mis à jour' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/promos/:id — supprimer un code promo
router.delete('/admin/:id', authenticate, requireRole('admin'), [
  param('id').isUUID(),
], validateRequest, async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM promo_codes WHERE id = $1`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Code promo non trouvé' });
    res.json({ message: 'Code promo supprimé' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
