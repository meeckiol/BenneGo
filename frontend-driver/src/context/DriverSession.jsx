import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import useGPS from '../hooks/useGPS';
import useDriverSocket from '../hooks/useDriverSocket';
import useDriverAuthStore from '../store/authStore';
import { getSocket } from '../services/socket';
import NewOrderAlert from '../components/NewOrderAlert';

/*
 * Session du camionneur, valable sur tous les onglets : disponibilité, position GPS,
 * course en cours et alerte des nouvelles courses. Changer d'onglet ne le met plus hors ligne.
 */
const DriverSessionContext = createContext(null);
export const useDriverSession = () => useContext(DriverSessionContext);

export const ACTIVE_STATUSES = ['accepted', 'driver_en_route_pickup', 'loading', 'driver_en_route_delivery', 'machine_operating', 'delivered'];
// Pendant ces étapes, le client suit le camion sur la carte
const TRACKED_STATUSES = ['accepted', 'driver_en_route_pickup', 'loading', 'driver_en_route_delivery', 'machine_operating'];
const ONLINE_KEY = 'bennego-driver-en-ligne';

const readOnline = () => {
  try { return localStorage.getItem(ONLINE_KEY) === '1'; } catch { return false; }
};
const saveOnline = (on) => {
  try { localStorage.setItem(ONLINE_KEY, on ? '1' : '0'); } catch { /* stockage indisponible */ }
};

export function DriverSessionProvider({ children }) {
  const navigate = useNavigate();
  const user = useDriverAuthStore((s) => s.user);
  const [isAvailable, setIsAvailable] = useState(readOnline);
  const [toggling, setToggling] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);

  const onlineRef = useRef(isAvailable);
  onlineRef.current = isAvailable;
  const activeRef = useRef(activeOrder);
  activeRef.current = activeOrder;

  const goOnline = (on) => {
    setIsAvailable(on);
    saveOnline(on);
  };

  const reloadActive = useCallback(async () => {
    try {
      const { data } = await api.get('/orders?limit=50');
      setActiveOrder(data.orders.find((o) => o.driver_id === user?.id && ACTIVE_STATUSES.includes(o.status)) || null);
    } catch { /* réseau indisponible : on garde l'état connu */ }
  }, [user?.id]);

  const { setAvailable, setUnavailable, sendLocation } = useDriverSocket({
    onNewOrder: (order) => {
      if (onlineRef.current && !activeRef.current) setPendingOrder(order);
    },
    onOrderCancelled: () => {
      setActiveOrder(null);
      toast('Commande annulée par le client');
    },
    onOrderTaken: (d) => setPendingOrder((cur) => (cur && cur.order_id === d.order_id ? null : cur)),
    onOrderReassigned: () => reloadActive(),
    onDisputeOpened: () => reloadActive(),
    // À chaque (re)connexion, le serveur doit retrouver la disponibilité choisie
    onConnect: () => { if (onlineRef.current) setAvailable(); },
  });

  useEffect(() => { reloadActive(); }, [reloadActive]);

  // Connexion déjà ouverte au chargement : la disponibilité est redemandée tout de suite
  useEffect(() => {
    if (onlineRef.current && getSocket()?.connected) setAvailable();
  }, []);

  const tracked = activeOrder && TRACKED_STATUSES.includes(activeOrder.status);
  const gps = useGPS({
    enabled: isAvailable || !!activeOrder,
    onPosition: useCallback((pos) => {
      sendLocation(pos, tracked ? activeOrder.id : null);
    }, [sendLocation, tracked, activeOrder?.id]),
    interval: 5000,
  });

  const toggleAvailability = () => {
    if (isAvailable) {
      setUnavailable();
      goOnline(false);
      toast('Mode hors ligne activé');
      return;
    }
    const on = () => {
      setAvailable();
      goOnline(true);
      toast.success('Vous êtes en ligne ! En attente de courses…');
    };
    if (!navigator.geolocation) return on();
    setToggling(true);
    navigator.geolocation.getCurrentPosition(
      () => { setToggling(false); on(); },
      () => { setToggling(false); toast.error('Activez le GPS pour vous mettre disponible'); },
      { timeout: 15000 },
    );
    return undefined;
  };

  const acceptOrder = async (order) => {
    try {
      await api.patch(`/orders/${order.order_id}/accept`);
      setPendingOrder(null);
      goOnline(false);
      await reloadActive();
      toast.success('Course acceptée ! Direction la carrière.');
      navigate(`/order/${order.order_id}`);
    } catch {
      setPendingOrder(null);
    }
  };

  const refuseOrder = useCallback(() => {
    setPendingOrder(null);
    toast('Course ignorée');
  }, []);

  const value = {
    isAvailable, toggling, toggleAvailability,
    activeOrder, reloadActive,
    position: gps.position, gpsError: gps.error, accuracy: gps.accuracy,
  };

  return (
    <DriverSessionContext.Provider value={value}>
      {children}
      {pendingOrder && (
        <NewOrderAlert
          order={pendingOrder}
          onAccept={() => acceptOrder(pendingOrder)}
          onRefuse={refuseOrder}
          timeoutSeconds={30}
        />
      )}
    </DriverSessionContext.Provider>
  );
}
