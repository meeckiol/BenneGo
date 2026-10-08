import * as Location from "expo-location";
import { useCallback, useState } from "react";

type LocationState = "idle" | "requesting" | "ready" | "sharing" | "shared" | "denied" | "error";

type RecordLocation = (jobId: number, latitude: number, longitude: number) => Promise<unknown>;

export function useDriverLocation(recordLocation: RecordLocation) {
  const [state, setState] = useState<LocationState>("idle");
  const [message, setMessage] = useState("La position est partagée uniquement pendant une mission active.");

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

  const shareCurrentLocation = useCallback(
    async (jobId: number) => {
      const permission = await Location.getForegroundPermissionsAsync();
      const granted = permission.status === "granted" || (await requestForegroundAccess());
      if (!granted) return false;
      try {
        setState("sharing");
        setMessage("Position en cours d’envoi…");
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await recordLocation(jobId, current.coords.latitude, current.coords.longitude);
        setState("shared");
        setMessage(`Position partagée · précision ±${Math.round(current.coords.accuracy ?? 0)} m`);
        return true;
      } catch {
        setState("error");
        setMessage("Position indisponible. Vérifiez le GPS et réessayez.");
        return false;
      }
    },
    [recordLocation, requestForegroundAccess],
  );

  return { state, message, requestForegroundAccess, shareCurrentLocation };
}
