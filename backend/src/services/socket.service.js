const { query } = require('../config/database');
const { recordPosition, broadcastPosition } = require('./tracking.service');
const { notifyRecipient } = require('./chat.service');
const { verifyToken } = require('./session.service');

/**
 * Socket.IO : suivi temps réel des camions.
 * Rooms : user_<id>, client_<id>, driver_<id>, drivers_available, order_<id>
 */
const setupSocketIO = (io) => {
  // Authentification : token valide ET compte toujours actif (un compte désactivé perd son canal)
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token requis'));
    try {
      // Mêmes contrôles que l'API : compte actif, suppression non demandée, appareil non déconnecté
      const user = await verifyToken(token);
      socket.userId = user.id;
      socket.userName = user.full_name;
      socket.userRole = user.role;
      socket.sessionId = user.sessionId;
      next();
    } catch (err) {
      next(new Error(err.status === 401 ? err.message : 'Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user_${socket.userId}`);
    // Appareil déconnecté depuis les réglages : ses connexions temps réel sont coupées via cette room
    if (socket.sessionId) socket.join(`session_${socket.sessionId}`);
    if (socket.userRole === 'client') socket.join(`client_${socket.userId}`);
    if (socket.userRole === 'driver') socket.join(`driver_${socket.userId}`);

    // Chauffeur : se mettre disponible (reçoit les nouvelles commandes payées)
    socket.on('driver_available', async () => {
      if (socket.userRole !== 'driver') return;
      try {
        const { rowCount } = await query(
          `UPDATE driver_profiles SET is_available = true, updated_at = NOW()
           WHERE user_id = $1 AND momo_number IS NOT NULL`,
          [socket.userId]
        );
        if (!rowCount) return socket.emit('error_message', { error: 'Profil chauffeur ou numéro Mobile Money manquant' });
        socket.join('drivers_available');
        socket.emit('availability_updated', { is_available: true });
      } catch (err) {
        console.error('Erreur mise à jour disponibilité:', err);
      }
    });

    socket.on('driver_unavailable', async () => {
      if (socket.userRole !== 'driver') return;
      try {
        await query('UPDATE driver_profiles SET is_available = false, updated_at = NOW() WHERE user_id = $1', [socket.userId]);
        socket.leave('drivers_available');
        socket.emit('availability_updated', { is_available: false });
      } catch (err) {
        console.error('Erreur mise à jour disponibilité:', err);
      }
    });

    // Chauffeur : envoi de sa position (validée : bornes + course active lui appartenant)
    socket.on('driver_location', async (data) => {
      if (socket.userRole !== 'driver') return;
      try {
        const recorded = await recordPosition(socket.userId, data || {});
        if (recorded) broadcastPosition(io, recorded);
      } catch (err) {
        socket.emit('error_message', { error: err.message });
      }
    });

    // Client : suivre une commande — uniquement la sienne (ou admin)
    socket.on('track_order', async (orderId) => {
      try {
        const { rows } = await query('SELECT client_id, driver_id FROM orders WHERE id = $1', [orderId]);
        const order = rows[0];
        const allowed = order && (
          socket.userRole === 'admin'
          || (socket.userRole === 'client' && order.client_id === socket.userId)
          || (socket.userRole === 'driver' && order.driver_id === socket.userId)
        );
        if (!allowed) return socket.emit('error_message', { error: 'Accès refusé à cette commande' });
        socket.join(`order_${orderId}`);
        socket.emit('tracking_started', { order_id: orderId });
      } catch (err) {
        socket.emit('error_message', { error: 'Suivi indisponible' });
      }
    });

    // =============================================
    // CHAT TEMPS RÉEL (Socket.IO Room chat_<orderId>)
    // =============================================

    // Rejoindre la room de chat d'une commande
    socket.on('chat_join', async (data) => {
      const orderId = data?.order_id || data;
      if (!orderId) return;
      try {
        const { rows } = await query('SELECT client_id, driver_id FROM orders WHERE id = $1', [orderId]);
        const order = rows[0];
        const allowed = order && (
          socket.userRole === 'admin'
          || (socket.userRole === 'client' && order.client_id === socket.userId)
          || (socket.userRole === 'driver' && order.driver_id === socket.userId)
        );
        if (!allowed) return socket.emit('error_message', { error: 'Accès refusé au chat de cette commande' });
        socket.join(`chat_${orderId}`);
        socket.emit('chat_joined', { order_id: orderId });
      } catch (err) {
        socket.emit('error_message', { error: 'Erreur connexion chat' });
      }
    });

    // Envoyer un message dans le chat
    socket.on('chat_message', async (data) => {
      const { order_id, message } = data || {};
      if (!order_id || !message || typeof message !== 'string') return;
      const trimmed = message.trim().slice(0, 1000);
      if (!trimmed) return;
      try {
        const { rows: orderRows } = await query('SELECT client_id, driver_id, order_number FROM orders WHERE id = $1', [order_id]);
        const order = orderRows[0];
        const allowed = order && (
          socket.userRole === 'admin'
          || (socket.userRole === 'client' && order.client_id === socket.userId)
          || (socket.userRole === 'driver' && order.driver_id === socket.userId)
        );
        if (!allowed) return socket.emit('error_message', { error: 'Accès refusé au chat de cette commande' });

        const { rows: msgRows } = await query(
          `INSERT INTO order_chat_messages (order_id, sender_id, sender_name, sender_role, message)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, order_id, sender_id, sender_name, sender_role, message, created_at`,
          [order_id, socket.userId, socket.userName || 'Utilisateur', socket.userRole, trimmed]
        );

        const savedMsg = msgRows[0];
        io.to(`chat_${order_id}`).emit('chat_message', savedMsg);
        // L'autre personne est prévenue où qu'elle soit dans l'application, ou par notification push
        notifyRecipient(io, order, savedMsg).catch((err) => console.error('Erreur alerte message:', err.message));
      } catch (err) {
        socket.emit('error_message', { error: 'Erreur envoi message chat' });
      }
    });

    // Récupérer l'historique du chat
    socket.on('chat_history', async (data) => {
      const orderId = data?.order_id || data;
      if (!orderId) return;
      try {
        const { rows: orderRows } = await query('SELECT client_id, driver_id FROM orders WHERE id = $1', [orderId]);
        const order = orderRows[0];
        const allowed = order && (
          socket.userRole === 'admin'
          || (socket.userRole === 'client' && order.client_id === socket.userId)
          || (socket.userRole === 'driver' && order.driver_id === socket.userId)
        );
        if (!allowed) return socket.emit('error_message', { error: 'Accès refusé au chat de cette commande' });
        const { rows } = await query(
          `SELECT id, order_id, sender_id, sender_name, sender_role, message, created_at
           FROM order_chat_messages
           WHERE order_id = $1
           ORDER BY created_at ASC
           LIMIT 50`,
          [orderId]
        );
        socket.emit('chat_history', { order_id: orderId, messages: rows });
      } catch (err) {
        socket.emit('error_message', { error: 'Erreur historique chat' });
      }
    });

    socket.on('disconnect', async () => {
      if (socket.userRole === 'driver') {
        try {
          // Un autre onglet ou appareil du chauffeur reste connecté : il garde sa disponibilité
          const others = await io.in(`driver_${socket.userId}`).fetchSockets();
          if (others.length) return;
          await query('UPDATE driver_profiles SET is_available = false, updated_at = NOW() WHERE user_id = $1', [socket.userId]);
        } catch (err) {
          console.error('Erreur déconnexion chauffeur:', err);
        }
      }
    });
  });
};

module.exports = { setupSocketIO };
