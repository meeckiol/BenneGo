import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useDriverAuthStore from '../store/authStore';

let socketInstance = null;

// En production : VITE_SOCKET_URL configurable (ex: https://api.bennego.com)
// En dev local  : '/' (proxy Vite vers le backend local)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

/**
 * Hook WebSocket pour le chauffeur
 * Gère la connexion, la disponibilité et l'envoi de position GPS
 */
const useDriverSocket = ({
  onNewOrder = null,
  onOrderCancelled = null,
  onOrderTaken = null,
  onOrderReassigned = null,
  onDisputeOpened = null,
} = {}) => {
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

    // Nouvelle commande disponible
    socketInstance.on('new_order', (order) => {
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
    // Course réassignée à ce chauffeur, ou retirée à ce chauffeur, après une panne
    socketInstance.on('order_reassigned', (data) => {
      if (onOrderReassigned) onOrderReassigned(data);
    });

    // Le client a refusé la livraison d'une course de ce chauffeur
    socketInstance.on('dispute_opened', (data) => {
      if (onDisputeOpened) onDisputeOpened(data);
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
