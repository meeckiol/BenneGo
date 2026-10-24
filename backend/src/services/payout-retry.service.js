/**
 * Relance automatique des reversements chauffeurs en échec (PAYOUT_MODE=webhook).
 * Un virement échoué reste en statut « failed » et est repris toutes les 10 minutes
 * jusqu'à réussite. Sans passerelle de virement (mode manuel), rien n'est lancé.
 */
const { query } = require('../config/database');
const payments = require('./payment.service');

const INTERVAL_MS = 10 * 60 * 1000;

const retryFailedPayouts = async () => {
  const { rows } = await query(
    `SELECT DISTINCT order_id FROM transactions WHERE type = 'driver_payout' AND status = 'failed' LIMIT 20`
  );
  for (const row of rows) {
    await payments.settlePayout(row.order_id).catch((error) => {
      console.error(`Relance du reversement (commande ${row.order_id}) :`, error.message);
    });
  }
  return rows.length;
};

const startPayoutRetryWorker = () => {
  if (process.env.PAYOUT_MODE !== 'webhook' || process.env.NODE_ENV === 'test') return null;
  const timer = setInterval(() => {
    retryFailedPayouts().catch((error) => console.error('Relance des reversements :', error.message));
  }, INTERVAL_MS);
  timer.unref();
  return timer;
};

module.exports = { retryFailedPayouts, startPayoutRetryWorker };
