const express = require('express');
const { body } = require('express-validator');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { query } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');
const { recordPosition, broadcastPosition, ACTIVE_STATUSES } = require('../services/tracking.service');

const router = express.Router();
router.use(authenticate);

// GET /api/drivers/available - Chauffeurs disponibles (admin uniquement : exposent des positions)
router.get('/available', requireRole('admin'), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.phone,
              dp.truck_type, dp.truck_plate, dp.truck_capacity_m3,
              dp.current_lat, dp.current_lng, dp.rating, dp.rating_count, dp.total_trips
       FROM users u
       JOIN driver_profiles dp ON dp.user_id = u.id
       WHERE dp.is_available = true AND u.is_active = true
       ORDER BY dp.rating DESC NULLS LAST`
    );
    res.json({ drivers: result.rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/drivers/availability - Chauffeur se met disponible / indisponible (utilisé par l'appli mobile)
router.patch('/availability', requireRole('driver'), [
  body('is_available').isBoolean().toBoolean(),
], validateRequest, async (req, res, next) => {
  try {
    const wanted = req.body.is_available;
    if (wanted) {
      const profile = await query(
        'SELECT momo_number, momo_provider FROM driver_profiles WHERE user_id = $1', [req.user.id]
      );
      if (!profile.rows.length) throw new AppError('Complétez votre profil chauffeur', 400);
      if (!profile.rows[0].momo_number) throw new AppError('Renseignez votre numéro Mobile Money', 400);
      const active = await query(
        `SELECT 1 FROM orders WHERE driver_id = $1 AND status = ANY($2) LIMIT 1`,
        [req.user.id, [...ACTIVE_STATUSES, 'delivered']]
      );
      if (active.rows.length) throw new AppError('Terminez votre course en cours avant de vous remettre disponible', 409);
    }
    await query('UPDATE driver_profiles SET is_available = $1, updated_at = NOW() WHERE user_id = $2', [wanted, req.user.id]);
    res.json({ is_available: wanted });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/drivers/location - Position GPS (HTTP, pour l'appli mobile). order_id facultatif.
router.patch('/location', requireRole('driver'), [
  body('order_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
], validateRequest, async (req, res, next) => {
  try {
    const recorded = await recordPosition(req.user.id, req.body);
    if (recorded) broadcastPosition(req.app.get('io'), recorded);
    res.json({ message: 'Position mise à jour' });
  } catch (error) {
    next(error);
  }
});

// GET /api/drivers/me/summary - Profil camion + gains + statistiques du chauffeur
// Remplace le double appel /auth/me + /drivers/me/summary côté mobile : une seule requête.
router.get('/me/summary', requireRole('driver'), async (req, res, next) => {
  try {
    const [profile, earnings] = await Promise.all([
      query(
        `SELECT dp.is_available, dp.rating, dp.rating_count, dp.total_trips,
                dp.truck_plate, dp.truck_type, dp.truck_capacity_m3,
                dp.momo_number, dp.momo_provider
         FROM driver_profiles dp
         WHERE dp.user_id = $1`,
        [req.user.id]
      ),
      query(
        `SELECT
           COALESCE(SUM(driver_amount) FILTER (WHERE payment_status = 'released'), 0) AS paid,
           COALESCE(SUM(driver_amount) FILTER (WHERE payment_status = 'payout_pending'), 0) AS pending_payout,
           COALESCE(SUM(driver_amount) FILTER (WHERE payment_status = 'escrow_held'), 0) AS awaiting_confirmation,
           COALESCE(SUM(driver_amount) FILTER (WHERE status IN ('validated', 'completed')
             AND COALESCE(validated_at, created_at) >= date_trunc('month', NOW())), 0) AS this_month,
           COUNT(*) FILTER (WHERE status IN ('validated', 'completed')
             AND COALESCE(validated_at, created_at) >= date_trunc('month', NOW()))::int AS trips_this_month
         FROM orders WHERE driver_id = $1`,
        [req.user.id]
      ),
    ]);
    const p = profile.rows[0] || {};
    const e = earnings.rows[0];
    res.json({
      // Statistiques / disponibilité
      is_available: !!p.is_available,
      rating: p.rating === null || p.rating === undefined ? null : Number(p.rating),
      rating_count: p.rating_count || 0,
      total_trips: p.total_trips || 0,
      earnings: {
        paid: Number(e.paid),
        pending_payout: Number(e.pending_payout),
        awaiting_confirmation: Number(e.awaiting_confirmation),
        this_month: Number(e.this_month),
      },
      trips_this_month: e.trips_this_month || 0,
      // Profil camion (évite un second appel à /auth/me côté mobile)
      truck_plate: p.truck_plate || null,
      truck_type: p.truck_type || null,
      truck_capacity_m3: p.truck_capacity_m3 ? Number(p.truck_capacity_m3) : null,
      momo_provider: p.momo_provider || null,
      has_momo: !!p.momo_number,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
