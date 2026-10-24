/**
 * Continuité de chantier : panne ou crevaison en cours de course.
 * Le chauffeur signale la panne ; l'admin réassigne la course à une benne de réserve disponible.
 */
const { query, getClient } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');

const ACTIVE_STATUSES = ['accepted', 'driver_en_route_pickup', 'loading', 'driver_en_route_delivery', 'machine_operating', 'dumping'];
const BREAKDOWN_REASONS = ['crevaison', 'panne_moteur', 'accident', 'autre'];

/** Le chauffeur de la commande signale une panne. Une seule demande en attente par commande. */
const reportBreakdown = async (orderId, driverId, { reason, lat, lng }) => {
  const db = await getClient();
  try {
    await db.query('BEGIN');
    const { rows } = await db.query('SELECT id, driver_id, status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    if (rows[0].driver_id !== driverId) throw new AppError('Accès refusé', 403);
    if (!ACTIVE_STATUSES.includes(rows[0].status)) {
      throw new AppError('Une panne ne peut être signalée que pendant une course en cours', 409);
    }
    const pending = await db.query(
      `SELECT id FROM breakdown_relief_requests WHERE order_id = $1 AND status = 'pending'`,
      [orderId]
    );
    if (pending.rows.length) throw new AppError('Une demande de relève est déjà en attente', 409);

    const inserted = await db.query(
      `INSERT INTO breakdown_relief_requests (order_id, original_driver_id, breakdown_reason, lat, lng, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [orderId, driverId, reason, lat, lng]
    );
    await db.query('COMMIT');
    return inserted.rows[0];
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
};

/** Admin : réassigne la course en attente à une benne de réserve disponible. */
const assignReliefDriver = async (requestId, reliefDriverId) => {
  const db = await getClient();
  try {
    await db.query('BEGIN');
    const req = await db.query('SELECT * FROM breakdown_relief_requests WHERE id = $1 FOR UPDATE', [requestId]);
    if (!req.rows.length) throw new AppError('Demande introuvable', 404);
    const relief = req.rows[0];
    if (relief.status !== 'pending') throw new AppError('Cette demande a déjà été traitée', 409);
    if (relief.original_driver_id === reliefDriverId) {
      throw new AppError('La benne de réserve doit être un autre chauffeur', 400);
    }

    const order = await db.query('SELECT id, status, driver_id FROM orders WHERE id = $1 FOR UPDATE', [relief.order_id]);
    if (!ACTIVE_STATUSES.includes(order.rows[0].status)) {
      throw new AppError('La course n\'est plus en cours', 409);
    }

    const candidate = await db.query(
      `SELECT dp.is_available, dp.momo_number
       FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1 AND u.role = 'driver' AND u.is_active = true`,
      [reliefDriverId]
    );
    if (!candidate.rows.length) throw new AppError('Chauffeur de réserve introuvable', 404);
    if (!candidate.rows[0].is_available) throw new AppError('Ce chauffeur n\'est pas disponible', 409);
    if (!candidate.rows[0].momo_number) throw new AppError('Ce chauffeur n\'a pas de numéro Mobile Money', 409);

    const busy = await db.query(
      `SELECT id FROM orders WHERE driver_id = $1 AND status = ANY($2::text[]) LIMIT 1`,
      [reliefDriverId, ACTIVE_STATUSES]
    );
    if (busy.rows.length) throw new AppError('Ce chauffeur a déjà une course en cours', 409);

    await db.query(
      `UPDATE orders SET driver_id = $1, updated_at = NOW() WHERE id = $2`,
      [reliefDriverId, relief.order_id]
    );
    const updated = await db.query(
      `UPDATE breakdown_relief_requests
       SET relief_driver_id = $1, status = 'assigned', assigned_at = NOW()
       WHERE id = $2 RETURNING *`,
      [reliefDriverId, requestId]
    );
    await db.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
};

/** Demandes ouvertes, avec le contexte utile à l'admin pour choisir la benne de réserve. */
const listOpenReliefs = async () => {
  const { rows } = await query(
    `SELECT r.*, o.order_number, o.pickup_address, o.delivery_address, o.status AS order_status,
            u.full_name AS original_driver_name, dp.truck_plate AS original_truck_plate
     FROM breakdown_relief_requests r
     JOIN orders o ON o.id = r.order_id
     LEFT JOIN users u ON u.id = r.original_driver_id
     LEFT JOIN driver_profiles dp ON dp.user_id = r.original_driver_id
     WHERE r.status = 'pending'
     ORDER BY r.created_at ASC`
  );
  return rows;
};

/** Chauffeurs disponibles pouvant prendre une relève (disponibles, avec Mobile Money, sans course). */
const listReliefCandidates = async () => {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.phone, dp.truck_plate, dp.truck_type
     FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
     WHERE u.role = 'driver' AND u.is_active = true AND dp.is_available = true
       AND dp.momo_number IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM orders o WHERE o.driver_id = u.id AND o.status = ANY($1::text[])
       )
     ORDER BY u.full_name`,
    [ACTIVE_STATUSES]
  );
  return rows;
};

module.exports = {
  ACTIVE_STATUSES, BREAKDOWN_REASONS,
  reportBreakdown, assignReliefDriver, listOpenReliefs, listReliefCandidates,
};
