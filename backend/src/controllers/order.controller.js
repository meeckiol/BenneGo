const crypto = require('crypto');
const { query, getClient } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');
const { calculateRoute, calculatePrice } = require('../services/pricing.service');
const payments = require('../services/payment.service');
const events = require('../services/order-events');
const { generateReceiptPDF } = require('../services/receipt.service');
const photos = require('../services/photo.service');
const relief = require('../services/sla-quarry.service');

/**
 * Génère un numéro de commande unique
 */
const generateOrderNumber = (prefix = 'LT') => {
  const year = new Date().getFullYear();
  const random = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  return `${prefix}-${year}-${random}`;
};

/**
 * Coordonnées du client (nom, téléphone) : visibles du client, de l'admin et du chauffeur
 * assigné. Un chauffeur non assigné ne les voit pas, même sur une commande en attente.
 */
const withClientContactFor = (order, user) => {
  if (user.role !== 'driver' || order.driver_id === user.id) return order;
  const { client_name: _name, client_phone: _phone, ...withoutContact } = order;
  return withoutContact;
};

// Camionnette (sacs de ciment, briques) : ses chauffeurs ne prennent que les commandes légères, et inversement
const LIGHT_TRUCK = 'pickup';
const canDriverTakeOrder = (orderTruckType, driverTruckType) => (orderTruckType === LIGHT_TRUCK) === (driverTruckType === LIGHT_TRUCK);

/**
 * Transitions autorisées pour les conducteurs selon le type de commande
 */
const getDriverNextStatuses = (orderType, currentStatus) => {
  if (orderType === 'RENTAL') {
    const map = {
      accepted: ['driver_en_route_pickup', 'machine_operating'],
      driver_en_route_pickup: ['machine_operating'],
      machine_operating: ['delivered'],
    };
    return map[currentStatus] || [];
  }
  if (orderType === 'EVACUATION') {
    const map = {
      accepted: ['driver_en_route_pickup'],
      driver_en_route_pickup: ['loading'],
      loading: ['driver_en_route_delivery'],
      driver_en_route_delivery: ['dumping', 'delivered'],
      dumping: ['delivered'],
    };
    return map[currentStatus] || [];
  }
  // Standard MATERIAL
  const map = {
    accepted: ['driver_en_route_pickup'],
    driver_en_route_pickup: ['loading'],
    loading: ['driver_en_route_delivery'],
    driver_en_route_delivery: ['delivered'],
  };
  return map[currentStatus] || [];
};

/**
 * Vérifie si le client connecté bénéficie d'un abonnement B2B actif
 */
const checkUserB2BStatus = async (userId) => {
  const result = await query(
    `SELECT c.id AS company_id, c.name AS company_name, c.subscription_status
     FROM users u
     JOIN companies c ON c.id = u.company_id
     WHERE u.id = $1`,
    [userId]
  );
  if (!result.rows.length) return { isB2b: false, companyId: null };
  const { company_id, subscription_status } = result.rows[0];
  return {
    isB2b: subscription_status === 'active',
    companyId: company_id,
  };
};

/**
 * POST /api/orders/estimate
 * Estimateur de prix multi-services (Matériaux, Location Engin, Évacuation Gravats)
 */
