/**
 * Entretien quotidien de la base : suppression des codes SMS expirés depuis plus de 24 h,
 * fermeture définitive des comptes supprimés depuis 60 jours et effacement de leurs données à 6 mois.
 * Lancé avec le serveur ; désactivé en test.
 */
const { query } = require('../config/database');
const { purgeDeletedAccounts } = require('./account.service');

const DAY_MS = 24 * 60 * 60 * 1000;

const purgeExpiredOtps = async () => {
  const { rowCount } = await query(
    `DELETE FROM phone_otps WHERE created_at < NOW() - INTERVAL '1 day'`
  );
  return rowCount;
};

const startMaintenanceWorker = () => {
  if (process.env.NODE_ENV === 'test') return null;
  const run = () => {
    purgeExpiredOtps().catch((error) => console.error('Entretien base :', error.message));
    purgeDeletedAccounts().catch((error) => console.error('Comptes supprimés :', error.message));
  };
  setTimeout(run, 60 * 1000).unref();
  const timer = setInterval(run, DAY_MS);
  timer.unref();
  return timer;
};

module.exports = { purgeExpiredOtps, startMaintenanceWorker };
