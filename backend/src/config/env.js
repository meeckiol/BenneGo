/**
 * Validation de la configuration au démarrage : on préfère refuser de démarrer
 * plutôt que de tourner avec un secret manquant ou faible.
 */
const REQUIRED = ['JWT_SECRET'];
// Base de données : soit DATABASE_URL (Render, etc.), soit les variables DB_* séparées.
const REQUIRED_DB = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const REQUIRED_IN_PRODUCTION = [
  'CORS_ORIGIN',
  'KKIAPAY_PUBLIC_KEY', 'KKIAPAY_PRIVATE_KEY', 'KKIAPAY_SECRET', 'KKIAPAY_WEBHOOK_SECRET',
];

const isProduction = () => process.env.NODE_ENV === 'production';

const validateEnv = () => {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (!process.env.DATABASE_URL) {
    missing.push(...REQUIRED_DB.filter((k) => !process.env[k]));
  }
  if (isProduction()) {
    missing.push(...REQUIRED_IN_PRODUCTION.filter((k) => !process.env[k]));
  }
  if (missing.length) {
    throw new Error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET doit contenir au moins 32 caractères');
  }
};

/** Origines autorisées (CORS HTTP + Socket.IO). Jamais de "*" en production. */
const allowedOrigins = () => {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return isProduction() ? [] : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
};

module.exports = { validateEnv, allowedOrigins, isProduction };
