const express = require('express');
const account = require('../services/account.service');
const { body } = require('express-validator');
const { register, login, getMe, createDriverProfile, updateProfilePhoto, updateMe } = require('../controllers/auth.controller');
const { uploadPhotos } = require('../services/photo.service');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

// POST /api/auth/register
router.post('/register', [
  body('phone').trim().notEmpty().withMessage('Numéro de téléphone requis')
    .matches(/^\+?[0-9]{8,15}$/).withMessage('Numéro invalide'),
  body('prenom').trim().notEmpty().withMessage('Prénom requis')
    .isLength({ min: 2, max: 80 }).withMessage('Prénom: 2 à 80 caractères'),
  body('nom').trim().notEmpty().withMessage('Nom requis')
    .isLength({ min: 2, max: 80 }).withMessage('Nom: 2 à 80 caractères'),
  body('date_naissance').notEmpty().withMessage('Date de naissance requise')
    .isISO8601().withMessage('Format date invalide (YYYY-MM-DD)'),
  body('adresse').trim().notEmpty().withMessage('Adresse requise')
    .isLength({ min: 3, max: 300 }).withMessage('Adresse: 3 à 300 caractères'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe: 8 caractères minimum'),
  body('role').optional().isIn(['client', 'driver']).withMessage('Rôle invalide'),
  body('referral_code').optional({ nullable: true, checkFalsy: true }).isString().trim()
    .isLength({ max: 30 }).withMessage('Code parrain invalide'),
], validateRequest, register);

// POST /api/auth/login
router.post('/login', [
  body('phone').trim().notEmpty().withMessage('Numéro de téléphone requis'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
], validateRequest, login);

// GET /api/auth/me
router.get('/me', authenticate, getMe);

// POST /api/auth/restore { phone, password } — reprendre un compte supprimé il y a moins de 60 jours
router.post('/restore', [
  body('phone').trim().notEmpty().withMessage('Numéro requis'),
  body('password').isString().notEmpty().withMessage('Mot de passe requis'),
], validateRequest, async (req, res, next) => {
  try {
    const result = await account.restoreAccount(req, req.body.phone, req.body.password);
    res.json({ ...result, message: 'Bon retour ! Votre compte est rétabli.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/me/photo : photo de profil (champ « photo », image unique)
router.post('/me/photo', authenticate, uploadPhotos.single('photo'), updateProfilePhoto);

// PATCH /api/auth/me - Informations personnelles (prénom, nom, adresse, email, date de naissance)
router.patch('/me', authenticate, [
  body('prenom').optional().isString().trim().notEmpty().withMessage('Prénom requis').isLength({ max: 80 }),
  body('nom').optional().isString().trim().notEmpty().withMessage('Nom requis').isLength({ max: 80 }),
  body('adresse').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email invalide'),
  body('date_naissance').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Date de naissance invalide'),
], validateRequest, updateMe);

// POST /api/auth/driver/profile
router.post('/driver/profile', authenticate, requireRole('driver'), [
  body('truck_type').isIn(['simple_benne', 'double_benne', 'plateau', 'pickup']).withMessage('Type de camion invalide'),
  body('truck_plate').trim().notEmpty().withMessage('Plaque d\'immatriculation requise'),
  body('license_number').trim().notEmpty().withMessage('Numéro de permis requis'),
  body('momo_number').trim().notEmpty().withMessage('Numéro Mobile Money requis'),
  body('momo_provider').isIn(['mtn', 'moov']).withMessage('Opérateur invalide (mtn ou moov)'),
  body('date_naissance').optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Format date invalide (YYYY-MM-DD)'),
  body('adresse').optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 300 }).withMessage('Adresse trop longue'),
], validateRequest, createDriverProfile);

module.exports = router;
