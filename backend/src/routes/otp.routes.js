/** Vérification du numéro avant inscription (SMS). Limitée par IP dans server.js. */
const express = require('express');
const { body } = require('express-validator');
const { requestOtp, verifyOtp } = require('../controllers/auth.controller');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();
const phone = body('phone').trim().matches(/^\+?[0-9]{8,15}$/).withMessage('Numéro invalide');

// POST /api/auth/otp/request
router.post('/request', [phone], validateRequest, requestOtp);

// POST /api/auth/otp/verify
router.post('/verify', [
  phone,
  body('code').matches(/^[0-9]{6}$/).withMessage('Code à 6 chiffres requis'),
], validateRequest, verifyOtp);

module.exports = router;
