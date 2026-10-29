/**
 * Événements temps réel liés aux commandes (Socket.IO).
 * Rooms : drivers_available | client_<id> | driver_<id> | order_<id> (suivi d'une course)
 */

const { query } = require('../config/database');
const push = require('./push.service');

const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;
const quietly = (promise) => Promise.resolve(promise).catch((err) => console.error('Notification push :', err.message));

// Statuts annoncés au client par notification push ; ceux d'une course en cours sonnent même aux heures calmes
const CLIENT_PUSH = {
  accepted: ['Commande acceptée', 'Un camionneur a accepté votre commande.', true],
  driver_en_route_pickup: ['En route vers la carrière', 'Votre camionneur part charger.', true],
  loading: ['Chargement en cours', 'Votre commande est en cours de chargement.', true],
  machine_operating: ["L'engin est au travail", 'La location a commencé.', true],
  driver_en_route_delivery: ['En route vers vous', 'Votre livraison est en chemin.', true],
  delivered: ['Livraison arrivée', 'Confirmez la réception pour libérer le paiement.', true],
  validated: ['Commande terminée', 'Merci pour votre confiance !', false],
  cancelled: ['Commande annulée', 'Votre commande a été annulée.', false],
};

// Console admin : un seul signal « analyses à rafraîchir » toutes les 3 s au plus, même si plusieurs commandes bougent
let adminTimer = null;
const notifyAdmins = (io) => {
  if (!io || adminTimer) return;
  adminTimer = setTimeout(() => {
    adminTimer = null;
    io.to('admins').emit('analytics_changed', { reason: 'orders' });
  }, 3000);
  adminTimer.unref?.();
};

/** Une commande n'est proposée aux chauffeurs QU'APRÈS blocage du paiement. */
const notifyNewOrder = (io, order) => {
  if (!io || order.payment_status !== 'escrow_held') return;
  notifyAdmins(io);
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
  // Application fermée : notification push aux camionneurs en ligne qui veulent les nouvelles courses
  quietly(query('SELECT user_id FROM driver_profiles WHERE is_available = true').then(({ rows }) => Promise.all(
    rows.map((row) => push.sendToUser(row.user_id, {
      title: 'Nouvelle course disponible',
      body: `${order.pickup_address || 'Départ'} → ${order.delivery_address || 'Arrivée'} · ${fcfa(order.driver_amount)}`,
      tag: `new-order-${order.id}`,
      url: '/',
    }, { category: 'new_orders' })),
  )));
};

const notifyPaymentSecured = (io, order) => {
  if (!io) return;
  notifyAdmins(io);
  io.to(`client_${order.client_id}`).emit('payment_secured', { order_id: order.id });
};

const notifyOrderTaken = (io, orderId) => {
  if (io) io.to('drivers_available').emit('order_taken', { order_id: orderId });
};

const notifyStatus = (io, order, status) => {
  if (!io) return;
  notifyAdmins(io);
  const payload = { order_id: order.id, status };
  io.to(`order_${order.id}`).emit('order_status', payload);
  io.to(`client_${order.client_id}`).emit('order_status', payload);

  const text = CLIENT_PUSH[status];
  if (text && order.client_id) {
    quietly(push.sendToUser(order.client_id, {
      title: text[0],
      body: `${order.order_number ? `${order.order_number} · ` : ''}${text[1]}`,
      tag: `order-${order.id}`,
      url: `/orders/${order.id}`,
    }, { category: 'order_updates', urgent: text[2] }));
  }
  // Commande confirmée par le client : le camionneur est prévenu de son gain
  if (status === 'validated' && order.driver_id) {
    quietly(push.sendToUser(order.driver_id, {
      title: 'Paiement validé',
      body: `${fcfa(order.driver_amount)} pour la course ${order.order_number || ''} : versement sur votre Mobile Money.`.trim(),
      tag: `earning-${order.id}`,
      url: '/courses',
    }, { category: 'earnings' }));
  }
};

module.exports = { notifyNewOrder, notifyPaymentSecured, notifyOrderTaken, notifyStatus, notifyAdmins };
