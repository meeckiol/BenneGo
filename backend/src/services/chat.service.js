const { query } = require('../config/database');
const push = require('./push.service');

/**
 * Messagerie client ↔ chauffeur : messages non lus et alerte du destinataire.
 * Une discussion n'est plus affichée une fois la commande terminée ou annulée (les messages restent en base).
 */
const CHAT_CLOSED = ['validated', 'completed', 'cancelled'];

/** Nombre de messages non lus par commande en cours, pour l'utilisateur (client ou chauffeur). */
const unreadFor = async (userId) => {
  const { rows } = await query(
    `SELECT m.order_id, COUNT(*)::int AS unread
     FROM order_chat_messages m
     JOIN orders o ON o.id = m.order_id
     LEFT JOIN order_chat_reads r ON r.order_id = m.order_id AND r.user_id = $1
     WHERE (o.client_id = $1 OR o.driver_id = $1)
       AND o.status <> ALL($2)
       AND m.sender_id <> $1
       AND m.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
     GROUP BY m.order_id`,
    [userId, CHAT_CLOSED]
  );
  return rows;
};

const markRead = (orderId, userId) => query(
  `INSERT INTO order_chat_reads (order_id, user_id, last_read_at) VALUES ($1, $2, NOW())
   ON CONFLICT (order_id, user_id) DO UPDATE SET last_read_at = NOW()`,
  [orderId, userId]
);

/**
 * Prévient l'autre personne de la commande : événement temps réel sur toutes ses pages
 * (pastille, bandeau, son) et notification push si l'application est fermée.
 */
const notifyRecipient = async (io, order, msg) => {
  // Message de l'assistance BenneGo : le client et le chauffeur sont prévenus tous les deux
  const recipients = msg.sender_role === 'admin'
    ? [order.client_id, order.driver_id]
    : [msg.sender_id === order.client_id ? order.driver_id : order.client_id];
  await Promise.all(recipients.filter(Boolean).map((recipientId) => {
    io.to(`user_${recipientId}`).emit('chat_notify', { ...msg, order_number: order.order_number });
    return push.sendToUser(recipientId, {
      title: msg.sender_name || 'Nouveau message',
      body: msg.message.length > 120 ? `${msg.message.slice(0, 117)}…` : msg.message,
      tag: `chat-${msg.order_id}`,
      url: `/messages/${msg.order_id}`,
    });
  }));
};

/** Message de l'assistance BenneGo dans la discussion d'une commande (console admin). */
const postAdminMessage = async (io, orderId, admin, text) => {
  const { rows: orders } = await query('SELECT id, client_id, driver_id, order_number FROM orders WHERE id = $1', [orderId]);
  if (!orders.length) return null;
  const { rows } = await query(
    `INSERT INTO order_chat_messages (order_id, sender_id, sender_name, sender_role, message)
     VALUES ($1, $2, 'Assistance BenneGo', 'admin', $3)
     RETURNING id, order_id, sender_id, sender_name, sender_role, message, created_at`,
    [orderId, admin.id, text]
  );
  const msg = rows[0];
  if (io) {
    io.to(`chat_${orderId}`).emit('chat_message', msg);
    notifyRecipient(io, orders[0], msg).catch((err) => console.error('Erreur alerte message:', err.message));
  }
  return msg;
};

module.exports = { CHAT_CLOSED, unreadFor, markRead, notifyRecipient, postAdminMessage };
