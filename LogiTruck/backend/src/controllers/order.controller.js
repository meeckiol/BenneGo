const { query, getClient } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');
const { calculateRoute, calculatePrice } = require('../services/pricing.service');

/**
 * Génère un numéro de commande unique
 */
const generateOrderNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `LT-${year}-${random}`;
};

/**
 * POST /api/orders/estimate
 * Estimateur de prix avant commande
 */
const estimatePrice = async (req, res, next) => {
  try {
    const {
      pickup_lat, pickup_lng,
      delivery_lat, delivery_lng,
      truck_type = 'simple_benne',
    } = req.body;

    const route = await calculateRoute(
      parseFloat(pickup_lat), parseFloat(pickup_lng),
      parseFloat(delivery_lat), parseFloat(delivery_lng)
    );

    const pricing = calculatePrice(route.distance_km, truck_type);

    res.json({
      distance_km: route.distance_km,
      duration_min: route.duration_min,
      ...pricing,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders
 * Créer une nouvelle commande
 */
const createOrder = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      pickup_lat, pickup_lng, pickup_address, pickup_contact,
      delivery_lat, delivery_lng, delivery_address, delivery_contact,
      material_type_id, quantity_m3, material_description,
      truck_type = 'simple_benne', notes,
    } = req.body;

    // Calculer la distance et le prix
    const route = await calculateRoute(
      parseFloat(pickup_lat), parseFloat(pickup_lng),
      parseFloat(delivery_lat), parseFloat(delivery_lng)
    );
    const pricing = calculatePrice(route.distance_km, truck_type);

    const orderNumber = generateOrderNumber();

    const result = await client.query(
      `INSERT INTO orders (
        order_number, client_id,
        pickup_lat, pickup_lng, pickup_address, pickup_contact,
        delivery_lat, delivery_lng, delivery_address, delivery_contact,
        material_type_id, quantity_m3, material_description,
        distance_km, price_per_km,
        total_amount, commission_amount, driver_amount,
        notes, status, payment_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending','unpaid')
      RETURNING *`,
      [
        orderNumber, req.user.id,
        pickup_lat, pickup_lng, pickup_address, pickup_contact || null,
        delivery_lat, delivery_lng, delivery_address, delivery_contact || null,
        material_type_id || null, quantity_m3, material_description || null,
        route.distance_km, pricing.price_per_km,
        pricing.total_amount, pricing.commission_amount, pricing.driver_amount,
        notes || null,
      ]
    );

    await client.query('COMMIT');

    const order = result.rows[0];

    // Notifier les chauffeurs disponibles via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to('drivers_available').emit('new_order', {
        order_id: order.id,
        order_number: order.order_number,
        pickup_address: order.pickup_address,
        delivery_address: order.delivery_address,
        total_amount: order.total_amount,
        driver_amount: order.driver_amount,
        distance_km: order.distance_km,
      });
    }

    res.status(201).json({
      message: 'Commande créée avec succès',
      order,
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
 * Liste des commandes (filtrée selon le rôle)
 */
const getOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '';
    const params = [];
    let paramIdx = 1;

    if (req.user.role === 'client') {
      whereClause = `WHERE o.client_id = $${paramIdx++}`;
      params.push(req.user.id);
    } else if (req.user.role === 'driver') {
      whereClause = `WHERE (o.driver_id = $${paramIdx++} OR o.status = 'pending')`;
      params.push(req.user.id);
    }

    if (status) {
      whereClause += whereClause ? ` AND o.status = $${paramIdx++}` : `WHERE o.status = $${paramIdx++}`;
      params.push(status);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM orders o ${whereClause}`,
      params
    );

    const result = await query(
      `SELECT o.*,
              u_client.full_name AS client_name, u_client.phone AS client_phone,
              u_driver.full_name AS driver_name, u_driver.phone AS driver_phone,
              mt.name AS material_name
       FROM orders o
       LEFT JOIN users u_client ON u_client.id = o.client_id
       LEFT JOIN users u_driver ON u_driver.id = o.driver_id
       LEFT JOIN material_types mt ON mt.id = o.material_type_id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      orders: result.rows,
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
              dp.truck_type, dp.truck_plate,
              mt.name AS material_name
       FROM orders o
       LEFT JOIN users u_client ON u_client.id = o.client_id
       LEFT JOIN users u_driver ON u_driver.id = o.driver_id
       LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
       LEFT JOIN material_types mt ON mt.id = o.material_type_id
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
    if (req.user.role === 'driver' && order.driver_id !== req.user.id && order.status !== 'pending') {
      throw new AppError('Accès refusé', 403);
    }

    res.json({ order });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/orders/:id/accept
 * Chauffeur accepte une commande
 */
const acceptOrder = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (!result.rows.length) {
      throw new AppError('Commande introuvable', 404);
    }

    const order = result.rows[0];

    if (order.status !== 'pending') {
      throw new AppError('Cette commande n\'est plus disponible', 409);
    }

    // Vérifier que le chauffeur est disponible
    const driverResult = await client.query(
      'SELECT is_available FROM driver_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (!driverResult.rows.length || !driverResult.rows[0].is_available) {
      throw new AppError('Vous devez être en mode disponible pour accepter des courses', 400);
    }

    await client.query(
      `UPDATE orders SET
        driver_id = $1, status = 'accepted', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    // Désactiver la disponibilité du chauffeur
    await client.query(
      'UPDATE driver_profiles SET is_available = false WHERE user_id = $1',
      [req.user.id]
    );

    await client.query('COMMIT');

    // Notifier le client via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`client_${order.client_id}`).emit('order_accepted', {
        order_id: order.id,
        driver_id: req.user.id,
        driver_name: req.user.full_name,
      });
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
 * Mettre à jour le statut d'une commande
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validTransitions = {
      driver: {
        accepted: 'driver_en_route_pickup',
        driver_en_route_pickup: 'loading',
        loading: 'driver_en_route_delivery',
        driver_en_route_delivery: 'delivered',
      },
      client: {
        delivered: 'validated',
      },
    };

    const allowedTransitions = validTransitions[req.user.role] || {};

    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1',
      [req.params.id]
    );

    if (!orderResult.rows.length) {
      throw new AppError('Commande introuvable', 404);
    }

    const order = orderResult.rows[0];
    const currentStatus = order.status;
    if (req.user.role === 'driver' && order.driver_id !== req.user.id) {
      throw new AppError('Accès refusé', 403);
    }

    if (req.user.role === 'client' && order.client_id !== req.user.id) {
      throw new AppError('Accès refusé', 403);
    }
    if (allowedTransitions[currentStatus] !== status) {
      throw new AppError(`Transition de statut invalide: ${currentStatus} → ${status}`, 400);
    }

    // Colonnes de timestamp selon le statut
    const timestampColumns = {
      driver_en_route_pickup: 'pickup_at',
      delivered: 'delivered_at',
      validated: 'validated_at',
    };

    const tsColumn = timestampColumns[status];
    const updateQuery = tsColumn
      ? `UPDATE orders SET status = $1, ${tsColumn} = NOW(), updated_at = NOW() WHERE id = $2`
      : `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`;

    await query(updateQuery, [status, req.params.id]);

    // Si validé par le client → déclencher le paiement chauffeur
    if (status === 'validated') {
      const io = req.app.get('io');
      if (io) {
        io.to(`driver_${order.driver_id}`).emit('order_validated', {
          order_id: order.id,
          driver_amount: order.driver_amount,
        });
      }
    }

    res.json({ message: `Statut mis à jour: ${status}` });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  estimatePrice,
  createOrder,
  getOrders,
  getOrder,
  acceptOrder,
  updateOrderStatus,
};
