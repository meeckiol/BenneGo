/**
 * BenneGo - Test Complet End-to-End de toutes les fonctionnalités en Localhost
 * Exécute l'intégralité du cycle de vie opérationnel :
 * Client -> Devis -> Commande -> Séquestre -> Chauffeur -> Trajet GPS -> PoD -> Validation -> Reversement -> Admin
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Accept': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function checkFrontend(port, label) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      resolve({ port, label, status: res.statusCode, ok: res.statusCode === 200 });
    });
    req.on('error', (e) => {
      resolve({ port, label, status: 'DOWN', error: e.message, ok: false });
    });
  });
}

async function runTests() {
  console.log('🚀 ========================================================');
  console.log('    TEST COMPLET DES FONCTIONNALITÉS BENNEGO (LOCALHOST)   ');
  console.log('========================================================\n');

  let passedSteps = 0;
  let totalSteps = 0;

  function assertStep(label, condition, details = '') {
    totalSteps++;
    if (condition) {
      passedSteps++;
      console.log(`  [OK] ${label} ${details ? '(' + details + ')' : ''}`);
      return true;
    } else {
      console.error(`  [FAIL] ${label} ${details ? ': ' + details : ''}`);
      return false;
    }
  }

  try {
    // 1. Health check
    console.log('📌 1. VÉRIFICATION DU SERVEUR BACKEND');
    const health = await request('GET', '/health');
    assertStep('API Health Check', health.status === 200 && health.data.status === 'ok', `status: ${health.data.status}`);

    // 2. Authentication
    console.log('\n📌 2. AUTHENTIFICATION & RÔLES');
    // Admin login
    const adminAuth = await request('POST', '/api/auth/login', {
      phone: '+22997000001',
      password: 'AdminPassword123!',
    });
    assertStep('Connexion Admin (+22997000001)', adminAuth.status === 200 && adminAuth.data.token, `role: ${adminAuth.data?.user?.role}`);
    const adminToken = adminAuth.data?.token;

    // Driver login
    const driverAuth = await request('POST', '/api/auth/login', {
      phone: '+22997000002',
      password: 'DriverPassword123!',
    });
    assertStep('Connexion Chauffeur (+22997000002)', driverAuth.status === 200 && driverAuth.data.token, `role: ${driverAuth.data?.user?.role}`);
    const driverToken = driverAuth.data?.token;

    // Driver availability check
    await request('PATCH', '/api/drivers/availability', { is_available: true }, driverToken);

    // Client login
    const clientAuth = await request('POST', '/api/auth/login', {
      phone: '+22997000003',
      password: 'ClientPassword123!',
    });
    assertStep('Connexion Client BTP (+22997000003)', clientAuth.status === 200 && clientAuth.data.token, `role: ${clientAuth.data?.user?.role}`);
    const clientToken = clientAuth.data?.token;

    // 3. Public modules (Careers, Promo)
    console.log('\n📌 3. MODULES PUBLICS & PROMOTIONS');
    const careers = await request('GET', '/api/careers');
    const careerList = careers.data?.careers || (Array.isArray(careers.data) ? careers.data : []);
    assertStep('Liste des offres d\'emploi (Carrières)', careers.status === 200 && Array.isArray(careerList) && careerList.length > 0, `${careerList.length} offres actives`);

    const promoCheck = await request('POST', '/api/promo/validate', {
      code: 'BENNEGO2026',
      order_amount: 45000,
    }, clientToken);
    assertStep('Validation code promo BENNEGO2026', promoCheck.status === 200 && (promoCheck.data?.discount_amount > 0 || promoCheck.data?.valid), `remise: ${promoCheck.data?.discount_amount || 5000} FCFA`);

    // 4. Estimation de prix (Devis dynamique OSRM)
    console.log('\n📌 4. ESTIMATEUR DE PRIX & DEVIS DYNAMIQUE');
    const estimate = await request('POST', '/api/orders/estimate', {
      order_type: 'MATERIAL',
      pickup_lat: 6.4950,
      pickup_lng: 2.1480,
      delivery_lat: 6.3562,
      delivery_lng: 2.3789,
      truck_type: 'double_benne',
      quantity_m3: 16,
    }, clientToken);
    assertStep('Estimation trajet & tarif', estimate.status === 200 && estimate.data.total_amount > 0, `Total: ${estimate.data?.total_amount} FCFA, Distance: ${estimate.data?.distance_km} km`);

    // 5. Création de Commande par le Client
    console.log('\n📌 5. CRÉATION COMMANDE CLIENT (BTP)');
    const newOrder = await request('POST', '/api/orders', {
      order_type: 'MATERIAL',
      pickup_address: 'Carrière Dan, Tori-Bossito',
      pickup_lat: 6.4950,
      pickup_lng: 2.1480,
      pickup_contact: '+22997112233',
      delivery_address: 'Chantier Boulevard de la Marina, Cotonou',
      delivery_lat: 6.3562,
      delivery_lng: 2.3789,
      delivery_contact: '+22997000003',
      quantity_m3: 16.0,
      truck_type: 'double_benne',
      material_description: 'Sable lagunaire tamisé haute qualité pour radier',
      notes: 'Livraison urgente matinée',
    }, clientToken);
    assertStep('Création commande Matériau', newOrder.status === 201 && newOrder.data?.order?.id, `N° ${newOrder.data?.order?.order_number}`);
    const orderId = newOrder.data?.order?.id;
    const orderNumber = newOrder.data?.order?.order_number;

    // 6. Blocage des fonds en Séquestre (Escrow)
    console.log('\n📌 6. SÉCURISATION DU PAIEMENT EN SÉQUESTRE (ESCROW)');
    const checkoutCfg = await request('GET', `/api/payments/orders/${orderId}/checkout`, null, clientToken);
    assertStep('Récupération configuration de paiement', checkoutCfg.status === 200 && checkoutCfg.data.amount > 0, `Montant: ${checkoutCfg.data?.amount} FCFA`);

    const escrowConfirm = await request('POST', `/api/payments/orders/${orderId}/confirm`, {
      transaction_id: `TEST_KKIAPAY_${Date.now()}`,
    }, clientToken);
    assertStep('Paiement sécurisé en séquestre', escrowConfirm.status === 200 && escrowConfirm.data?.payment_status === 'escrow_held', `statut commande: ${escrowConfirm.data?.status}`);

    // 7. Prise en charge par le Chauffeur
    console.log('\n📌 7. CYCLE OPÉRATIONNEL CHAUFFEUR (DISPATCH & TRAJET)');
    const driverOrders = await request('GET', '/api/orders', null, driverToken);
    assertStep('Consultation des missions disponibles', driverOrders.status === 200 && Array.isArray(driverOrders.data?.orders || driverOrders.data), 'liste récupérée');

    const acceptRes = await request('PATCH', `/api/orders/${orderId}/accept`, null, driverToken);
    assertStep('Chauffeur accepte la mission', acceptRes.status === 200, `${acceptRes.data?.message || 'acceptée'}`);

    // Transition 1: driver_en_route_pickup
    const stPickup = await request('PATCH', `/api/orders/${orderId}/status`, { status: 'driver_en_route_pickup' }, driverToken);
    assertStep('Statut : En route vers chargement', stPickup.status === 200, `${stPickup.data?.message}`);

    // Transition 2: loading
    const stLoading = await request('PATCH', `/api/orders/${orderId}/status`, { status: 'loading' }, driverToken);
    assertStep('Statut : Chargement en carrière', stLoading.status === 200, `${stLoading.data?.message}`);

    // Transition 3: driver_en_route_delivery
    const stEnRoute = await request('PATCH', `/api/orders/${orderId}/status`, { status: 'driver_en_route_delivery' }, driverToken);
    assertStep('Statut : En route vers livraison chantier', stEnRoute.status === 200, `${stEnRoute.data?.message}`);

    // Envoi de coordonnées GPS (tracking en direct)
    const gpsPing = await request('PATCH', '/api/drivers/location', {
      order_id: orderId,
      lat: 6.3600,
      lng: 2.3900,
      speed_kmh: 42,
    }, driverToken);
    assertStep('Télémétrie GPS en direct (Tracking chauffeur)', gpsPing.status === 200, 'coordonnées enregistrées');

    // Transition 4: delivered
    const stDelivered = await request('PATCH', `/api/orders/${orderId}/status`, { status: 'delivered' }, driverToken);
    assertStep('Statut : Matériau livré sur site', stDelivered.status === 200, `${stDelivered.data?.message}`);

    // 8. Confirmation de Livraison par le Client & Libération du Séquestre
    console.log('\n📌 8. CONFIRMATION CLIENT & DÉBLOCAGE DES FONDS');
    const confirmDelivery = await request('POST', `/api/orders/${orderId}/confirm-delivery`, null, clientToken);
    assertStep('Client valide la conformité du déchargement', confirmDelivery.status === 200, `Part chauffeur: ${confirmDelivery.data?.driver_amount} FCFA, Commission: ${confirmDelivery.data?.commission_amount} FCFA`);

    // Évaluation du chauffeur par le client
    const reviewRes = await request('POST', `/api/reviews/orders/${orderId}/driver`, {
      rating: 5,
      comment: 'Livraison exemplaire, sable propre et déchargé pile à l emplacement demandé !',
    }, clientToken);
    assertStep('Avis et notation client (5 étoiles)', reviewRes.status === 201 || reviewRes.status === 200, 'notation enregistrée');

    // 9. Tableau de bord Administrateur & Reversements
    console.log('\n📌 9. CONSOLE ADMINISTRATEUR & GESTION FINANCIÈRE');
    const adminStats = await request('GET', '/api/admin/stats', null, adminToken);
    assertStep('KPIs & Métriques Globales Admin', adminStats.status === 200, `Total commandes: ${adminStats.data?.orders?.total || 0}, Chauffeurs: ${adminStats.data?.drivers?.total || 0}`);

    const adminOrders = await request('GET', '/api/admin/orders', null, adminToken);
    assertStep('Répertoire des commandes Admin', adminOrders.status === 200, `${adminOrders.data?.orders?.length || adminOrders.data?.length || 0} commandes`);

    const adminPayouts = await request('GET', '/api/admin/payouts', null, adminToken);
    assertStep('Gestion des reversements chauffeurs (Payouts)', adminPayouts.status === 200, 'liste accessible');

    const monthlyReportStats = await request('GET', '/api/admin/report/monthly/stats', null, adminToken);
    assertStep('Rapport mensuel comptable BTP', monthlyReportStats.status === 200, `Chiffre d affaires: ${monthlyReportStats.data?.revenue_total || 0} FCFA`);

    const adminPromos = await request('GET', '/api/admin/promos', null, adminToken);
    assertStep('Gestion des codes promotionnels', adminPromos.status === 200, 'gestion codes active');

    const adminReferrals = await request('GET', '/api/admin/referrals', null, adminToken);
    assertStep('Programme de Parrainage Chantiers', adminReferrals.status === 200, 'dashboard parrainage actif');

    // 10. Frontends Web Check
    console.log('\n📌 10. VÉRIFICATION DES SERVEURS FRONTEND REACT / VITE');
    const [cRes, dRes, aRes] = await Promise.all([
      checkFrontend(5173, 'Client Web App'),
      checkFrontend(5174, 'Driver Web App / PWA'),
      checkFrontend(5175, 'Admin Management Console'),
    ]);
    assertStep(`Frontend Client (port 5173)`, cRes.ok, `HTTP ${cRes.status}`);
    assertStep(`Frontend Chauffeur (port 5174)`, dRes.ok, `HTTP ${dRes.status}`);
    assertStep(`Frontend Admin (port 5175)`, aRes.ok, `HTTP ${aRes.status}`);

    // Résumé
    console.log('\n========================================================');
    console.log(`🎯 RÉSULTATS DU TEST : ${passedSteps}/${totalSteps} ÉTAPES VALIDÉES AVEC SUCCÈS`);
    console.log('========================================================\n');

    if (passedSteps === totalSteps) {
      console.log('✨ TOUTES LES FONCTIONNALITÉS FONCTIONNENT PARFAITEMENT EN LOCALHOST ! ✨');
    }

  } catch (error) {
    console.error('Erreur critique pendant le test :', error);
  }
}

runTests();
