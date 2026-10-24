// Valeurs de test (n'écrasent pas ce qui est déjà défini dans l'environnement)
const defaults = {
  NODE_ENV: 'test',
  DB_HOST: 'localhost', DB_PORT: '5433', DB_NAME: 'bennego_test',
  DB_USER: 'bennego_user', DB_PASSWORD: process.env.DB_PASSWORD || 'bennegopass',
  JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
  KKIAPAY_WEBHOOK_SECRET: 'webhook-test-secret',
  KKIAPAY_PUBLIC_KEY: 'pk_test', KKIAPAY_PRIVATE_KEY: 'sk_test', KKIAPAY_SECRET: 'secret_test',
  PAYOUT_MODE: 'manual',
};
for (const [k, v] of Object.entries(defaults)) if (!process.env[k]) process.env[k] = v;
// Photos de test écrites hors du dépôt
if (!process.env.UPLOAD_DIR) process.env.UPLOAD_DIR = require("path").join(require("os").tmpdir(), "bennego-test-uploads");

// Les tests vident les tables : on refuse de tourner sur autre chose qu'une base de test.
if (!/test/i.test(process.env.DB_NAME)) {
  throw new Error(`Refus d'exécuter les tests sur la base "${process.env.DB_NAME}" : le nom doit contenir "test".`);
}
