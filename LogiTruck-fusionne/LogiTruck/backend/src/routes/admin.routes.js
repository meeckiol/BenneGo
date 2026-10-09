const express = require('express');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { query } = require('../config/database');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// GET /api/admin/stats - Statistiques générales
router.get('/stats', async (req, res, next) => {
  try {
    const [orders, revenue, drivers, clients] = await Promise.all([
      query(`SELECT
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status IN ('awaiting_payment', 'pending')) AS pending,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        COUNT(*) AS total
       FROM orders`),
      query(`SELECT
        COALESCE(SUM(commission_amount) FILTER (WHERE payment_status IN ('payout_pending', 'released')), 0) AS total_revenue,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status IN ('escrow_held', 'payout_pending', 'released')), 0) AS total_gmv,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'escrow_held'), 0) AS escrow_balance,
        COALESCE(SUM(driver_amount) FILTER (WHERE payment_status = 'payout_pending'), 0) AS payouts_due
       FROM orders`),
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE dp.is_available) AS available
             FROM users u JOIN driver_profiles dp ON dp.user_id = u.id WHERE u.role = 'driver'`),
      query(`SELECT COUNT(*) AS total FROM users WHERE role = 'client'`),
    ]);

    res.json({
      orders: orders.rows[0],
      revenue: revenue.rows[0],
      drivers: drivers.rows[0],
      clients: clients.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/orders - Toutes les commandes
router.get('/orders', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;
    const params = [];
    let where = '';

    if (status) {
      where = 'WHERE o.status = $1';
      params.push(status);
    }

    const result = await query(
      `SELECT o.*, u_c.full_name AS client_name, u_d.full_name AS driver_name
       FROM orders o
       LEFT JOIN users u_c ON u_c.id = o.client_id
       LEFT JOIN users u_d ON u_d.id = o.driver_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, lim, offset]
    );

    res.json({ orders: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/drivers - Tous les chauffeurs
router.get('/drivers', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.prenom, u.nom, u.phone,
              u.date_naissance, u.adresse, u.is_active,
              dp.truck_type, dp.truck_plate, dp.is_available,
              dp.total_trips, dp.rating, dp.rating_count,
              dp.date_naissance AS driver_date_naissance,
              dp.adresse AS driver_adresse,
              CASE WHEN dp.momo_number IS NULL THEN NULL ELSE '****' || RIGHT(dp.momo_number, 4) END AS momo_number,
              dp.momo_provider
       FROM users u
       JOIN driver_profiles dp ON dp.user_id = u.id
       ORDER BY dp.total_trips DESC`
    );
    res.json({ drivers: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/clients - Tous les clients
router.get('/clients', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, phone, full_name, prenom, nom, date_naissance, adresse,
              email, is_active, is_verified, created_at
       FROM users WHERE role = 'client'
       ORDER BY created_at DESC`
    );
    res.json({ clients: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/payouts - Reversements chauffeurs (par défaut : à effectuer)
router.get('/payouts', async (req, res, next) => {
  try {
    const status = req.query.status === 'done' ? 'released' : 'payout_pending';
    const result = await query(
      `SELECT o.id AS order_id, o.order_number, o.driver_amount, o.commission_amount, o.total_amount,
              o.validated_at, o.released_at, u.full_name AS driver_name,
              dp.momo_number, dp.momo_provider,
              t.status AS payout_status, t.provider_reference
       FROM orders o
       JOIN users u ON u.id = o.driver_id
       LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
       LEFT JOIN transactions t ON t.order_id = o.id AND t.type = 'driver_payout'
       WHERE o.payment_status = $1
       ORDER BY o.validated_at ASC LIMIT 200`,
      [status]
    );
    res.json({ payouts: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reviews - Avis plateforme + avis chauffeurs
router.get('/reviews', async (req, res, next) => {
  try {
    const [platform, drivers] = await Promise.all([
      query(`SELECT pr.id, pr.rating, pr.comment, pr.created_at, u.full_name AS client_name
             FROM platform_reviews pr JOIN users u ON u.id = pr.user_id
             ORDER BY pr.created_at DESC LIMIT 200`),
      query(`SELECT o.id AS order_id, o.order_number, o.client_rating AS rating, o.client_review AS comment,
                    o.rated_at, ud.full_name AS driver_name, uc.full_name AS client_name
             FROM orders o JOIN users ud ON ud.id = o.driver_id JOIN users uc ON uc.id = o.client_id
             WHERE o.client_rating IS NOT NULL ORDER BY o.rated_at DESC LIMIT 200`),
    ]);
    res.json({ platform_reviews: platform.rows, driver_reviews: drivers.rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/activate - Activer/désactiver un compte
router.patch('/users/:id/activate', async (req, res, next) => {
  try {
    const is_active = req.body.is_active === true;
    if (typeof req.body.is_active !== 'boolean') return res.status(400).json({ error: 'is_active (booléen) requis' });
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' });
    await query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2',
      [is_active, req.params.id]
    );
    res.json({ message: `Compte ${is_active ? 'activé' : 'désactivé'}` });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
