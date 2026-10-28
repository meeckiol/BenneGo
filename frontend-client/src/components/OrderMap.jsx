import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addTiles, goldPin, startDot } from './mapStyle';

const asLatLng = (p) => [Number(p.lat), Number(p.lng)];

/**
 * Carte plein écran de la commande (design C) : départ, arrivée et trajet en pointillés or.
 * Le point modifiable (`editable` : 'pickup' ou 'delivery') se place d'un toucher ou se déplace.
 */
export default function OrderMap({ pickup, delivery, showPickup = true, editable = 'delivery', onChange }) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editableRef = useRef(editable);
  editableRef.current = editable;

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(asLatLng(delivery), 12);
    addTiles(map.current);

    const l = layers.current;
    l.route = L.polyline([asLatLng(pickup), asLatLng(delivery)], { color: '#f6a906', weight: 5, dashArray: '2 10', lineCap: 'round' }).addTo(map.current);
    l.pickup = L.marker(asLatLng(pickup), { icon: startDot, title: 'Départ', alt: 'Départ', draggable: true }).addTo(map.current);
    l.delivery = L.marker(asLatLng(delivery), { icon: goldPin, title: 'Arrivée', alt: 'Arrivée', draggable: true }).addTo(map.current);

    const emit = (which, latlng) => onChangeRef.current?.(which, { lat: latlng.lat, lng: latlng.lng });
    map.current.on('click', (e) => emit(editableRef.current, e.latlng));
    l.pickup.on('dragend', () => emit('pickup', l.pickup.getLatLng()));
    l.delivery.on('dragend', () => emit('delivery', l.delivery.getLatLng()));

    return () => { map.current.remove(); map.current = null; };
  }, []);

  // Les repères et le trajet suivent le formulaire ; la vue cadre les deux points
  useEffect(() => {
    const l = layers.current;
    if (!map.current) return;
    const a = asLatLng(pickup);
    const b = asLatLng(delivery);
    if (![...a, ...b].every(Number.isFinite)) return;
    l.pickup.setLatLng(a);
    l.delivery.setLatLng(b);
    l.route.setLatLngs(showPickup ? [a, b] : []);
    if (showPickup) {
      if (!map.current.hasLayer(l.pickup)) l.pickup.addTo(map.current);
      map.current.fitBounds(L.latLngBounds([a, b]), { paddingTopLeft: [40, 110], paddingBottomRight: [40, 60], maxZoom: 14 });
    } else {
      l.pickup.remove();
      map.current.setView(b, 13);
    }
  }, [pickup.lat, pickup.lng, delivery.lat, delivery.lng, showPickup]);

  return <div ref={el} className="bn-order__mapcanvas" role="application" aria-label="Carte de la commande : départ et arrivée" />;
}
