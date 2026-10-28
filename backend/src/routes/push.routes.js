const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const push = require('../services/push.service');

const router = express.Router();

// GET /api/push/public-key : clé publique VAPID pour abonner le navigateur
router.get('/public-key', (req, res) => {
  const key = push.publicKey();
  if (!key) return res.status(503).json({ error: 'Notifications push non configurées' });
  res.json({ public_key: key });
});

// POST /api/push/subscribe : enregistre l'abonnement de cet appareil
router.post('/subscribe', authenticate, [
  body('endpoint').isURL({ protocols: ['https'], require_tld: false }).isLength({ max: 1000 }),
  body('keys.p256dh').isString().isLength({ min: 10, max: 200 }),
  body('keys.auth').isString().isLength({ min: 10, max: 100 }),
], validateRequest, async (req, res, next) => {
  try {
    await push.saveSubscription(req.user.id, req.body);
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/push/subscribe : désabonne cet appareil
router.delete('/subscribe', authenticate, [
  body('endpoint').isString().isLength({ max: 1000 }),
], validateRequest, async (req, res, next) => {
  try {
    await push.removeSubscription(req.user.id, req.body.endpoint);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
