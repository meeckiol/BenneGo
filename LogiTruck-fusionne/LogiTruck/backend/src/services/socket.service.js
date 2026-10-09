const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { recordPosition, broadcastPosition } = require('./tracking.service');

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
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await query('SELECT id, role, is_active FROM users WHERE id = $1', [decoded.userId]);
      if (!rows.length || !rows[0].is_active) return next(new Error('Compte inactif'));
      socket.userId = rows[0].id;
      socket.userRole = rows[0].role;
      next();
    } catch (err) {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user_${socket.userId}`);
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

    socket.on('disconnect', async () => {
      if (socket.userRole === 'driver') {
        try {
          await query('UPDATE driver_profiles SET is_available = false, updated_at = NOW() WHERE user_id = $1', [socket.userId]);
        } catch (err) {
          console.error('Erreur déconnexion chauffeur:', err);
        }
      }
    });
  });
};

module.exports = { setupSocketIO };
