/**
 * Événements temps réel liés aux commandes (Socket.IO).
 * Rooms : drivers_available | client_<id> | driver_<id> | order_<id> (suivi d'une course)
 */

/** Une commande n'est proposée aux chauffeurs QU'APRÈS blocage du paiement. */
const notifyNewOrder = (io, order) => {
  if (!io || order.payment_status !== 'escrow_held') return;
  io.to('drivers_available').emit('new_order', {
    order_id: order.id,
    order_number: order.order_number,
    pickup_address: order.pickup_address,
    delivery_address: order.delivery_address,
    driver_amount: order.driver_amount,
    total_amount: order.total_amount,
    commission_amount: order.commission_amount,
    distance_km: order.distance_km,
  });
};

const notifyPaymentSecured = (io, order) => {
  if (!io) return;
  io.to(`client_${order.client_id}`).emit('payment_secured', { order_id: order.id });
};

const notifyOrderTaken = (io, orderId) => {
  if (io) io.to('drivers_available').emit('order_taken', { order_id: orderId });
};

const notifyStatus = (io, order, status) => {
  if (!io) return;
  const payload = { order_id: order.id, status };
  io.to(`order_${order.id}`).emit('order_status', payload);
  io.to(`client_${order.client_id}`).emit('order_status', payload);
};

module.exports = { notifyNewOrder, notifyPaymentSecured, notifyOrderTaken, notifyStatus };
