/** Réglages du compte : préférences, appareils connectés, mot de passe, numéro, suppression. */
const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { AppError } = require('../middlewares/error.middleware');
const settings = require('../services/settings.service');
const sessions = require('../services/session.service');
const account = require('../services/account.service');

const router = express.Router();
const phone = body('phone').trim().matches(/^\+?[0-9]{8,15}$/).withMessage('Numéro invalide');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.use(authenticate);

// GET /api/account/settings — réglages fusionnés avec les valeurs par défaut du rôle
router.get('/settings', wrap(async (req, res) => {
  res.json({
    settings: await settings.getSettings(req.user.id),
    categories: settings.CATEGORIES[req.user.role] || [],
    privacy_keys: settings.PRIVACY[req.user.role] || [],
  });
}));

// PATCH /api/account/settings { notifications?, privacy? } — modification partielle (barre « Valider »)
router.patch('/settings', wrap(async (req, res) => {
  res.json({ settings: await settings.updateSettings(req.user.id, req.user.role, req.body), message: 'Réglages enregistrés' });
}));

// GET /api/account/sessions — appareils connectés
router.get('/sessions', wrap(async (req, res) => {
  res.json({ sessions: await sessions.listSessions(req.user.id, req.user.sessionId) });
}));

// DELETE /api/account/sessions/:id — déconnecter un appareil
router.delete('/sessions/:id', [param('id').isUUID()], validateRequest, wrap(async (req, res) => {
  if (req.params.id === req.user.sessionId) throw new AppError('Pour cet appareil, utilisez « Se déconnecter »', 400);
  if (!(await sessions.revokeSession(req.user.id, req.params.id))) throw new AppError('Appareil introuvable', 404);
  req.app.get('io')?.in(`session_${req.params.id}`).disconnectSockets(true);
  res.json({ message: 'Appareil déconnecté' });
}));

// POST /api/account/sessions/revoke-others — déconnecter tous les autres appareils
router.post('/sessions/revoke-others', wrap(async (req, res) => {
  const count = await sessions.revokeOthers(req.user.id, req.user.sessionId);
  res.json({ message: count ? `${count} appareil(s) déconnecté(s)` : 'Aucun autre appareil connecté', count });
}));

// POST /api/account/logout — ferme la session de cet appareil
router.post('/logout', wrap(async (req, res) => {
  if (req.user.sessionId) await sessions.revokeSession(req.user.id, req.user.sessionId);
  res.json({ message: 'Déconnecté' });
}));

// POST /api/account/password { current_password, new_password }
router.post('/password', [
  body('current_password').isString().notEmpty().withMessage('Mot de passe actuel requis'),
  body('new_password').isString().isLength({ min: 8 }).withMessage('8 caractères minimum'),
], validateRequest, wrap(async (req, res) => {
  const count = await account.changePassword(req.user, req.body.current_password, req.body.new_password);
  res.json({ message: `Mot de passe modifié${count ? ` · ${count} autre(s) appareil(s) déconnecté(s)` : ''}` });
}));

// POST /api/account/phone/request { phone } — code SMS envoyé au nouveau numéro
router.post('/phone/request', [phone], validateRequest, wrap(async (req, res) => {
  const result = await account.requestPhoneChange(req.user, req.body.phone);
  res.json({ message: 'Code envoyé par SMS au nouveau numéro', ...result });
}));

// POST /api/account/phone/confirm { phone, code, password }
router.post('/phone/confirm', [
  phone,
  body('code').matches(/^[0-9]{6}$/).withMessage('Code à 6 chiffres requis'),
  body('password').isString().notEmpty().withMessage('Mot de passe requis'),
], validateRequest, wrap(async (req, res) => {
  const newPhone = await account.confirmPhoneChange(req.user, req.body);
  res.json({ message: 'Numéro de téléphone modifié', phone: newPhone });
}));

// GET /api/account/deletion — peut-on supprimer le compte maintenant ?
router.get('/deletion', wrap(async (req, res) => {
  res.json(await account.deletionCheck(req.user));
}));

// POST /api/account/deletion { password, reason? } — suppression différée (récupérable 60 jours)
router.post('/deletion', [
  body('password').isString().notEmpty().withMessage('Mot de passe requis'),
  body('reason').optional({ nullable: true }).isString().isLength({ max: 300 }),
], validateRequest, wrap(async (req, res) => {
  const result = await account.requestDeletion(req.user, req.body, req.app.get('io'));
  res.json({
    ...result,
    message: `Compte supprimé. Vous pouvez le reprendre jusqu'au ${result.restore_until.toLocaleDateString('fr-FR')} en vous reconnectant.`,
  });
}));

module.exports = router;
