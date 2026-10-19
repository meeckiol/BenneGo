import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook de géolocalisation continue pour le tracking chauffeur
 * Utilise l'API Geolocation native du navigateur (Android Chrome)
 */
const useGPS = ({ enabled = false, onPosition = null, interval = 5000 } = {}) => {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const watchIdRef = useRef(null);

  const handleSuccess = useCallback((pos) => {
    const { latitude, longitude, accuracy: acc } = pos.coords;
    const newPosition = { lat: latitude, lng: longitude };
    setPosition(newPosition);
    setAccuracy(Math.round(acc));
    setError(null);
    if (onPosition) onPosition(newPosition);
  }, [onPosition]);

  const handleError = useCallback((err) => {
    const messages = {
      1: 'Accès GPS refusé. Autorisez la localisation dans Chrome.',
      2: 'Position GPS indisponible. Vérifiez que le GPS est activé.',
      3: 'Délai GPS dépassé. Réessayez.',
    };
    setError(messages[err.code] || 'Erreur GPS inconnue');
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setError('GPS non supporté par ce navigateur');
      return;
    }

    // Obtenir la position immédiatement
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    // Surveiller la position en continu
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: interval,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, handleSuccess, handleError, interval]);

  const getPositionOnce = useCallback(() => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        reject,
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  return { position, error, accuracy, getPositionOnce };
};

export default useGPS;
