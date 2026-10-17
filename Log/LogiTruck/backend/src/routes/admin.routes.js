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
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        COUNT(*) AS total
       FROM orders`),
      query(`SELECT
        COALESCE(SUM(commission_amount) FILTER (WHERE payment_status = 'released'), 0) AS total_revenue,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status IN ('escrow_held', 'released')), 0) AS total_gmv
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
    const offset = (page - 1) * limit;
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
      [...params, limit, offset]
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
      `SELECT u.id, u.full_name, u.phone, u.is_active,
              dp.truck_type, dp.truck_plate, dp.is_available,
              dp.total_trips, dp.rating, dp.momo_number, dp.momo_provider
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
      `SELECT id, phone, full_name, email, is_active, is_verified, created_at
       FROM users WHERE role = 'client'
       ORDER BY created_at DESC`
    );
    res.json({ clients: result.rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/activate - Activer/désactiver un compte
router.patch('/users/:id/activate', async (req, res, next) => {
  try {
    const { is_active } = req.body;
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
