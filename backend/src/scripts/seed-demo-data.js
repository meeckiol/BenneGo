const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/database');

async function seed() {
  // Ce script réécrit les mots de passe et les rôles de comptes aux identifiants connus : jamais en production.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refus : les données de démo ne doivent jamais être injectées en production.');
  }
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

  // 8 bis. Prix du marché au voyage : semaine dernière et semaine en cours (la tendance se calcule à la publication)
  const market = require('../services/market.service');
  const today = new Date().toISOString().slice(0, 10);
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  for (const [key, prices] of Object.entries({
    sable_lagunaire: [45000, 95000, 140000], sable_fin: [55000, 115000, 170000], sable_carriere: [50000, 105000, 155000],
    gravier_5_15: [90000, 185000, 270000], gravier_15_25: [85000, 175000, 255000], caillou: [60000, 125000, 180000],
    terre_de_barre: [30000, 60000, 90000], laterite: [35000, 70000, 100000],
  })) {
    for (const [i, truck] of ['6_roues', '10_roues', '12_roues'].entries()) {
      const avg = prices[i];
      await market.publish({ material_key: key, truck_size: truck, week_start: lastWeek, price_min: avg * 0.9, price_avg: avg * (key === 'gravier_15_25' ? 0.95 : 1), price_max: avg * 1.12 });
      await market.publish({ material_key: key, truck_size: truck, week_start: today, price_min: avg * 0.92, price_avg: avg * (key === 'sable_lagunaire' ? 1.04 : 1), price_max: avg * 1.1 });
    }
  }

  // 9. Historique de démo sur 90 jours (console Analyses) : commandes datées, tendance en hausse, creux le dimanche
  await seedHistory({ clientId, driverId, driverPass, clientPass });

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

