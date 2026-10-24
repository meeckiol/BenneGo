/** Baromètre des prix BTP : indice public, dernière semaine publiée par matériau. */
const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// GET /api/barometer
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT ON (material_name)
              material_name, trend, week_number, year,
              avg_price_m3::float AS avg_price_m3, min_price_m3::float AS min_price_m3, max_price_m3::float AS max_price_m3
       FROM btp_price_barometer
       ORDER BY material_name, year DESC, week_number DESC`
    );
    res.json({ items: rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
