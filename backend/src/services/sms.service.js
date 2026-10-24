/**
 * Envoi de SMS (codes de vérification).
 *
 * SMS_WEBHOOK_URL : votre passerelle SMS (agrégateur béninois ou autre), appelée en POST
 *   avec { to, message } et l'en-tête Authorization: Bearer SMS_WEBHOOK_TOKEN.
 * En production sans passerelle, l'envoi échoue explicitement : on ne valide jamais un
 * numéro sur un code qui n'a pas pu être livré.
 * Hors production sans passerelle, le message est écrit dans la console (et gardé en mémoire
 * pour les tests).
 */
const axios = require('axios');
const { AppError } = require('../middlewares/error.middleware');

const lastMessages = new Map();

const send = async (phone, message) => {
  if (process.env.SMS_WEBHOOK_URL) {
    try {
      await axios.post(
        process.env.SMS_WEBHOOK_URL,
        { to: phone, message },
        { headers: { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN || ''}` }, timeout: 10000 }
      );
    } catch (error) {
      console.error('Passerelle SMS:', error.message);
      throw new AppError('Impossible d\'envoyer le code par SMS, réessayez dans un instant', 502);
    }
    return;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('Envoi de SMS non configuré', 503);
  }
  lastMessages.set(phone, message);
  if (process.env.NODE_ENV !== 'test') console.log(`[SMS dev] ${phone} : ${message}`);
};

/** Dernier message « envoyé » à ce numéro (hors production uniquement). */
const lastMessageFor = (phone) => lastMessages.get(phone);

module.exports = { send, lastMessageFor };
