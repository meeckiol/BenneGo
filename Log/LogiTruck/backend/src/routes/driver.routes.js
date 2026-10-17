const express = require('express');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { query } = require('../config/database');

const router = express.Router();
router.use(authenticate);

// GET /api/drivers/available - Chauffeurs disponibles (pour admin/client)
router.get('/available', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.phone,
              dp.truck_type, dp.truck_plate, dp.truck_capacity_m3,
              dp.current_lat, dp.current_lng, dp.rating, dp.total_trips
       FROM users u
       JOIN driver_profiles dp ON dp.user_id = u.id
       WHERE dp.is_available = true AND u.is_active = true
       ORDER BY dp.rating DESC`
    );
    res.json({ drivers: result.rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/drivers/location - Chauffeur met à jour sa position
router.patch('/location', requireRole('driver'), async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    await query(
      `UPDATE driver_profiles SET
        current_lat = $1, current_lng = $2,
        last_position_at = NOW(), updated_at = NOW()
       WHERE user_id = $3`,
      [lat, lng, req.user.id]
    );
    res.json({ message: 'Position mise à jour' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
