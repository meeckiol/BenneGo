import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Intervalle entre deux positions envoyées au serveur pendant le tracking automatique (ms).
 * 60 s est un bon équilibre : le client voit le camion se déplacer sans vider la batterie.
 */
const WATCH_INTERVAL_MS = 60_000;

/**
 * Distance minimale (mètres) pour déclencher une mise à jour de position automatique.
 * Un camion se déplace à ~50 km/h → 833 m/min. 200 m = ~15 s de déplacement, cohérent.
 */
const WATCH_DISTANCE_M = 200;

/** Délai minimal entre deux envois de position manuels (ms). */
const SHARE_THROTTLE_MS = 15_000;

type LocationState = "idle" | "requesting" | "ready" | "sharing" | "shared" | "denied" | "error";

type RecordLocation = (jobId: string, latitude: number, longitude: number) => Promise<unknown>;

/**
 * Hook de localisation chauffeur.
 *
 * - `shareCurrentLocation(jobId)` : envoi manuel ponctuel (bouton "Partager ma position"),
 *   throttlé à 15 s pour éviter le spam.
 * - `startTracking(jobId)` / `stopTracking()` : tracking automatique en background.
 *   S'active dès que la mission est dans un statut tracké (accepted → driver_en_route_delivery).
 *   Envoie une position toutes les ~60 s ou tous les ~200 m, même écran verrouillé.
 */
export function useDriverLocation(recordLocation: RecordLocation) {
  const [state, setState] = useState<LocationState>("idle");
  const [message, setMessage] = useState("La position est partagée uniquement pendant une mission active.");

  // Throttle pour le partage manuel
  const lastShareRef = useRef<number>(0);
  // Référence au subscriber watchPositionAsync pour pouvoir l'arrêter proprement
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  // jobId courant pendant le tracking (pour éviter une closure périmée dans le callback)
  const trackedJobIdRef = useRef<string | null>(null);

  // Nettoyage au démontage du hook
  useEffect(() => {
    return () => {
      watchSubscriptionRef.current?.remove();
      watchSubscriptionRef.current = null;
    };
  }, []);

  // ─── Permissions ────────────────────────────────────────────────────────────

  const requestForegroundAccess = useCallback(async () => {
    setState("requesting");
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      setState("denied");
      setMessage("Localisation refusée. Activez-la dans les réglages pour vous mettre en ligne.");
      return false;
    }
    setState("ready");
    setMessage("Localisation de premier plan autorisée.");
    return true;
  }, []);

  /**
   * Demande la permission background si elle n'est pas encore accordée.
   * Sur Android 10+ l'utilisateur doit choisir "Toujours autoriser" dans les réglages.
   * On ne bloque pas le tracking en foreground si la permission background est refusée :
   * on se rabat sur foreground only (écran éteint → pause du suivi).
   */
  const ensureBackgroundPermission = useCallback(async (): Promise<boolean> => {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") {
      const granted = await requestForegroundAccess();
      if (!granted) return false;
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status === "granted") return true;
    const result = await Location.requestBackgroundPermissionsAsync();
    return result.status === "granted";
  }, [requestForegroundAccess]);

  // ─── Tracking automatique ────────────────────────────────────────────────────

  /**
   * Démarre le tracking GPS automatique pour une mission donnée.
   * Appeler uniquement quand `isTrackedJobStatus(job.status)` est vrai.
   * Sans-effet si un tracking est déjà actif pour le même jobId.
   */
  const startTracking = useCallback(
    async (jobId: string) => {
      // Déjà en train de tracker ce job → ne rien faire
      if (watchSubscriptionRef.current && trackedJobIdRef.current === jobId) return;

      // Stopper un éventuel tracking précédent (changement de job)
      watchSubscriptionRef.current?.remove();
      watchSubscriptionRef.current = null;

      const hasBg = await ensureBackgroundPermission();

      setState("sharing");
      setMessage(
        hasBg
          ? "Suivi GPS automatique actif (arrière-plan inclus)."
          : "Suivi GPS actif (premier plan uniquement — écran éteint = pause).",
      );
      trackedJobIdRef.current = jobId;

      try {
        const subscription = await Location.watchPositionAsync(
          {
            // Accuracy.Low (~1 km) : largement suffisant pour un camion et très économe en batterie.
            accuracy: Location.Accuracy.Low,
            timeInterval: WATCH_INTERVAL_MS,
            distanceInterval: WATCH_DISTANCE_M,
            // mayShowUserSettingsDialog permet à Expo de proposer d'activer le GPS si désactivé
            mayShowUserSettingsDialog: true,
          },
          async (location) => {
            const currentJobId = trackedJobIdRef.current;
            if (!currentJobId) return;
            try {
              await recordLocation(
                currentJobId,
                location.coords.latitude,
                location.coords.longitude,
              );
              setState("shared");
              setMessage(
                `Position mise à jour · ±${Math.round(location.coords.accuracy ?? 0)} m`,
              );
            } catch {
              // Erreur réseau ponctuelle : on continue le tracking, on ne coupe pas
              setMessage("Envoi position échoué — nouvelle tentative à la prochaine mise à jour.");
            }
          },
        );

        watchSubscriptionRef.current = subscription;
      } catch {
        setState("error");
        setMessage("Impossible de démarrer le suivi GPS. Vérifiez vos réglages de localisation.");
        trackedJobIdRef.current = null;
      }
    },
    [ensureBackgroundPermission, recordLocation],
  );

  /**
   * Arrête le tracking automatique.
   * À appeler quand le chauffeur passe en statut "delivered" (fin du suivi).
   */
  const stopTracking = useCallback(() => {
    watchSubscriptionRef.current?.remove();
    watchSubscriptionRef.current = null;
    trackedJobIdRef.current = null;
    setState("ready");
    setMessage("Suivi GPS terminé.");
  }, []);

  // ─── Partage manuel ponctuel ─────────────────────────────────────────────────

  /**
   * Envoi ponctuel de la position (bouton "Partager ma position").
   * Throttlé à 15 s. Si le tracking automatique est actif, ce bouton reste disponible
   * pour forcer une mise à jour immédiate.
   */
  const shareCurrentLocation = useCallback(
    async (jobId: string) => {
      const now = Date.now();
      if (now - lastShareRef.current < SHARE_THROTTLE_MS) {
        setMessage("Position déjà envoyée récemment. Réessayez dans quelques secondes.");
        return false;
      }

      const permission = await Location.getForegroundPermissionsAsync();
      const granted = permission.status === "granted" || (await requestForegroundAccess());
      if (!granted) return false;

      try {
        setState("sharing");
        setMessage("Position en cours d'envoi…");
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });
        await recordLocation(jobId, current.coords.latitude, current.coords.longitude);
        lastShareRef.current = Date.now();
        setState("shared");
        setMessage(`Position partagée · ±${Math.round(current.coords.accuracy ?? 0)} m`);
        return true;
      } catch {
        setState("error");
        setMessage("Position indisponible. Vérifiez le GPS et réessayez.");
        return false;
      }
    },
    [recordLocation, requestForegroundAccess],
  );

  return {
    state,
    message,
    requestForegroundAccess,
    shareCurrentLocation,
    startTracking,
    stopTracking,
    isTracking: watchSubscriptionRef.current !== null,
  };
}
