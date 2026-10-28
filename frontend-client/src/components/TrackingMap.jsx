import React, { useEffect, useRef, useState } from 'react';
import LeafletTrackingMap from './LeafletTrackingMap';
import { MAP_OPTIONS, goldPinIcon, hasGoogleMaps, loadGoogleMaps, onGoogleMapsFailure, startDotIcon, truckIcon } from '../../../shared/googleMaps';

const GLIDE_MS = 900;

/**
 * Carte de suivi : chargement, livraison, camion en direct et trajet parcouru.
 * Google Maps avec une clé, sinon la carte OpenStreetMap.
 * `driver` = { lat, lng } (dernière position), `route` = [{lat,lng}, ...]
 */
export default function TrackingMap(props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => onGoogleMapsFailure(() => setFailed(true)), []);
  if (!hasGoogleMaps() || failed) return <LeafletTrackingMap {...props} />;
  return <GoogleTrackingMap {...props} onFail={() => setFailed(true)} />;
}

function GoogleTrackingMap({ pickup, delivery, driver, route = [], onFail }) {
  const el = useRef(null);
  const g = useRef({});
  const frame = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGoogleMaps().then((maps) => {
      if (!alive) return;
      const a = { lat: Number(pickup.lat), lng: Number(pickup.lng) };
      const b = { lat: Number(delivery.lat), lng: Number(delivery.lng) };
      const map = new maps.Map(el.current, { ...MAP_OPTIONS, center: a, zoom: 12, zoomControl: true });
      new maps.Marker({ map, position: a, icon: startDotIcon(maps), title: 'Chargement' });
      new maps.Marker({ map, position: b, icon: goldPinIcon(maps), title: 'Livraison' });
      const line = new maps.Polyline({ map, path: [], strokeColor: '#7a4e14', strokeOpacity: 0.8, strokeWeight: 4 });
      const bounds = new maps.LatLngBounds();
      bounds.extend(a);
      bounds.extend(b);
      map.fitBounds(bounds, 40);
      g.current = { maps, map, line };
      setReady(true);
    }).catch(() => onFail?.());
    return () => { alive = false; cancelAnimationFrame(frame.current); };
  }, [pickup.lat, pickup.lng, delivery.lat, delivery.lng]);

  useEffect(() => {
    if (ready) g.current.line.setPath(route.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })));
  }, [ready, route]);

  // Le camion glisse vers sa nouvelle position GPS, sauf si l'utilisateur réduit les animations
  useEffect(() => {
    if (!ready || !driver) return;
    const { maps, map } = g.current;
    const target = { lat: Number(driver.lat), lng: Number(driver.lng) };
    if (!g.current.truck) {
      g.current.truck = new maps.Marker({ map, position: target, icon: truckIcon(maps), zIndex: 1000, title: 'Camion' });
    } else if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      g.current.truck.setPosition(target);
    } else {
      cancelAnimationFrame(frame.current);
      const from = g.current.truck.getPosition().toJSON();
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / GLIDE_MS);
        const eased = 1 - (1 - t) ** 3;
        g.current.truck.setPosition({ lat: from.lat + (target.lat - from.lat) * eased, lng: from.lng + (target.lng - from.lng) * eased });
        if (t < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    }
    map.panTo(target);
  }, [ready, driver]);

  return <div ref={el} style={{ height: 300, width: '100%', borderRadius: 12, overflow: 'hidden' }} />;
}
