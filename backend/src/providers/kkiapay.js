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

const LOCAL_TRANSACTION_PREFIXES = ['TEST_', 'DEV_', 'KKIA-DEV-'];

/**
 * Contournement de vérification réservé aux tests et au développement local.
 * Jamais en staging ni en production : une configuration oubliée ne doit pas
 * valider un paiement sans l'avoir vérifié auprès de KKiaPay.
 */
const isLocalBypass = (transactionId) => {
  // NODE_ENV=test seul ne suffit pas : il faut être réellement dans la suite Jest (serveur mal configuré = pas de faux paiement)
  const allowed = (process.env.NODE_ENV === 'test' && Boolean(process.env.JEST_WORKER_ID))
    || (process.env.NODE_ENV === 'development' && process.env.KKIAPAY_DEV_BYPASS === 'true');
  return allowed && LOCAL_TRANSACTION_PREFIXES.some((prefix) => transactionId.startsWith(prefix));
};

/** @returns {Promise<{status: string, amount: number}>} */
const verify = async (transactionId, orderId) => {
  if (isLocalBypass(transactionId)) {
    if (orderId) {
      const { query } = require('../config/database');
      const res = await query('SELECT total_amount, discount_amount FROM orders WHERE id = $1', [orderId]);
      if (res.rows.length) {
        const { total_amount: total, discount_amount: discount } = res.rows[0];
        return { status: 'SUCCESS', amount: Math.max(0, Number(total) - Number(discount || 0)) };
      }
    }
    return { status: 'SUCCESS', amount: 0 };
  }
  return getClient().verify(transactionId);
};

const refund = async (transactionId) => {
  if (isLocalBypass(transactionId)) {
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
