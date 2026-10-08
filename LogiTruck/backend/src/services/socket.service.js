const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/**
 * Configure Socket.IO pour le tracking temps réel des camions
 */
const setupSocketIO = (io) => {
  // Middleware d'authentification WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Token requis'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Connecté: ${socket.userId} (${socket.userRole})`);

    // Rejoindre la salle personnelle
    socket.join(`user_${socket.userId}`);

    if (socket.userRole === 'client') {
      socket.join(`client_${socket.userId}`);
    }

    if (socket.userRole === 'driver') {
      socket.join(`driver_${socket.userId}`);
    }

    // Chauffeur: se mettre disponible
    socket.on('driver_available', async () => {
      if (socket.userRole !== 'driver') return;
      try {
        await query(
          'UPDATE driver_profiles SET is_available = true, updated_at = NOW() WHERE user_id = $1',
          [socket.userId]
        );
        socket.join('drivers_available');
        socket.emit('availability_updated', { is_available: true });
        console.log(`Chauffeur ${socket.userId} disponible`);
      } catch (err) {
        console.error('Erreur mise à jour disponibilité:', err);
      }
    });

    // Chauffeur: se mettre indisponible
    socket.on('driver_unavailable', async () => {
      if (socket.userRole !== 'driver') return;
      try {
        await query(
          'UPDATE driver_profiles SET is_available = false, updated_at = NOW() WHERE user_id = $1',
          [socket.userId]
        );
        socket.leave('drivers_available');
        socket.emit('availability_updated', { is_available: false });
      } catch (err) {
        console.error('Erreur mise à jour disponibilité:', err);
      }
    });

    // Chauffeur: envoi position GPS
    socket.on('driver_location', async (data) => {
      if (socket.userRole !== 'driver') return;
      const { lat, lng, order_id } = data;

      try {
        // Mettre à jour la position du chauffeur
        await query(
          `UPDATE driver_profiles SET
            current_lat = $1, current_lng = $2,
            last_position_at = NOW(), updated_at = NOW()
           WHERE user_id = $3`,
          [lat, lng, socket.userId]
        );

        // Si en cours de livraison, enregistrer le tracking et notifier le client
        if (order_id) {
          await query(
            'INSERT INTO order_tracking (order_id, driver_id, lat, lng) VALUES ($1, $2, $3, $4)',
            [order_id, socket.userId, lat, lng]
          );

          // Trouver le client et lui envoyer la position
          const orderResult = await query(
            'SELECT client_id FROM orders WHERE id = $1',
            [order_id]
          );

          if (orderResult.rows.length) {
            io.to(`client_${orderResult.rows[0].client_id}`).emit('driver_position', {
              order_id,
              lat,
              lng,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error('Erreur tracking GPS:', err);
      }
    });

    // Client: rejoindre la salle de suivi d'une commande
    socket.on('track_order', (orderId) => {
      socket.join(`order_${orderId}`);
    });

    socket.on('disconnect', async () => {
      console.log(`Déconnecté: ${socket.userId}`);
      if (socket.userRole === 'driver') {
        try {
          await query(
            'UPDATE driver_profiles SET is_available = false, updated_at = NOW() WHERE user_id = $1',
            [socket.userId]
          );
        } catch (err) {
          console.error('Erreur déconnexion chauffeur:', err);
        }
      }
    });
  });
};

module.exports = { setupSocketIO };
