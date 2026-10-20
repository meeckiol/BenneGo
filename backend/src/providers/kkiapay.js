/**
 * Adaptateur KKiaPay — seul fichier qui parle à l'API du prestataire.
 * Utilise le SDK officiel (@kkiapay-org/nodejs-sdk) : verify() et refund().
 *
 * NB : KKiaPay n'expose pas d'API serveur de virement vers un tiers dans son SDK.
 * Le reversement chauffeur est donc géré par payout.service.js (mode manuel par défaut).
 */
const { kkiapay } = require('@kkiapay-org/nodejs-sdk');

let client;
const getClient = () => {
  if (!client) {
    client = kkiapay({
      publickey: process.env.KKIAPAY_PUBLIC_KEY,
      privatekey: process.env.KKIAPAY_PRIVATE_KEY,
      secretkey: process.env.KKIAPAY_SECRET,
      sandbox: process.env.KKIAPAY_SANDBOX !== 'false',
    });
  }
  return client;
};

/** @returns {Promise<{status: string, amount: number}>} */
const verify = async (transactionId, orderId) => {
  if (
    process.env.NODE_ENV !== 'production' &&
    (!process.env.KKIAPAY_PRIVATE_KEY ||
      transactionId.startsWith('TEST_') ||
      transactionId.startsWith('DEV_') ||
      transactionId.startsWith('KKIA-DEV-'))
  ) {
    if (orderId) {
      const { query } = require('../config/database');
      const res = await query('SELECT total_amount FROM orders WHERE id = $1', [orderId]);
      if (res.rows.length) {
        return { status: 'SUCCESS', amount: Number(res.rows[0].total_amount) };
      }
    }
    return { status: 'SUCCESS', amount: 0 };
  }
  return getClient().verify(transactionId);
};

const refund = async (transactionId) => {
  if (
    process.env.NODE_ENV !== 'production' &&
    (!process.env.KKIAPAY_PRIVATE_KEY ||
      transactionId.startsWith('TEST_') ||
      transactionId.startsWith('DEV_') ||
      transactionId.startsWith('KKIA-'))
  ) {
    return { status: 'SUCCESS' };
  }
  return getClient().refund(transactionId);
};

/** Configuration publique pour le widget de paiement côté navigateur */
const widgetConfig = () => ({
  api_key: process.env.KKIAPAY_PUBLIC_KEY,
  sandbox: process.env.KKIAPAY_SANDBOX !== 'false',
});

module.exports = { verify, refund, widgetConfig };