// Générateur pseudo-aléatoire à graine fixe : le même historique à chaque lancement
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seedHistory({ clientId, driverId, driverPass, clientPass }) {
  const rand = seeded(2026);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const between = (min, max) => min + rand() * (max - min);

  const drivers = [driverId];
  const driverNames = [['Grégoire', 'Hounkpatin'], ['Sylvain', 'Kpossou'], ['Prudence', 'Adjovi'], ['Bernard', 'Zinsou']];
  for (const [i, [prenom, nom]] of driverNames.entries()) {
    const phone = `+2299710000${i + 1}`;
    const { rows: [u] } = await query(`
      INSERT INTO users (phone, full_name, role, is_active, is_verified, password_hash, prenom, nom)
      VALUES ($1, $2, 'driver', true, true, $3, $4, $5)
      ON CONFLICT (phone) DO UPDATE SET is_active = true RETURNING id
    `, [phone, `${prenom} ${nom}`, driverPass, prenom, nom]);
    await query(`
      INSERT INTO driver_profiles (user_id, truck_type, truck_capacity_m3, truck_plate, license_number, momo_number, momo_provider, verification_status)
      VALUES ($1, $2, $3, $4, $5, $6, 'mtn', 'verified') ON CONFLICT (user_id) DO NOTHING
    `, [u.id, i % 2 ? 'simple_benne' : 'double_benne', i % 2 ? 10 : 16, `RB-70${i}1-BA`, `B-BENIN-70${i}1`, phone]);
    drivers.push(u.id);
  }

  const clients = [clientId];
  const clientNames = [['Victoire', 'Gbaguidi'], ['Arnaud', 'Houngbédji'], ['Fatou', 'Bio'], ['Koffi', 'Mensah'], ['Estelle', 'Ahouansou'], ['Romuald', 'Tchibozo']];
  for (const [i, [prenom, nom]] of clientNames.entries()) {
    const { rows: [u] } = await query(`
      INSERT INTO users (phone, full_name, role, is_active, is_verified, password_hash, prenom, nom, created_at)
      VALUES ($1, $2, 'client', true, true, $3, $4, $5, NOW() - ($6 || ' days')::interval)
      ON CONFLICT (phone) DO UPDATE SET is_active = true RETURNING id
    `, [`+2299720000${i + 1}`, `${prenom} ${nom}`, clientPass, prenom, nom, String(5 + i * 14)]);
    clients.push(u.id);
  }

  const materials = [];
  for (const [name, local, unit, price] of [
    ['Sable de rivière fin', 'Sable', 'm3', 8000], ['Gravier concassé 15/25', 'Gravier', 'm3', 11000],
    ['Latérite', 'Terre rouge', 'm3', 5000], ['Ciment en sacs (50kg)', 'Ciment', 'sac', 4500],
  ]) {
    const { rows: [m] } = await query(`
      INSERT INTO material_types (name, name_local, unit, base_price_per_unit) VALUES ($1, $2, $3, $4)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id
    `, [name, local, unit, price]);
    materials.push(m.id);
  }

  const quarries = ['Carrière Dan, Tori-Bossito', 'Carrière de Ouèdo, Abomey-Calavi', 'Sablière de Djègbadji, Ouidah'];
  const sites = [
    'Chantier Fidjrossè, Cotonou', 'Résidence Akpakpa, Cotonou', 'Lotissement Togba, Abomey-Calavi',
    'Immeuble Ouando, Porto-Novo', 'Villa Pahou, Ouidah', 'Entrepôt Ekpè, Sèmè-Kpodji', 'Chantier Godomey, Abomey-Calavi',
  ];

  // Les commandes générées sont recréées à chaque lancement pour rester datées par rapport à aujourd'hui
  await query(`DELETE FROM orders WHERE order_number LIKE 'BG-H-%'`);
  let n = 0;
  let inserted = 0;
  const DAY = 86400000;
  const now = Date.now();
  for (let ago = 89; ago >= 0; ago--) {
    const day = new Date(now - ago * DAY);
    const growth = 1 + (89 - ago) / 45; // l'activité double environ sur la période
    const weekday = day.getUTCDay() === 0 ? 0.3 : day.getUTCDay() === 6 ? 0.7 : 1;
    const count = Math.round(between(0.4, 1.6) * growth * weekday);
    for (let k = 0; k < count; k++) {
      n += 1;
      const hour = rand() < 0.6 ? Math.floor(between(6, 11)) : Math.floor(between(12, 18));
      const created = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour - 1, Math.floor(between(0, 59))));
      if (created.getTime() > now) continue;
      const type = rand() < 0.7 ? 'MATERIAL' : rand() < 0.5 ? 'RENTAL' : 'EVACUATION';
      const total = Math.round((type === 'RENTAL' ? between(90000, 260000) : type === 'EVACUATION' ? between(30000, 95000) : between(35000, 190000)) / 500) * 500;
      const commission = Math.round(total * 0.1);
      const ageHours = (now - created.getTime()) / 3600000;
      // Anciennes commandes : terminées (ou annulées) ; récentes : à toutes les étapes
      let status;
      if (rand() < 0.08) status = 'cancelled';
      else if (ageHours > 72) status = rand() < 0.94 ? 'completed' : 'validated';
      else status = pick(['pending', 'accepted', 'driver_en_route_delivery', 'delivered', 'validated', 'completed']);
      const paid = status !== 'cancelled' || rand() < 0.4;
      const payment = status === 'cancelled' ? (paid ? 'refunded' : 'unpaid')
        : status === 'completed' ? 'released' : status === 'validated' ? 'payout_pending' : 'escrow_held';
      const at = (h) => new Date(created.getTime() + h * 3600000);
      const accepted = !['pending', 'cancelled'].includes(status) ? at(between(0.15, 0.8)) : null;
      const delivered = ['delivered', 'validated', 'completed'].includes(status) ? at(between(2, 7)) : null;
      const validated = ['validated', 'completed'].includes(status) ? at(between(7.5, 12)) : null;
      await query(`
        INSERT INTO orders (
          order_number, client_id, driver_id, order_type, material_type_id, pickup_address, delivery_address,
          pickup_lat, pickup_lng, delivery_lat, delivery_lng, distance_km, quantity_m3,
          total_amount, driver_amount, commission_amount, status, payment_status, payment_method,
          payment_at, accepted_at, delivered_at, validated_at, cancelled_at, client_rating, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 6.45, 2.25, 6.37, 2.39, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $22)
      `, [
        `BG-H-${String(n).padStart(4, '0')}`, pick(clients), status === 'pending' || !paid ? null : pick(drivers), type,
        type === 'MATERIAL' ? pick(materials) : null, pick(quarries), pick(sites),
        Math.round(between(8, 42) * 10) / 10, type === 'RENTAL' ? 1 : pick([10, 12, 16]),
        total, total - commission, commission, status, payment, rand() < 0.6 ? 'mtn_momo' : 'moov_money',
        paid ? at(0.05) : null, accepted, delivered, validated, status === 'cancelled' ? at(between(0.5, 3)) : null,
        status === 'completed' && rand() < 0.7 ? Math.ceil(between(3, 5)) : null, created,
      ]);
      inserted += 1;
    }
  }
  console.log(`[OK] Historique de démo : ${inserted} commandes sur 90 jours`);
}

seed().catch(err => {
  console.error('Erreur lors du seed :', err);
  process.exit(1);
});
