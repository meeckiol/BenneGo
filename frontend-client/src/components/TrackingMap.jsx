import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const truckIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:30px;line-height:30px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">🚚</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/**
 * Carte de suivi : point de chargement, point de livraison, camion en direct et trajet parcouru.
 * `driver` = { lat, lng } (dernière position), `route` = [{lat,lng}, ...]
 */
export default function TrackingMap({ pickup, delivery, driver, route = [] }) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef({});

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: true }).setView([pickup.lat, pickup.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map.current);

    L.circleMarker([pickup.lat, pickup.lng], { radius: 9, color: '#1565C0', fillColor: '#2196F3', fillOpacity: 0.9 })
      .bindTooltip('Chargement').addTo(map.current);
    L.circleMarker([delivery.lat, delivery.lng], { radius: 9, color: '#2E7D32', fillColor: '#4CAF50', fillOpacity: 0.9 })
      .bindTooltip('Livraison').addTo(map.current);
    layers.current.line = L.polyline([], { color: '#FF6B00', weight: 4, opacity: 0.8 }).addTo(map.current);
    map.current.fitBounds([[pickup.lat, pickup.lng], [delivery.lat, delivery.lng]], { padding: [40, 40] });

    return () => { map.current.remove(); map.current = null; layers.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup.lat, pickup.lng, delivery.lat, delivery.lng]);

  useEffect(() => {
    if (!map.current) return;
    const pts = route.map((p) => [p.lat, p.lng]);
    layers.current.line?.setLatLngs(pts);
    if (driver) {
      const pos = [driver.lat, driver.lng];
      if (!layers.current.truck) layers.current.truck = L.marker(pos, { icon: truckIcon, zIndexOffset: 1000 }).addTo(map.current);
      else layers.current.truck.setLatLng(pos);
      map.current.panTo(pos, { animate: true });
    }
  }, [driver, route]);

  return <div ref={el} style={{ height: 300, width: '100%', borderRadius: 12, overflow: 'hidden' }} />;
}
