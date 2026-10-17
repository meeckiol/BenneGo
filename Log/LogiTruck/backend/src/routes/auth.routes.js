const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, createDriverProfile } = require('../controllers/auth.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

// POST /api/auth/register
router.post('/register', [
  body('phone').trim().notEmpty().withMessage('Numéro de téléphone requis')
    .matches(/^\+?[0-9]{8,15}$/).withMessage('Numéro invalide'),
  body('full_name').trim().notEmpty().withMessage('Nom complet requis')
    .isLength({ min: 3, max: 100 }),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe: 8 caractères minimum'),
  body('role').optional().isIn(['client', 'driver']).withMessage('Rôle invalide'),
], validateRequest, register);

// POST /api/auth/login
router.post('/login', [
  body('phone').trim().notEmpty().withMessage('Numéro de téléphone requis'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
], validateRequest, login);

// GET /api/auth/me
router.get('/me', authenticate, getMe);

// POST /api/auth/driver/profile
router.post('/driver/profile', authenticate, requireRole('driver'), [
  body('truck_type').isIn(['simple_benne', 'double_benne', 'plateau']).withMessage('Type de camion invalide'),
  body('truck_plate').trim().notEmpty().withMessage('Plaque d\'immatriculation requise'),
  body('license_number').trim().notEmpty().withMessage('Numéro de permis requis'),
  body('momo_number').trim().notEmpty().withMessage('Numéro Mobile Money requis'),
  body('momo_provider').isIn(['mtn', 'moov']).withMessage('Opérateur invalide (mtn ou moov)'),
], validateRequest, createDriverProfile);

module.exports = router;
