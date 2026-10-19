const express = require('express');
const { body, param } = require('express-validator');
const { reviewDriver, reviewPlatform, getDriverReviews } = require('../controllers/review.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();
router.use(authenticate);

// Noter le chauffeur (1 à 5 étoiles) + avis
router.post('/orders/:orderId/driver', requireRole('client'), [
  param('orderId').isUUID(),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('La note doit être comprise entre 1 et 5'),
  body('comment').optional({ nullable: true }).isString().isLength({ max: 1000 }),
], validateRequest, reviewDriver);

// Donner son avis sur la plateforme
router.post('/platform', requireRole('client'), [
  body('comment').isString().trim().isLength({ min: 3, max: 1000 }).withMessage('Avis requis (3 à 1000 caractères)'),
  body('rating').optional({ nullable: true }).isInt({ min: 1, max: 5 }),
  body('order_id').optional({ nullable: true }).isUUID(),
], validateRequest, reviewPlatform);

// Avis reçus par un chauffeur
router.get('/drivers/:driverId', [param('driverId').isUUID()], validateRequest, getDriverReviews);

module.exports = router;
