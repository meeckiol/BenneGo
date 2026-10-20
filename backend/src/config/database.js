const { Pool, types } = require('pg');

// NUMERIC/DECIMAL (montants FCFA, coordonnées, notes) → nombres JS, pas des chaînes "50000.00"
types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));

// DATABASE_URL (Render, Heroku…) prioritaire ; sinon variables DB_* séparées.
// DB_SSL=true active TLS (base distante exigeant SSL).
const ssl = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: process.env.DB_SSL_INSECURE !== 'true', ca: process.env.DB_SSL_CA || undefined }
  : undefined;
const poolOptions = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl }
  : {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl,
    };

const pool = new Pool({
  ...poolOptions,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: process.env.DATABASE_URL ? 10000 : 2000,
});

pool.on('error', (err) => {
  console.error('Erreur pool PostgreSQL:', err);
});

/**
 * Exécute une requête SQL paramétrée
 * @param {string} text - La requête SQL
 * @param {Array} params - Les paramètres
 */
const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('Requête exécutée', { text, duration, rows: res.rowCount });
  }
  return res;
};

/**
 * Obtient un client du pool (pour les transactions)
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
