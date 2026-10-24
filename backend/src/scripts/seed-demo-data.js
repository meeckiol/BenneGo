const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/database');

async function seed() {
  console.log('Démarrage de l\'initialisation des données de démo BenneGo...');

  // 1. Password hashes
  const adminPass = await bcrypt.hash('AdminPassword123!', 10);
  const driverPass = await bcrypt.hash('DriverPassword123!', 10);
  const clientPass = await bcrypt.hash('ClientPassword123!', 10);

  // 2. Insert Admin
  const adminRes = await query(`
    INSERT INTO users (phone, full_name, email, role, is_active, is_verified, password_hash)
    VALUES ($1, $2, $3, 'admin', true, true, $4)
    ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = true
    RETURNING id
  `, ['+22997000001', 'Directeur BenneGo Admin', 'admin@bennego.bj', adminPass]);
  const adminId = adminRes.rows[0].id;

  // 3. Insert Driver
  const driverRes = await query(`
    INSERT INTO users (phone, full_name, email, role, is_active, is_verified, password_hash, prenom, nom, date_naissance, adresse)
    VALUES ($1, $2, $3, 'driver', true, true, $4, 'Rodrigue', 'Dossou', '1988-06-14', 'Akpakpa, Cotonou')
    ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'driver', is_active = true
    RETURNING id
  `, ['+22997000002', 'Rodrigue Dossou', 'rodrigue@chauffeur.bj', driverPass]);
  const driverId = driverRes.rows[0].id;

  // Driver profile
  await query(`
    INSERT INTO driver_profiles (
      user_id, truck_type, truck_capacity_m3, truck_plate, license_number,
      is_available, current_lat, current_lng, total_trips, rating, rating_count,
      momo_number, momo_provider, verification_status
    ) VALUES ($1, 'double_benne', 16.0, 'RB-8921-BA', 'B-BENIN-9921',
      true, 6.365360, 2.418330, 34, 4.9, 18,
      '+22997000002', 'mtn', 'verified')
    ON CONFLICT (user_id) DO UPDATE SET
      is_available = true,
      current_lat = 6.365360,
      current_lng = 2.418330,
      momo_number = '+22997000002',
      verification_status = 'verified'
  `, [driverId]);

  // 4. Insert Client
  const clientRes = await query(`
    INSERT INTO users (phone, full_name, email, role, is_active, is_verified, password_hash, prenom, nom, date_naissance, adresse)
    VALUES ($1, $2, $3, 'client', true, true, $4, 'Jean-Luc', 'Agossou', '1982-11-20', 'Haie Vive, Cotonou')
    ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'client', is_active = true
    RETURNING id
  `, ['+22997000003', 'Ing. Jean-Luc Agossou', 'jeanluc@btp-benin.bj', clientPass]);
  const clientId = clientRes.rows[0].id;

  // 5. Client Enterprise & Projects
  const compRes = await query(`
    INSERT INTO companies (name, ifu, address, phone, email, subscription_plan, subscription_status)
    VALUES ('BTP Construction Bénin SA', '0202100998811', 'Zone Industrielle, Akpakpa', '+22997000003', 'finance@btp-benin.bj', 'monthly_saas', 'active')
    ON CONFLICT (ifu) DO UPDATE SET subscription_status = 'active'
    RETURNING id
  `);

  let companyId = compRes.rows[0]?.id;
  if (companyId) {
    await query(`UPDATE users SET company_id = $1 WHERE id = $2`, [companyId, clientId]);
    await query(`
      INSERT INTO projects_chantiers (company_id, name, address, central_lat, central_lng, status)
      VALUES 
        ($1, 'Chantier Route des Pêches (Fidjrossè)', 'Fidjrossè Plage, Cotonou', 6.3562, 2.3789, 'active'),
        ($1, 'Aménagement Résidence Prestige Ouidah', 'Route des Esclaves, Ouidah', 6.3630, 2.0850, 'active')
      ON CONFLICT DO NOTHING
    `, [companyId]);
  }

  // 6. Promo Codes
  await query(`
    INSERT INTO promo_codes (code, discount_type, discount_value, min_order_amount, is_active)
    VALUES 
      ('BENNEGO2026', 'fixed', 5000, 30000, true),
      ('CHANTIER10', 'percentage', 10, 50000, true)
    ON CONFLICT (code) DO UPDATE SET is_active = true
  `);

  // 8. Sample Orders for Demonstration
  // Order 1: Validated (in Escrow, ready to release funds!)
  await query(`
    INSERT INTO orders (
      order_number, client_id, driver_id, order_type, pickup_address, delivery_address,
      pickup_lat, pickup_lng, delivery_lat, delivery_lng, distance_km, quantity_m3,
      total_amount, driver_amount, commission_amount,
      status, payment_status, payment_method, payment_reference,
      pod_notes, pod_photos, pod_submitted_at
    ) VALUES (
      'BG-2026-8801', $1, $2, 'MATERIAL', 'Carrière Dan, Tori-Bossito', 'Chantier Fidjrossè Plage, Cotonou',
      6.4950, 2.1480, 6.3562, 2.3789, 28.5, 16.0,
      65000, 58500, 6500,
      'validated', 'escrow_held', 'mtn_momo', 'KKIA-TX-889021',
      '16m³ de gravier 15/25 déchargé proprement près de la bétonnière.',
      '["https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=600"]'::jsonb,
      NOW() - INTERVAL '1 hour'
    ) ON CONFLICT (order_number) DO NOTHING
  `, [clientId, driverId]);

  // Order 2: Active delivery in progress (Rental)
  await query(`
    INSERT INTO orders (
      order_number, client_id, driver_id, order_type, pickup_address, delivery_address,
      pickup_lat, pickup_lng, delivery_lat, delivery_lng, distance_km, quantity_m3,
      total_amount, driver_amount, commission_amount,
      status, payment_status, payment_method, payment_reference,
      material_description, duration_hours
    ) VALUES (
      'BG-2026-8802', $1, $2, 'RENTAL', 'Parc Engins Akpakpa', 'Chantier Fidjrossè Plage',
      6.3653, 2.4183, 6.3562, 2.3789, 12.0, 1.0,
      120000, 108000, 12000,
      'driver_en_route_delivery', 'escrow_held', 'moov_money', 'KKIA-TX-889022',
      'Pelle mécanique CAT 320', 8
    ) ON CONFLICT (order_number) DO NOTHING
  `, [clientId, driverId]);

  // Order 3: Completed
  await query(`
    INSERT INTO orders (
      order_number, client_id, driver_id, order_type, pickup_address, delivery_address,
      pickup_lat, pickup_lng, delivery_lat, delivery_lng, distance_km, quantity_m3,
      total_amount, driver_amount, commission_amount,
      status, payment_status, payment_method, payment_reference,
      delivered_at
    ) VALUES (
      'BG-2026-8803', $1, $2, 'EVACUATION', 'Chantier Haie Vive', 'Décharge publique autorisée d Ouidah',
      6.3610, 2.3950, 6.3630, 2.0850, 36.0, 12.0,
      45000, 40500, 4500,
      'completed', 'released', 'mtn_momo', 'KKIA-TX-889020',
      NOW() - INTERVAL '2 days'
    ) ON CONFLICT (order_number) DO NOTHING
  `, [clientId, driverId]);

  console.log('[OK] Base de données initialisée avec succès !');
  console.log('--------------------------------------------------');
  console.log('Comptes prêts pour test localhost :');
  console.log('  1. ADMIN :');
  console.log('     Téléphone : +22997000001');
  console.log('     Mot de passe : AdminPassword123!');
  console.log('     URL : http://localhost:5175');
  console.log('');
  console.log('  2. CHAUFFEUR (DRIVER) :');
  console.log('     Téléphone : +22997000002');
  console.log('     Mot de passe : DriverPassword123!');
  console.log('     URL : http://localhost:5174');
  console.log('');
  console.log('  3. CLIENT (BTP & PARTICULIER) :');
  console.log('     Téléphone : +22997000003');
  console.log('     Mot de passe : ClientPassword123!');
  console.log('     URL : http://localhost:5173');
  console.log('--------------------------------------------------');

  await pool.end();
}

seed().catch(err => {
  console.error('Erreur lors du seed :', err);
  process.exit(1);
});
