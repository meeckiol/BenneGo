/**
 * Crée (ou promeut) le compte administrateur — aucun mot de passe par défaut n'existe.
 * Usage : ADMIN_PHONE=+22900000000 ADMIN_NAME="Admin" ADMIN_PASSWORD='...' npm run create-admin
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/database');

(async () => {
  const { ADMIN_PHONE, ADMIN_NAME = 'Administrateur BenneGo', ADMIN_PASSWORD, ADMIN_EMAIL } = process.env;
  if (!ADMIN_PHONE || !ADMIN_PASSWORD) throw new Error('ADMIN_PHONE et ADMIN_PASSWORD sont requis');
  if (ADMIN_PASSWORD.length < 12) throw new Error('Mot de passe admin : 12 caractères minimum');
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await query(
    `INSERT INTO users (phone, full_name, email, role, is_verified, password_hash)
     VALUES ($1, $2, $3, 'admin', true, $4)
     ON CONFLICT (phone) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash, is_active = true`,
    [ADMIN_PHONE, ADMIN_NAME, ADMIN_EMAIL || null, hash]
  );
  console.log(`Compte admin prêt : ${ADMIN_PHONE}`);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
