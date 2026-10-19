import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useDriverAuthStore from '../store/authStore';

let socketInstance = null;

// En prod (Vercel) : VITE_SOCKET_URL=https://logitruck-backend.onrender.com
// En dev local    : '/' (même origine, proxy Vite gère /socket.io)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

/**
 * Hook WebSocket pour le chauffeur
 * Gère la connexion, la disponibilité et l'envoi de position GPS
 */
const useDriverSocket = ({ onNewOrder = null, onOrderCancelled = null, onOrderTaken = null } = {}) => {
  const token = useDriverAuthStore((s) => s.token);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    // Créer la connexion Socket.IO
    socketInstance = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('WebSocket connecté');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('WebSocket déconnecté:', reason);
    });

    // Nouvelle commande disponible
    socketInstance.on('new_order', (order) => {
      console.log('Nouvelle commande:', order.order_number);
      if (onNewOrder) onNewOrder(order);
    });

    // Commande annulée par le client
    socketInstance.on('order_cancelled', (data) => {
      if (onOrderCancelled) onOrderCancelled(data);
    });

    // Commande prise par un autre chauffeur
    socketInstance.on('order_taken', (data) => {
      if (onOrderTaken) onOrderTaken(data);
    });

    // Confirmation validation livraison
    socketInstance.on('order_validated', (data) => {
      console.log(`Livraison validée - ${data.driver_amount?.toLocaleString()} FCFA en route`);
    });

    return () => {
      socketInstance?.disconnect();
      socketInstance = null;
      socketRef.current = null;
    };
  }, [token]);

  /**
   * Se mettre disponible pour recevoir des commandes
   */
  const setAvailable = useCallback(() => {
    socketRef.current?.emit('driver_available');
  }, []);

  /**
   * Se mettre indisponible
   */
  const setUnavailable = useCallback(() => {
    socketRef.current?.emit('driver_unavailable');
  }, []);

  /**
   * Envoyer la position GPS au serveur
   * @param {{ lat, lng }} position
   * @param {string|null} orderId - ID de la commande en cours
   */
  const sendLocation = useCallback((position, orderId = null) => {
    socketRef.current?.emit('driver_location', {
      lat: position.lat,
      lng: position.lng,
      order_id: orderId,
    });
  }, []);

  return { setAvailable, setUnavailable, sendLocation };
};

export default useDriverSocket;
