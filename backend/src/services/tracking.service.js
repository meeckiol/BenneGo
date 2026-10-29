const { query } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');
const { haversineDistance } = require('./pricing.service');

// Le suivi GPS n'est actif que pendant la course
const ACTIVE_STATUSES = [
  'accepted',
  'driver_en_route_pickup',
  'loading',
  'driver_en_route_delivery',
  'machine_operating',
  'dumping',
];

const toCoord = (value, min, max, label) => {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n) || n < min || n > max) {
    throw new AppError(`${label} invalide`, 400);
  }
  return n;
};

/**
 * Enregistre la position d'un chauffeur et vérifie l'intégrité de l'itinéraire (Suivi GPS certifié B2B).
 * Si le chauffeur s'éloigne de plus de 15% de l'itinéraire optimal OSRM pendant la livraison,
 * une alerte automatique est levée pour prévenir le client/chef de chantier (lutte contre le vol / détournement).
 *
 * @returns {Promise<null | {order: object, point: {lat:number,lng:number,timestamp:string}, deviationAlert: object|null}>}
 */
const recordPosition = async (driverId, { lat, lng, order_id: orderId }) => {
  const latitude = toCoord(lat, -90, 90, 'Latitude');
  const longitude = toCoord(lng, -180, 180, 'Longitude');

  // Position enregistrée seulement quand le camionneur est en ligne ou en course (jamais hors ligne)
  await query(
    `UPDATE driver_profiles SET current_lat = $1, current_lng = $2,
            last_position_at = NOW(), updated_at = NOW()
     WHERE user_id = $3 AND (
       is_available = true
       OR EXISTS (SELECT 1 FROM orders WHERE driver_id = $3 AND status = ANY($4::text[]))
     )`,
    [latitude, longitude, driverId, ACTIVE_STATUSES]
  );
  if (!orderId) return null;

  const { rows } = await query(
    `SELECT id, client_id, driver_id, status, order_number, order_type,
            pickup_lat, pickup_lng, delivery_lat, delivery_lng, distance_km,
            route_deviation_alert
     FROM orders WHERE id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order || order.driver_id !== driverId || !ACTIVE_STATUSES.includes(order.status)) {
    throw new AppError('Course introuvable ou non active', 403);
  }

  await query(
    'INSERT INTO order_tracking (order_id, driver_id, lat, lng) VALUES ($1, $2, $3, $4)',
    [order.id, driverId, latitude, longitude]
  );

  let deviationAlert = null;

  // Suivi GPS Certifié B2B : Vérification de déviation de trajet (> 15%)
  if (order.status === 'driver_en_route_delivery' && order.pickup_lat && order.delivery_lat) {
    const pickupLat = parseFloat(order.pickup_lat);
    const pickupLng = parseFloat(order.pickup_lng);
    const deliveryLat = parseFloat(order.delivery_lat);
    const deliveryLng = parseFloat(order.delivery_lng);
    const expectedKm = parseFloat(order.distance_km) || haversineDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);

    const distFromPickup = haversineDistance(pickupLat, pickupLng, latitude, longitude);
    const distToDelivery = haversineDistance(latitude, longitude, deliveryLat, deliveryLng);
    const currentCorridorKm = distFromPickup + distToDelivery;

    // Si le trajet actuel dépasse de plus de 15% la distance optimale
    if (expectedKm > 2 && (currentCorridorKm / expectedKm) > 1.15) {
      const deviationPct = Math.round(((currentCorridorKm / expectedKm) - 1) * 100);
      deviationAlert = {
        order_id: order.id,
        order_number: order.order_number,
        driver_id: driverId,
        lat: latitude,
        lng: longitude,
        expected_km: expectedKm,
        current_corridor_km: Math.round(currentCorridorKm * 10) / 10,
        deviation_percentage: deviationPct,
        timestamp: new Date().toISOString(),
        message: `Alerte détournement : Le chauffeur s'éloigne de ${deviationPct}% de l'itinéraire optimal OSRM.`,
      };

      // Marquer la commande et enregistrer l'alerte
      await query(
        `UPDATE orders
         SET route_deviation_alert = true,
             route_deviation_details = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(deviationAlert), order.id]
      );

      // Créer une notification persistante pour le client / chef de chantier
      await query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'GPS_ROUTE_DEVIATION', $2, $3, $4)`,
        [
          order.client_id,
          `Alerte GPS : Écart d'itinéraire (${order.order_number})`,
          `Le camion transportant votre commande s'est écarté de ${deviationPct}% de son tracé. Vérifiez sa position en direct.`,
          JSON.stringify(deviationAlert),
        ]
      );
    }
  }

  return {
    order,
    point: { lat: latitude, lng: longitude, timestamp: new Date().toISOString() },
    deviationAlert,
  };
};

/** Diffuse la position et l'alerte éventuelle au client qui suit sa commande */
const broadcastPosition = (io, { order, point, deviationAlert }) => {
  if (!io) return;
  const payload = { order_id: order.id, ...point };
  io.to(`order_${order.id}`).emit('driver_position', payload);
  io.to(`client_${order.client_id}`).emit('driver_position', payload);

  if (deviationAlert) {
    io.to(`order_${order.id}`).emit('route_deviation_alert', deviationAlert);
    io.to(`client_${order.client_id}`).emit('route_deviation_alert', deviationAlert);
  }
};

module.exports = { recordPosition, broadcastPosition, ACTIVE_STATUSES };
