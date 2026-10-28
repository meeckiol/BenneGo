import { useEffect, useRef, useCallback } from 'react';
import useDriverAuthStore from '../store/authStore';
import { getSocket } from '../services/socket';

/**
 * Écoute des événements chauffeur sur la connexion partagée (nouvelles courses, annulations…)
 * et envoi de la disponibilité et de la position. Quitter une page ne coupe pas la connexion.
 */
const useDriverSocket = ({
  onNewOrder = null,
  onOrderCancelled = null,
  onOrderTaken = null,
  onOrderReassigned = null,
  onDisputeOpened = null,
  onConnect = null,
} = {}) => {
  const token = useDriverAuthStore((s) => s.token);
  // Dernières fonctions reçues, sans réabonner les écouteurs à chaque rendu
  const handlers = useRef({});
  handlers.current = { onNewOrder, onOrderCancelled, onOrderTaken, onOrderReassigned, onDisputeOpened, onConnect };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const bind = {
      new_order: (d) => handlers.current.onNewOrder?.(d),
      order_cancelled: (d) => handlers.current.onOrderCancelled?.(d),
      order_taken: (d) => handlers.current.onOrderTaken?.(d),
      // Course réassignée à ce chauffeur, ou retirée à ce chauffeur, après une panne
      order_reassigned: (d) => handlers.current.onOrderReassigned?.(d),
      // Le client a refusé la livraison d'une course de ce chauffeur
      dispute_opened: (d) => handlers.current.onDisputeOpened?.(d),
      connect: () => handlers.current.onConnect?.(),
    };
    Object.entries(bind).forEach(([ev, fn]) => socket.on(ev, fn));
    return () => Object.entries(bind).forEach(([ev, fn]) => socket.off(ev, fn));
  }, [token]);

  const setAvailable = useCallback(() => getSocket()?.emit('driver_available'), []);
  const setUnavailable = useCallback(() => getSocket()?.emit('driver_unavailable'), []);

  /** Position GPS envoyée au serveur, avec la course en cours si le client suit le camion. */
  const sendLocation = useCallback((position, orderId = null) => {
    getSocket()?.emit('driver_location', { lat: position.lat, lng: position.lng, order_id: orderId });
  }, []);

  return { setAvailable, setUnavailable, sendLocation };
};

export default useDriverSocket;
