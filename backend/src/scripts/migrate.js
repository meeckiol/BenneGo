/** Applique docker/init.sql (idempotent) sur la base configurée : npm run migrate */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

// INIT_SQL_PATH permet de pointer vers le schéma quand le backend tourne dans un conteneur sans dossier docker/
const schemaPath = process.env.INIT_SQL_PATH || path.join(__dirname, '../../../docker/init.sql');

(async () => {
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Migration appliquée.');
  await pool.end();
})().catch((e) => { console.error('Échec de la migration :', e.message); process.exit(1); });