const estimatePrice = async (req, res, next) => {
  try {
    const {
      order_type = 'MATERIAL',
      pickup_lat, pickup_lng,
      delivery_lat, delivery_lng,
      truck_type = 'simple_benne',
      material_type_id,
      quantity_m3,
      duration_hours,
      machinery_type,
      rotations = 1,
      vehicle_type_id,
    } = req.body;

    const b2bStatus = req.user ? await checkUserB2BStatus(req.user.id) : { isB2b: false };

    let route = { distance_km: 0, duration_min: 0, coordinates: [] };
    let materialUnitPrice = 0;
    let vehicleInfo = null;

    if (vehicle_type_id) {
      const vRes = await query('SELECT * FROM vehicle_types WHERE id = $1', [vehicle_type_id]);
      if (vRes.rows.length) vehicleInfo = vRes.rows[0];
    }

    if (material_type_id) {
      const mRes = await query('SELECT base_price_per_unit FROM material_types WHERE id = $1', [material_type_id]);
      if (mRes.rows.length) {
        materialUnitPrice = parseFloat(mRes.rows[0].base_price_per_unit) || 0;
      }
    }

    // Calcul de route OSRM si coordonnées fournies
    if (pickup_lat && pickup_lng && delivery_lat && delivery_lng) {
      route = await calculateRoute(
        parseFloat(pickup_lat), parseFloat(pickup_lng),
        parseFloat(delivery_lat), parseFloat(delivery_lng)
      );
    }

    const pricing = calculatePrice({
      order_type,
      distance_km: route.distance_km,
      truck_type,
      material_unit_price: materialUnitPrice,
      quantity_m3: parseFloat(quantity_m3) || 1,
      duration_hours: parseFloat(duration_hours) || 4,
      machinery_type,
      rotations: parseInt(rotations, 10) || 1,
      is_b2b: b2bStatus.isB2b,
      hourly_rate: vehicleInfo?.hourly_rate,
      base_fare: vehicleInfo?.base_fare,
      km_rate: vehicleInfo?.km_rate,
    });

    res.json({
      order_type,
      distance_km: route.distance_km,
      duration_min: route.duration_min,
      route_coordinates: route.coordinates,
      ...pricing,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders
 * Créer une nouvelle commande (Matériau, Location d'engin ou Évacuation)
 */
const createOrder = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      order_type = 'MATERIAL',
      project_id,
      vehicle_type_id,
      pickup_lat, pickup_lng, pickup_address, pickup_contact,
      delivery_lat, delivery_lng, delivery_address, delivery_contact,
      material_type_id, quantity_m3, material_description,
      truck_type = 'simple_benne',
      duration_hours,
      rental_start_date,
      rental_end_date,
      evacuation_debris_type,
      evacuation_photo_url,
      notes,
    } = req.body;

    const b2bStatus = await checkUserB2BStatus(req.user.id);

    // Coordonnées par défaut si non fournies selon le service
    const pLat = parseFloat(pickup_lat) || 6.3703;
    const pLng = parseFloat(pickup_lng) || 2.3912;
    const dLat = parseFloat(delivery_lat) || 6.3654;
    const dLng = parseFloat(delivery_lng) || 2.4183;

    let route = { distance_km: 0, duration_min: 0, coordinates: [] };
    if (order_type !== 'RENTAL' || (pickup_lat && delivery_lat)) {
      route = await calculateRoute(pLat, pLng, dLat, dLng);
    }

    let materialUnitPrice = 0;
    if (material_type_id) {
      const mRes = await client.query('SELECT base_price_per_unit FROM material_types WHERE id = $1', [material_type_id]);
      if (mRes.rows.length) materialUnitPrice = parseFloat(mRes.rows[0].base_price_per_unit) || 0;
    }

    let vehicleInfo = null;
    if (vehicle_type_id) {
      const vRes = await client.query('SELECT * FROM vehicle_types WHERE id = $1', [vehicle_type_id]);
      if (vRes.rows.length) vehicleInfo = vRes.rows[0];
    }

    const pricing = calculatePrice({
      order_type,
      distance_km: route.distance_km,
      truck_type,
      material_unit_price: materialUnitPrice,
      quantity_m3: parseFloat(quantity_m3) || 1,
      duration_hours: parseFloat(duration_hours) || 4,
      is_b2b: b2bStatus.isB2b,
      hourly_rate: vehicleInfo?.hourly_rate,
      base_fare: vehicleInfo?.base_fare,
      km_rate: vehicleInfo?.km_rate,
    });

    const orderNumber = generateOrderNumber(order_type === 'RENTAL' ? 'ENG' : order_type === 'EVACUATION' ? 'EVAC' : 'LT');

    const result = await client.query(
      `INSERT INTO orders (
        order_number, client_id, project_id, order_type, vehicle_type_id,
        pickup_lat, pickup_lng, pickup_address, pickup_contact,
        delivery_lat, delivery_lng, delivery_address, delivery_contact,
        material_type_id, quantity_m3, material_description,
        duration_hours, rental_start_date, rental_end_date,
        evacuation_debris_type, evacuation_photo_url,
        distance_km, price_per_km,
        total_amount, commission_amount, driver_amount,
        notes, status, payment_status
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19,
        $20, $21,
        $22, $23,
        $24, $25, $26,
        $27, 'awaiting_payment', 'unpaid'
      )
      RETURNING *`,
      [
        orderNumber, req.user.id, project_id || null, order_type, vehicle_type_id || null,
        pLat, pLng, pickup_address || 'Point de ramassage', pickup_contact || null,
        dLat, dLng, delivery_address || 'Point de chantier / décharge', delivery_contact || null,
        material_type_id || null, parseFloat(quantity_m3) || 1, material_description || null,
        duration_hours ? parseFloat(duration_hours) : null, rental_start_date || null, rental_end_date || null,
        evacuation_debris_type || null, evacuation_photo_url || null,
        route.distance_km, pricing.price_per_km,
        pricing.total_amount, pricing.commission_amount, pricing.driver_amount,
        notes || null,
      ]
    );
    // Le type de camion demandé est enregistré avec la commande (même transaction)
    await client.query('UPDATE orders SET truck_type = $2 WHERE id = $1', [result.rows[0].id, truck_type]);

    await client.query('COMMIT');
    const order = result.rows[0];

    res.status(201).json({
      message: 'Commande créée. Procédez au paiement pour la bloquer en séquestre.',
      order,
      breakdown: pricing.breakdown,
      next_step: 'payment',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * POST /api/orders/bulk
 * Planification massive B2B (BenneGo Enterprise)
 * Permet de planifier N rotations de camions sur X jours (ex: 10 rotations/jour sur 5 jours = 50 courses)
 * Génère automatiquement une facture proforma unique avec virement/chèque sur compte séquestre.
 */
const createBulkOrders = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      project_id,
      order_type = 'MATERIAL',
      vehicle_type_id,
      pickup_lat, pickup_lng, pickup_address, pickup_contact,
      delivery_lat, delivery_lng, delivery_address, delivery_contact,
      material_type_id, quantity_per_truck_m3 = 16, material_description,
      truck_type = 'double_benne',
      rotations_per_day = 10,
      number_of_days = 5,
      start_date = new Date().toISOString().split('T')[0],
      notes,
    } = req.body;

    const b2bStatus = await checkUserB2BStatus(req.user.id);
    const totalTrips = Math.min(Math.max(parseInt(rotations_per_day, 10) * parseInt(number_of_days, 10), 1), 200);

    const pLat = parseFloat(pickup_lat);
    const pLng = parseFloat(pickup_lng);
    const dLat = parseFloat(delivery_lat);
    const dLng = parseFloat(delivery_lng);

    const route = await calculateRoute(pLat, pLng, dLat, dLng);

    let materialUnitPrice = 0;
    if (material_type_id) {
      const mRes = await client.query('SELECT base_price_per_unit FROM material_types WHERE id = $1', [material_type_id]);
      if (mRes.rows.length) materialUnitPrice = parseFloat(mRes.rows[0].base_price_per_unit) || 0;
    }

    const unitPricing = calculatePrice({
      order_type,
      distance_km: route.distance_km,
      truck_type,
      material_unit_price: materialUnitPrice,
      quantity_m3: parseFloat(quantity_per_truck_m3),
      is_b2b: true, // Taux préférentiel B2B
    });

    const bulkGroupId = crypto.randomUUID();
    const proformaInvoiceNumber = `PROFORMA-${new Date().getFullYear()}-${crypto.randomInt(100000, 999999)}`;

    const createdOrders = [];
    const baseStartDate = new Date(start_date);

    for (let day = 0; day < number_of_days; day++) {
      const scheduledDate = new Date(baseStartDate);
      scheduledDate.setDate(scheduledDate.getDate() + day);

      for (let rot = 1; rot <= rotations_per_day; rot++) {
        const orderNumber = generateOrderNumber('LT-B2B');
        const resOrder = await client.query(
          `INSERT INTO orders (
            order_number, client_id, project_id, order_type, vehicle_type_id,
            pickup_lat, pickup_lng, pickup_address, pickup_contact,
            delivery_lat, delivery_lng, delivery_address, delivery_contact,
            material_type_id, quantity_m3, material_description,
            distance_km, price_per_km,
            total_amount, commission_amount, driver_amount,
            is_bulk_order, bulk_group_id, proforma_invoice_number,
            notes, status, payment_status
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16,
            $17, $18,
            $19, $20, $21,
            true, $22, $23,
            $24, 'awaiting_payment', 'unpaid'
          ) RETURNING id, order_number, total_amount`,
          [
            orderNumber, req.user.id, project_id || null, order_type, vehicle_type_id || null,
            pLat, pLng, pickup_address, pickup_contact || null,
            dLat, dLng, delivery_address, delivery_contact || null,
            material_type_id || null, parseFloat(quantity_per_truck_m3), material_description || null,
            route.distance_km, unitPricing.price_per_km,
            unitPricing.total_amount, unitPricing.commission_amount, unitPricing.driver_amount,
            bulkGroupId, proformaInvoiceNumber,
            `${notes || ''} (Jour ${day + 1}/${number_of_days} - Rotation ${rot}/${rotations_per_day})`.trim(),
          ]
        );
        await client.query('UPDATE orders SET truck_type = $2 WHERE id = $1', [resOrder.rows[0].id, truck_type]);
        createdOrders.push(resOrder.rows[0]);
      }
    }

    await client.query('COMMIT');

    const totalAmountGlobal = unitPricing.total_amount * totalTrips;
    const totalCommissionGlobal = unitPricing.commission_amount * totalTrips;
    const totalDriverGlobal = unitPricing.driver_amount * totalTrips;

    res.status(201).json({
      message: `Planification massive créée avec succès : ${totalTrips} camions programmés.`,
      bulk_group_id: bulkGroupId,
      proforma_invoice_number: proformaInvoiceNumber,
      total_orders_count: totalTrips,
      unit_price_per_trip: unitPricing.total_amount,
      total_amount_global: totalAmountGlobal,
      total_commission_global: totalCommissionGlobal,
      total_driver_global: totalDriverGlobal,
      escrow_bank_details: {
        bank_name: 'BOA Bénin / Ecobank Bénin',
        account_name: 'BenneGo Escrow Account SARL',
        rib: 'BJ061 01001 00123456789 22',
        instructions: `Effectuez votre virement ou déposez votre chèque avec le libellé "${proformaInvoiceNumber}". Une fois validé par l'administration, vos 50 courses seront débloquées en temps réel pour les chauffeurs.`,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * GET /api/orders
 * Liste des commandes (filtrée selon le rôle et les filtres B2B)
 */
const getOrders = async (req, res, next) => {
  try {
    const { status, order_type, project_id, bulk_group_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '';
    const params = [];
    let paramIdx = 1;

    if (req.user.role === 'client') {
      whereClause = `WHERE o.client_id = $${paramIdx++}`;
      params.push(req.user.id);
    } else if (req.user.role === 'driver') {
      // Les chauffeurs voient leurs courses ou les courses en attente payées en séquestre
      // Filtrage par catégorie de véhicule selon profil chauffeur
      const dpRes = await query('SELECT vehicle_category, truck_type FROM driver_profiles WHERE user_id = $1', [req.user.id]);
      const driverProfile = dpRes.rows[0];

      let categoryFilter = '';
      if (driverProfile?.vehicle_category === 'HEAVY_MACHINERY') {
        categoryFilter = " AND o.order_type = 'RENTAL'";
      } else {
        // Camions bennes : Transport de matériaux ou Évacuation de gravats
        categoryFilter = " AND o.order_type IN ('MATERIAL', 'EVACUATION')";
      }

      // Camionnette : seulement les commandes légères ; les autres camions ne voient jamais ces commandes
      categoryFilter += driverProfile?.truck_type === LIGHT_TRUCK ? " AND o.truck_type = 'pickup'" : " AND (o.truck_type IS NULL OR o.truck_type <> 'pickup')";

      whereClause = `WHERE (o.driver_id = $${paramIdx++} OR (o.status = 'pending' AND o.payment_status = 'escrow_held'${categoryFilter}))`;
      params.push(req.user.id);
    }

    if (status) {
      whereClause += whereClause ? ` AND o.status = $${paramIdx++}` : `WHERE o.status = $${paramIdx++}`;
      params.push(status);
    }

    if (order_type) {
      whereClause += whereClause ? ` AND o.order_type = $${paramIdx++}` : `WHERE o.order_type = $${paramIdx++}`;
      params.push(order_type.toUpperCase());
    }

    if (project_id) {
      whereClause += whereClause ? ` AND o.project_id = $${paramIdx++}` : `WHERE o.project_id = $${paramIdx++}`;
      params.push(project_id);
    }

    if (bulk_group_id) {
      whereClause += whereClause ? ` AND o.bulk_group_id = $${paramIdx++}` : `WHERE o.bulk_group_id = $${paramIdx++}`;
      params.push(bulk_group_id);
    }

    const countResult = await query(`SELECT COUNT(*) FROM orders o ${whereClause}`, params);

    const result = await query(
      `SELECT o.*,
              u_client.full_name AS client_name, u_client.phone AS client_phone,
              u_driver.full_name AS driver_name, u_driver.phone AS driver_phone,
              mt.name AS material_name, vt.name AS vehicle_name, vt.category AS vehicle_category,
              pc.name AS project_name
       FROM orders o
       LEFT JOIN users u_client ON u_client.id = o.client_id
       LEFT JOIN users u_driver ON u_driver.id = o.driver_id
       LEFT JOIN material_types mt ON mt.id = o.material_type_id
       LEFT JOIN vehicle_types vt ON vt.id = o.vehicle_type_id
       LEFT JOIN projects_chantiers pc ON pc.id = o.project_id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      orders: result.rows.map((order) => withClientContactFor(order, req.user)),
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orders/:id
 * Détail d'une commande
 */
const getOrder = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT o.*,
              u_client.full_name AS client_name, u_client.phone AS client_phone,
              u_driver.full_name AS driver_name, u_driver.phone AS driver_phone,
              dp.truck_type, dp.truck_plate, dp.rating AS driver_rating_avg, dp.rating_count AS driver_rating_count,
              mt.name AS material_name, vt.name AS vehicle_name, vt.category AS vehicle_category,
              pc.name AS project_name, pc.address AS project_address
       FROM orders o
       LEFT JOIN users u_client ON u_client.id = o.client_id
       LEFT JOIN users u_driver ON u_driver.id = o.driver_id
       LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
       LEFT JOIN material_types mt ON mt.id = o.material_type_id
       LEFT JOIN vehicle_types vt ON vt.id = o.vehicle_type_id
       LEFT JOIN projects_chantiers pc ON pc.id = o.project_id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      throw new AppError('Commande introuvable', 404);
    }

    const order = result.rows[0];

    // Vérifier les droits d'accès
    if (req.user.role === 'client' && order.client_id !== req.user.id) {
      throw new AppError('Accès refusé', 403);
    }
    if (req.user.role === 'driver' && order.driver_id !== req.user.id
      && !(order.status === 'pending' && order.payment_status === 'escrow_held')) {
      throw new AppError('Accès refusé', 403);
    }

    const photosRes = await query(
      'SELECT kind, url, created_at FROM order_photos WHERE order_id = $1 ORDER BY created_at',
      [req.params.id]
    );
    res.json({ order: { ...withClientContactFor(order, req.user), photos: photosRes.rows } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/orders/:id/accept
 * Chauffeur accepte une commande (uniquement si le paiement est bloqué en séquestre)
 */
const acceptOrder = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (!result.rows.length) throw new AppError('Commande introuvable', 404);
    const order = result.rows[0];

    if (order.status !== 'pending' || order.payment_status !== 'escrow_held') {
      throw new AppError('Cette commande n\'est plus disponible', 409);
    }

    // Le véhicule du chauffeur doit correspondre à la commande (contrôle côté serveur, pas seulement dans la liste)
    const profileResult = await client.query('SELECT truck_type FROM driver_profiles WHERE user_id = $1', [req.user.id]);
    if (!canDriverTakeOrder(order.truck_type, profileResult.rows[0]?.truck_type)) {
      throw new AppError('Cette commande ne correspond pas au véhicule de votre profil', 403);
    }

    const driverResult = await client.query(
      'SELECT is_available, momo_number, momo_provider FROM driver_profiles WHERE user_id = $1 FOR UPDATE',
      [req.user.id]
    );
    const profile = driverResult.rows[0];
    if (!profile) throw new AppError('Complétez votre profil chauffeur avant d\'accepter une course', 400);
    if (!profile.momo_number || !profile.momo_provider) {
      throw new AppError('Renseignez votre numéro Mobile Money : il sert à vous verser votre part', 400);
    }
    if (!profile.is_available) {
      throw new AppError('Vous devez être en mode disponible pour accepter des courses', 400);
    }

    await client.query(
      `UPDATE orders SET driver_id = $1, status = 'accepted', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [req.user.id, order.id]
    );
    await client.query('UPDATE driver_profiles SET is_available = false WHERE user_id = $1', [req.user.id]);
    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.to(`client_${order.client_id}`).emit('order_accepted', {
        order_id: order.id,
        driver_id: req.user.id,
        driver_name: req.user.full_name,
      });
      events.notifyStatus(io, order, 'accepted');
      events.notifyOrderTaken(io, order.id);
    }

    res.json({ message: 'Commande acceptée avec succès' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * PATCH /api/orders/:id/status
 * Le chauffeur fait avancer la course. La validation finale appartient au client
 */
const updateOrderStatus = async (req, res, next) => {
  const { status } = req.body;
  if (req.user.role !== 'driver') {
    return next(new AppError('Seul le chauffeur peut faire avancer la course. Le client confirme la réception via « Confirmer la réception ».', 403));
  }

  const db = await getClient();
  try {
    await db.query('BEGIN');
    const orderResult = await db.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!orderResult.rows.length) throw new AppError('Commande introuvable', 404);
    const order = orderResult.rows[0];

    if (order.driver_id !== req.user.id) throw new AppError('Accès refusé', 403);
    if (order.payment_status !== 'escrow_held') throw new AppError('Paiement non sécurisé pour cette commande', 409);

    const allowedNext = getDriverNextStatuses(order.order_type, order.status);
    if (!allowedNext.includes(status)) {
      throw new AppError(`Transition de statut invalide: ${order.status} → ${status}`, 400);
    }
    if (status === 'driver_en_route_delivery' && order.loading_volume_m3 === null) {
      throw new AppError('Enregistrez le volume chargé et les photos du chargement avant de partir', 409);
    }

    const timestampColumns = {
      driver_en_route_pickup: 'pickup_at',
      delivered: 'delivered_at',
    };
    const tsColumn = timestampColumns[status];
    await db.query(
      tsColumn
        ? `UPDATE orders SET status = $1, ${tsColumn} = NOW(), updated_at = NOW() WHERE id = $2`
        : 'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, order.id]
    );
    await db.query('COMMIT');

    const io = req.app.get('io');
    events.notifyStatus(io, order, status);
    if (status === 'delivered' && io) {
      io.to(`client_${order.client_id}`).emit('delivery_to_confirm', {
        order_id: order.id,
        order_type: order.order_type,
      });
    }

    res.json({ message: `Statut mis à jour: ${status}` });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
  } finally {
    db.release();
  }
};

/**
 * POST /api/orders/:id/confirm-delivery (client)
 * Pour Transport de Matériaux : Le client confirme la réception -> libération du séquestre (90% chauffeur / 10% plateforme)
 */
const confirmDelivery = async (req, res, next) => {
  try {
    const result = await payments.confirmDelivery(req.params.id, req.user.id);
    const io = req.app.get('io');

    if (!result.alreadyDone && io) {
      events.notifyStatus(io, result.order, 'validated');
      io.to(`driver_${result.driverId}`).emit('order_validated', {
        order_id: result.orderId,
        driver_amount: result.order.driver_amount,
      });
    }

    res.json({
      message: 'Livraison confirmée. Le paiement séquestré a été débloqué et transmis au chauffeur.',
      commission_amount: Number(result.order.commission_amount),
      driver_amount: Number(result.order.driver_amount),
      payout: result.settlement.status,
      can_review: true,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders/:id/confirm-rental (client)
 * Pour Location d'Engins : L'argent reste bloqué tant que l'engin n'a pas travaillé la durée convenue.
 * Le client valide les heures d'opération -> libération des fonds.
 */
const confirmRental = async (req, res, next) => {
  try {
    await query(
      `UPDATE orders SET rental_hours_confirmed = true, updated_at = NOW()
       WHERE id = $1 AND client_id = $2 AND status = 'delivered' AND dispute_status IS DISTINCT FROM 'open'`,
      [req.params.id, req.user.id]
    );

    const result = await payments.confirmDelivery(req.params.id, req.user.id);
    const io = req.app.get('io');

    if (!result.alreadyDone && io) {
      events.notifyStatus(io, result.order, 'validated');
      io.to(`driver_${result.driverId}`).emit('order_validated', {
        order_id: result.orderId,
        driver_amount: result.order.driver_amount,
      });
    }

    res.json({
      message: 'Heures d\'opération de l\'engin validées ! Le paiement séquestré a été transmis au propriétaire de la machine.',
      commission_amount: Number(result.order.commission_amount),
      driver_amount: Number(result.order.driver_amount),
      payout: result.settlement.status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders/:id/confirm-evacuation (client)
 * Pour Évacuation de gravats : L'argent est libéré uniquement lorsque le chauffeur confirme
 * avoir déposé les gravats à la décharge et que le client valide que son chantier est propre.
 */
const confirmEvacuation = async (req, res, next) => {
  try {
    await query(
      `UPDATE orders SET site_cleaned_confirmed = true, updated_at = NOW()
       WHERE id = $1 AND client_id = $2 AND status = 'delivered' AND dispute_status IS DISTINCT FROM 'open'`,
      [req.params.id, req.user.id]
    );

    const result = await payments.confirmDelivery(req.params.id, req.user.id);
    const io = req.app.get('io');

    if (!result.alreadyDone && io) {
      events.notifyStatus(io, result.order, 'validated');
      io.to(`driver_${result.driverId}`).emit('order_validated', {
        order_id: result.orderId,
        driver_amount: result.order.driver_amount,
      });
    }

    res.json({
      message: 'Propreté du chantier validée ! Le paiement séquestré a été transmis au chauffeur.',
      commission_amount: Number(result.order.commission_amount),
      driver_amount: Number(result.order.driver_amount),
      payout: result.settlement.status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders/:id/driver-confirm-dump (driver)
 * Pour Évacuation : Le chauffeur confirme avoir déversé les gravats à la décharge officielle.
 */
const driverConfirmDump = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    const order = rows[0];

    if (order.driver_id !== req.user.id) throw new AppError('Accès refusé', 403);
    if (order.order_type !== 'EVACUATION') throw new AppError('Action réservée aux ordres d\'évacuation', 400);

    await query(
      `UPDATE orders
       SET dump_site_confirmed = true, status = 'delivered', delivered_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [order.id]
    );

    const io = req.app.get('io');
    events.notifyStatus(io, order, 'delivered');
    if (io) {
      io.to(`client_${order.client_id}`).emit('delivery_to_confirm', {
        order_id: order.id,
        order_type: 'EVACUATION',
        message: 'Le chauffeur a vidé les gravats à la décharge. Veuillez valider la propreté du chantier pour libérer les fonds.',
      });
    }

    res.json({ message: 'Déversement à la décharge confirmé. En attente de validation propreté par le client.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders/:id/cancel (client)
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    const order = rows[0];
    if (order.client_id !== req.user.id) throw new AppError('Accès refusé', 403);

    if (order.status === 'awaiting_payment' && order.payment_status === 'unpaid') {
      const upd = await query(
        `UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $2, updated_at = NOW()
         WHERE id = $1 AND status = 'awaiting_payment' AND payment_status = 'unpaid'`,
        [order.id, req.body.reason || null]
      );
      if (!upd.rowCount) throw new AppError('Annulation impossible', 409);
      return res.json({ message: 'Commande annulée', refunded: false });
    }

    await payments.refundEscrow(order.id, { actor: req.user, reason: req.body.reason });
    events.notifyOrderTaken(req.app.get('io'), order.id);
    res.json({ message: 'Commande annulée et remboursée', refunded: true });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orders/:id/tracking
 */
const getTracking = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, client_id, driver_id, status, route_deviation_alert, route_deviation_details FROM orders WHERE id = $1', [req.params.id]);
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    const order = rows[0];
    const allowed = req.user.role === 'admin'
      || (req.user.role === 'client' && order.client_id === req.user.id)
      || (req.user.role === 'driver' && order.driver_id === req.user.id);
    if (!allowed) throw new AppError('Accès refusé', 403);

    const points = await query(
      `SELECT lat, lng, recorded_at FROM (
         SELECT lat, lng, recorded_at FROM order_tracking WHERE order_id = $1
         ORDER BY recorded_at DESC LIMIT 300
       ) t ORDER BY recorded_at ASC`,
      [order.id]
    );
    const route = points.rows.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), recorded_at: p.recorded_at }));
    res.json({
      order_id: order.id,
      status: order.status,
      route,
      last: route[route.length - 1] || null,
      route_deviation_alert: order.route_deviation_alert,
      route_deviation_details: order.route_deviation_details,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Requête SQL commune pour récupérer une commande avec toutes les infos
 */
const fetchOrderForReceipt = async (orderId) => {
  const result = await query(
    `SELECT
       o.*,
       u_c.full_name  AS client_full_name,
       u_c.prenom     AS client_prenom,
       u_c.nom        AS client_nom,
       u_c.phone      AS client_phone,
       u_c.email      AS client_email,
       u_c.date_naissance AS client_date_naissance,
       u_c.adresse    AS client_adresse,
       u_d.full_name  AS driver_full_name,
       u_d.phone      AS driver_phone,
       u_d.prenom     AS driver_prenom,
       u_d.nom        AS driver_nom,
       dp.truck_type,
       dp.truck_plate,
       dp.momo_number AS driver_momo_number,
       dp.momo_provider AS driver_momo_provider,
       dp.date_naissance AS driver_date_naissance,
       dp.adresse     AS driver_adresse,
       mt.name        AS material_name,
       vt.name        AS vehicle_name,
       pc.name        AS project_name
     FROM orders o
     LEFT JOIN users u_c ON u_c.id = o.client_id
     LEFT JOIN users u_d ON u_d.id = o.driver_id
     LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
     LEFT JOIN material_types mt ON mt.id = o.material_type_id
     LEFT JOIN vehicle_types vt ON vt.id = o.vehicle_type_id
     LEFT JOIN projects_chantiers pc ON pc.id = o.project_id
     WHERE o.id = $1`,
    [orderId]
  );
  return result.rows[0] || null;
};

const getReceiptClient = async (req, res, next) => {
  try {
    const order = await fetchOrderForReceipt(req.params.id);
    if (!order) throw new AppError('Commande introuvable', 404);

    if (req.user.role === 'driver') {
      throw new AppError('Accès refusé. Utilisez /receipt/driver pour votre reçu.', 403);
    }
    if (req.user.role === 'client' && order.client_id !== req.user.id) {
      throw new AppError('Accès refusé', 403);
    }

    generateReceiptPDF(res, order, 'client');
  } catch (error) {
    next(error);
  }
};

const getReceiptDriver = async (req, res, next) => {
  try {
    const order = await fetchOrderForReceipt(req.params.id);
    if (!order) throw new AppError('Commande introuvable', 404);

    if (req.user.role === 'client') {
      throw new AppError('Accès refusé. Utilisez /receipt pour votre reçu.', 403);
    }
    if (req.user.role === 'driver' && order.driver_id !== req.user.id) {
      throw new AppError('Accès refusé', 403);
    }
    if (!order.driver_id) {
      throw new AppError('Aucun conducteur assigné à cette commande', 400);
    }

    generateReceiptPDF(res, order, 'driver');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders/:id/loading (chauffeur)
 * Volume chargé déclaré + photos du chargement, et ticket de pesée optionnel. Étape « chargement » uniquement.
 */
const recordLoading = async (req, res, next) => {
  const loadingFiles = req.files?.photos || [];
  const weighbridgeFile = req.files?.weighbridge?.[0] || null;
  const db = await getClient();
  try {
    if (!loadingFiles.length) throw new AppError('Au moins une photo du chargement est requise', 400);
    const volume = Number(req.body.volume_m3);
    const netKg = req.body.weighbridge_net_kg ? Number(req.body.weighbridge_net_kg) : null;

    await db.query('BEGIN');
    const { rows } = await db.query('SELECT id, driver_id, status FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    if (rows[0].driver_id !== req.user.id) throw new AppError('Accès refusé', 403);
    if (rows[0].status !== 'loading') {
      throw new AppError('Le chargement ne peut être enregistré qu\'à l\'étape « chargement »', 409);
    }

    const loadingUrls = await Promise.all(loadingFiles.map(photos.saveImage));
    const weighbridgeUrls = weighbridgeFile ? [await photos.saveImage(weighbridgeFile)] : [];
    const urls = [...loadingUrls, ...weighbridgeUrls];
    const kinds = [...loadingUrls.map(() => 'loading'), ...weighbridgeUrls.map(() => 'weighbridge')];
    await db.query(
      `INSERT INTO order_photos (order_id, kind, url, uploaded_by)
       SELECT $1, t.kind, t.url, $2 FROM unnest($3::text[], $4::text[]) AS t(kind, url)`,
      [req.params.id, req.user.id, kinds, urls]
    );
    await db.query(
      `UPDATE orders SET loading_volume_m3 = $2, loading_recorded_at = NOW(),
              weighbridge_net_kg = COALESCE($3, weighbridge_net_kg), updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, volume, netKg]
    );
    await db.query('COMMIT');
    res.json({ message: 'Chargement enregistré', loading_volume_m3: volume, photos_added: urls.length });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
  } finally {
    db.release();
  }
};

/**
 * POST /api/orders/:id/dispute (client)
 * Refus de la livraison avant confirmation : le séquestre reste bloqué jusqu'à la décision de l'admin.
 */
const openDispute = async (req, res, next) => {
  const db = await getClient();
  try {
    const reason = String(req.body.reason || '').trim();
    const disputeFiles = req.files || [];
    if (reason.length < 10) throw new AppError('Décrivez le problème (10 caractères minimum)', 400);
    if (!disputeFiles.length) throw new AppError('Ajoutez au moins une photo de la marchandise livrée', 400);

    await db.query('BEGIN');
    const { rows } = await db.query(
      'SELECT id, client_id, driver_id, status, payment_status, dispute_status FROM orders WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    const order = rows[0];
    if (order.client_id !== req.user.id) throw new AppError('Accès refusé', 403);
    if (order.status !== 'delivered' || order.payment_status !== 'escrow_held') {
      throw new AppError('Un litige ne peut être ouvert qu\'après la livraison, tant que le paiement est bloqué', 409);
    }
    if (order.dispute_status) throw new AppError('Un litige a déjà été ouvert sur cette commande', 409);

    const urls = await Promise.all(disputeFiles.map(photos.saveImage));
    await db.query(
      `INSERT INTO order_photos (order_id, kind, url, uploaded_by)
       SELECT $1, 'dispute', t.url, $2 FROM unnest($3::text[]) AS t(url)`,
      [order.id, req.user.id, urls]
    );
    await db.query(
      `UPDATE orders SET dispute_status = 'open', dispute_reason = $2, dispute_opened_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [order.id, reason.slice(0, 1000)]
    );
    await db.query('COMMIT');

    const io = req.app.get('io');
    if (io && order.driver_id) io.to(`driver_${order.driver_id}`).emit('dispute_opened', { order_id: order.id });
    res.status(201).json({ message: 'Litige ouvert. Le paiement reste bloqué jusqu\'à la décision de BenneGo.' });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
  } finally {
    db.release();
  }
};

/**
 * POST /api/orders/:id/breakdown (chauffeur)
 * Panne ou crevaison en cours de course : demande de relève envoyée à l'admin.
 */
const reportBreakdown = async (req, res, next) => {
  try {
    const request = await relief.reportBreakdown(req.params.id, req.user.id, {
      reason: req.body.reason,
      lat: Number(req.body.lat),
      lng: Number(req.body.lng),
    });
    res.status(201).json({ message: 'Panne signalée. BenneGo cherche une benne de réserve.', request });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  canDriverTakeOrder,
  recordLoading,
  openDispute,
  reportBreakdown,
  estimatePrice,
  createOrder,
  createBulkOrders,
  getOrders,
  getOrder,
  acceptOrder,
  updateOrderStatus,
  confirmDelivery,
  confirmRental,
  confirmEvacuation,
  driverConfirmDump,
  cancelOrder,
  getTracking,
  getReceiptClient,
  getReceiptDriver,
};
