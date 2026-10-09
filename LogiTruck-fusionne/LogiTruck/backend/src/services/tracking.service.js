const { query } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');

// Le suivi GPS n'est actif que pendant la course
const ACTIVE_STATUSES = ['accepted', 'driver_en_route_pickup', 'loading', 'driver_en_route_delivery'];

const toCoord = (value, min, max, label) => {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n) || n < min || n > max) {
    throw new AppError(`${label} invalide`, 400);
  }
  return n;
};

/**
 * Enregistre la position d'un chauffeur. Si `order_id` est fourni, la course doit appartenir
 * au chauffeur ET être active : un chauffeur ne peut pas injecter de positions dans la course d'un autre.
 * @returns {Promise<null | {order: object, point: {lat:number,lng:number,timestamp:string}}>}
 */
const recordPosition = async (driverId, { lat, lng, order_id: orderId }) => {
  const latitude = toCoord(lat, -90, 90, 'Latitude');
  const longitude = toCoord(lng, -180, 180, 'Longitude');

  await query(
    `UPDATE driver_profiles SET current_lat = $1, current_lng = $2,
            last_position_at = NOW(), updated_at = NOW() WHERE user_id = $3`,
    [latitude, longitude, driverId]
  );
  if (!orderId) return null;

  const { rows } = await query('SELECT id, client_id, driver_id, status FROM orders WHERE id = $1', [orderId]);
  const order = rows[0];
  if (!order || order.driver_id !== driverId || !ACTIVE_STATUSES.includes(order.status)) {
    throw new AppError('Course introuvable ou non active', 403);
  }
  await query(
    'INSERT INTO order_tracking (order_id, driver_id, lat, lng) VALUES ($1, $2, $3, $4)',
    [order.id, driverId, latitude, longitude]
  );
  return { order, point: { lat: latitude, lng: longitude, timestamp: new Date().toISOString() } };
};

/** Diffuse la position au client qui suit sa commande */
const broadcastPosition = (io, { order, point }) => {
  if (!io) return;
  const payload = { order_id: order.id, ...point };
  io.to(`order_${order.id}`).emit('driver_position', payload);
  io.to(`client_${order.client_id}`).emit('driver_position', payload);
};

module.exports = { recordPosition, broadcastPosition, ACTIVE_STATUSES };
