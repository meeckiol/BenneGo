/** Applique docker/init.sql (idempotent) sur la base configurée : npm run migrate */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../../docker/init.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migration appliquée.');
  await pool.end();
})().catch((e) => { console.error('Échec de la migration :', e.message); process.exit(1); });
