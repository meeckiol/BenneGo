import React, { useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import { addTiles, goldPin, startDot } from './mapStyle';
import 'leaflet/dist/leaflet.css';
import { Navigation } from 'lucide-react';

const GLIDE_MS = 900;

const driverIcon = L.divIcon({
  className: '',
  html: renderToStaticMarkup(
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: '#D9A55B', color: '#0b0b10', boxShadow: '0 2px 6px rgba(0,0,0,.4)' }}>
      <Navigation size={16} fill="currentColor" aria-hidden="true" />
    </span>
  ),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

/**
 * Carte de suivi : point de chargement, point de livraison, position du chauffeur en direct et trajet parcouru.
 * `driver` = { lat, lng } (dernière position), `route` = [{lat,lng}, ...]
 */
export default function LeafletTrackingMap({ pickup, delivery, driver, route = [] }) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  const frame = useRef(0);

  // Déplace le marqueur de sa position actuelle vers la cible, en douceur
  const glideTo = (marker, target) => {
    cancelAnimationFrame(frame.current);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      marker.setLatLng(target);
      return;
    }
    const from = marker.getLatLng();
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / GLIDE_MS);
      const eased = 1 - (1 - t) ** 3;
      marker.setLatLng([from.lat + (target[0] - from.lat) * eased, from.lng + (target[1] - from.lng) * eased]);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: true }).setView([pickup.lat, pickup.lng], 12);
    addTiles(map.current);

    L.marker([pickup.lat, pickup.lng], { icon: startDot, title: 'Chargement', alt: 'Chargement' })
      .bindTooltip('Chargement').addTo(map.current);
    L.marker([delivery.lat, delivery.lng], { icon: goldPin, title: 'Livraison', alt: 'Livraison' })
      .bindTooltip('Livraison').addTo(map.current);
    layers.current.line = L.polyline([], { color: '#7a4e14', weight: 4, opacity: 0.8 }).addTo(map.current);
    map.current.fitBounds([[pickup.lat, pickup.lng], [delivery.lat, delivery.lng]], { padding: [40, 40] });

    return () => { map.current.remove(); map.current = null; layers.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup.lat, pickup.lng, delivery.lat, delivery.lng]);

  useEffect(() => {
    if (!map.current) return;
    layers.current.line?.setLatLngs(route.map((p) => [p.lat, p.lng]));
  }, [route]);

  // Le camion glisse vers sa nouvelle position GPS (courbe douce), sauf si l'utilisateur réduit les animations
  useEffect(() => {
    if (!map.current || !driver) return;
    const target = [driver.lat, driver.lng];
    if (!layers.current.driver) {
      layers.current.driver = L.marker(target, { icon: driverIcon, zIndexOffset: 1000 }).addTo(map.current);
    } else {
      glideTo(layers.current.driver, target);
    }
    map.current.panTo(target, { animate: true });
  }, [driver]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return <div ref={el} style={{ height: 300, width: '100%', borderRadius: 12, overflow: 'hidden' }} />;
}
