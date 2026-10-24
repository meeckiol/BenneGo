/**
 * Canal WhatsApp (Meta Cloud API) : un artisan écrit sa commande, BenneGo répond
 * et renvoie vers l'application pour confirmer et payer en séquestre.
 */
const crypto = require('crypto');
const express = require('express');
const { query } = require('../config/database');
const whatsapp = require('../services/whatsapp.service');
const { parseTextOrder } = require('../services/whatsapp-nlp.service');

const router = express.Router();
const appUrl = () => (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');

const sameSecret = (received, expected) => {
  const a = Buffer.from(String(received || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};

// GET /api/whatsapp/webhook — vérification de l'abonnement par Meta
router.get('/webhook', (req, res) => {
  const valid = req.query['hub.mode'] === 'subscribe'
    && sameSecret(req.query['hub.verify_token'], process.env.WHATSAPP_VERIFY_TOKEN);
  if (!valid) return res.sendStatus(403);
  return res.status(200).send(req.query['hub.challenge']);
});

const handleMessage = async (message) => {
  const to = message.from;
  const { rows } = await query(
    'SELECT id FROM users WHERE phone = $1 OR phone = $2 LIMIT 1',
    [`+${to}`, to]
  );
  if (!rows.length) {
    return whatsapp.sendText(to, `Bienvenue sur BenneGo. Créez votre compte pour commander : ${appUrl()}/register`);
  }
  if (message.type !== 'text') {
    return whatsapp.sendText(to, `Envoyez votre commande par écrit, par exemple « 16 m3 de sable lavé ». Ou commandez ici : ${appUrl()}/orders/new`);
  }

  const { quantity_m3: quantity, material } = parseTextOrder(message.text?.body);
  if (!quantity) {
    return whatsapp.sendText(to, `Quelle quantité voulez-vous ? Exemple : « 10 m3 de gravier ». Ou commandez ici : ${appUrl()}/orders/new`);
  }
  if (!material) {
    return whatsapp.sendText(to, `Quel matériau ? Sable (lavé ou de rivière), gravier ou latérite. Exemple : « ${quantity} m3 de sable lavé ».`);
  }
  return whatsapp.sendText(
    to,
    `Commande notée : ${quantity} m³ de ${material}. Le prix exact dépend de la distance : confirmez et payez en sécurité sur ${appUrl()}/orders/new`
  );
};

// POST /api/whatsapp/webhook — messages entrants (signature vérifiée sur le corps brut)
router.post('/webhook', (req, res) => {
  if (!whatsapp.isValidSignature(req.rawBody, req.get('x-hub-signature-256'))) return res.sendStatus(401);
  res.sendStatus(200); // Meta attend une réponse rapide ; le traitement suit
  const messages = (req.body.entry || [])
    .flatMap((entry) => entry.changes || [])
    .flatMap((change) => change.value?.messages || []);
  Promise.all(messages.map((message) => handleMessage(message)))
    .catch((error) => console.error('WhatsApp:', error.message));
  return undefined;
});

module.exports = router;
