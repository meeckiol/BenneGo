import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/session";

/**
 * Événements Socket.IO émis par le backend BenneGo.
 * Documentés dans backend/src/services/order-events.js
 */
interface ServerToClientEvents {
  /** Une nouvelle commande payée est disponible pour les chauffeurs en ligne. */
  new_order: (data: { order_id: string; order_number: string }) => void;
  /** Une commande vient d'être acceptée par un autre chauffeur. */
  order_taken: (data: { order_id: string }) => void;
  /** Le statut d'une commande a changé (confirmation client, avancement chauffeur). */
  order_status: (data: { order_id: string; status: string }) => void;
  /** Mise à jour de disponibilité confirmée par le serveur. */
  availability_updated: (data: { is_available: boolean }) => void;
  /** Erreur envoyée par le serveur (ex. profil incomplet). */
  error_message: (data: { error: string }) => void;
}

interface ClientToServerEvents {
  driver_available: () => void;
  driver_unavailable: () => void;
  track_order: (orderId: string) => void;
}

type LogiSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Hook Socket.IO chauffeur.
 *
 * - Se connecte au backend avec le token JWT du chauffeur.
 * - Rejoint automatiquement la room `drivers_available` si `isAvailable` est vrai.
 * - Invalide les queries React Query appropriées à chaque événement reçu,
 *   ce qui supprime le besoin de polling HTTP pour les offres disponibles.
 * - Se déconnecte proprement au démontage ou à la déconnexion (logout).
 *
 * @param isAuthenticated - Faux avant login ou après logout : empêche toute connexion.
 * @param isAvailable - Si vrai, rejoint `drivers_available` pour recevoir les nouvelles offres.
 */
export function useSocket(isAuthenticated: boolean, isAvailable: boolean) {
  const qc = useQueryClient();
  const socketRef = useRef<LogiSocket | null>(null);
  // On garde isAvailable dans un ref pour pouvoir l'utiliser dans les callbacks sans recréer le socket
  const isAvailableRef = useRef(isAvailable);
  useEffect(() => { isAvailableRef.current = isAvailable; }, [isAvailable]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Déconnexion propre si le chauffeur se déconnecte
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    // Éviter une double connexion (StrictMode React / Fast Refresh)
    if (socketRef.current?.connected) return;

    let socket: LogiSocket;

    const connect = async () => {
      const token = await getToken();
      if (!token) return;

      socket = io(API_URL, {
        auth: { token },
        // Transports : websocket en priorité, long-polling en fallback
        transports: ["websocket", "polling"],
        // Reconnexion automatique avec backoff exponentiel
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 30_000,
        randomizationFactor: 0.5,
        // Timeout de connexion initiale
        timeout: 10_000,
      }) as LogiSocket;

      socketRef.current = socket;

      // ─── Connexion établie ───────────────────────────────────────────────
      socket.on("connect", () => {
        // Se déclarer disponible si c'est le cas au moment de la connexion
        if (isAvailableRef.current) {
          socket.emit("driver_available");
        }
      });

      // ─── Nouvelle commande disponible ────────────────────────────────────
      // Remplace le refetchInterval:15s de useJobs("offered")
      socket.on("new_order", () => {
        void qc.invalidateQueries({ queryKey: ["jobs", "offered"] });
      });

      // ─── Commande prise par un autre chauffeur ───────────────────────────
      socket.on("order_taken", () => {
        void qc.invalidateQueries({ queryKey: ["jobs", "offered"] });
      });

      // ─── Changement de statut d'une commande ────────────────────────────
      // Couvre la confirmation de réception par le client (delivered → validated)
      // que le chauffeur ne peut pas déclencher lui-même.
      socket.on("order_status", ({ order_id }) => {
        // Invalider la mission spécifique + le dashboard (activeJob, métriques)
        void qc.invalidateQueries({ queryKey: ["job", order_id] });
        void qc.invalidateQueries({ queryKey: ["dashboard"] });
        void qc.invalidateQueries({ queryKey: ["jobs", "active"] });
      });
    };

    void connect();

    return () => {
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, qc]);

  // ─── Synchronisation disponibilité ──────────────────────────────────────────
  // Quand isAvailable change APRÈS la connexion initiale, on notifie le serveur
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    if (isAvailable) {
      socket.emit("driver_available");
    } else {
      socket.emit("driver_unavailable");
    }
  }, [isAvailable]);

  /**
   * Démarre le suivi temps réel d'une commande spécifique.
   * À appeler quand le chauffeur ouvre l'écran de mission.
   */
  const trackOrder = (orderId: string) => {
    socketRef.current?.emit("track_order", orderId);
  };

  return { trackOrder };
}
