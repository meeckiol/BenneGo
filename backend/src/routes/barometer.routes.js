/** Prix du marché : dernier indice au voyage de chaque matériau et taille de camion (public). */
const express = require('express');
const market = require('../services/market.service');

const router = express.Router();

// GET /api/barometer — derniers prix du marché
router.get('/', async (req, res, next) => {
  try {
    res.json({ items: await market.latest() });
  } catch (error) {
    next(error);
  }
});

// GET /api/barometer/catalog — matériaux (noms d'ici) et tailles de camion, pour les menus déroulants
router.get('/catalog', (req, res) => res.json(market.catalog()));

module.exports = router;
