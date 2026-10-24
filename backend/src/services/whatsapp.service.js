/**
 * WhatsApp Cloud API (Meta) : vérification de la signature des webhooks et envoi de messages.
 * Variables : WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN.
 * Sans WHATSAPP_TOKEN, les réponses sont seulement journalisées (aucune erreur côté webhook).
 */
const crypto = require('crypto');
const axios = require('axios');

const GRAPH_URL = 'https://graph.facebook.com/v20.0';

/** Signature X-Hub-Signature-256 = sha256=HMAC(app_secret, corps brut) */
const isValidSignature = (rawBody, header) => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !rawBody || !header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = header.slice('sha256='.length);
  return received.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
};

const sendText = async (to, body) => {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID) {
    console.log(`[WhatsApp non configuré] à ${to} : ${body}`);
    return;
  }
  await axios.post(
    `${GRAPH_URL}/${process.env.WHATSAPP_PHONE_ID}/messages`,
    { messaging_product: 'whatsapp', to, type: 'text', text: { body } },
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }, timeout: 10000 }
  );
};

module.exports = { isValidSignature, sendText };
