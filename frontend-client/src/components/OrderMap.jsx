import React, { useEffect, useRef, useState } from 'react';
import LeafletOrderMap from './LeafletOrderMap';
import {
  MAP_OPTIONS, dashedRoute, goldPinIcon, hasGoogleMaps, loadGoogleMaps, onGoogleMapsFailure, placeNameAt, startDotIcon,
} from '../../../shared/googleMaps';
import '../styles/gmap.css';

const asLatLng = (p) => ({ lat: Number(p.lat), lng: Number(p.lng) });
const valid = (p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

/**
 * Carte plein écran de la commande. Avec une clé Google : fond Google Maps (comme Gozem),
 * étiquette du lieu au-dessus du repère et nom renvoyé au formulaire. Sinon : carte OpenStreetMap.
 * Le point modifiable (`editable` : 'pickup' ou 'delivery') se place d'un toucher ou se déplace.
 * `onChange(which, { lat, lng, name })` : `name` arrive ensuite, une fois le lieu identifié.
 */
export default function OrderMap(props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => onGoogleMapsFailure(() => setFailed(true)), []);
  if (!hasGoogleMaps() || failed) return <LeafletOrderMap {...props} />;
  return <GoogleOrderMap {...props} onFail={() => setFailed(true)} />;
}

function GoogleOrderMap({ pickup, delivery, showPickup = true, editable = 'delivery', onChange, onFail }) {
  const el = useRef(null);
  const g = useRef({});
  const [ready, setReady] = useState(false);
  const [label, setLabel] = useState(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editableRef = useRef(editable);
  editableRef.current = editable;

  // Nom du lieu sous le repère modifiable (« Restaurant Vignoble »), affiché dans l'étiquette
  const nameSeq = useRef(0);
  const identify = async (which, latLng) => {
    const seq = ++nameSeq.current;
    try {
      const name = await placeNameAt(g.current.maps, latLng);
      if (seq !== nameSeq.current || !name) return;
      if (which === editableRef.current) setLabel(name);
      onChangeRef.current?.(which, { ...latLng, name });
    } catch { /* géocodage indisponible : le point reste placé sans nom */ }
  };

  useEffect(() => {
    let alive = true;
    loadGoogleMaps().then((maps) => {
      if (!alive) return;
      const map = new maps.Map(el.current, { ...MAP_OPTIONS, center: asLatLng(delivery), zoom: 14 });
      const pickupMarker = new maps.Marker({ map, position: asLatLng(pickup), icon: startDotIcon(maps), draggable: true, title: 'Départ' });
      const deliveryMarker = new maps.Marker({ map, position: asLatLng(delivery), icon: goldPinIcon(maps), draggable: true, title: 'Arrivée' });
      const route = new maps.Polyline({ map, path: [asLatLng(pickup), asLatLng(delivery)], ...dashedRoute(maps) });
      g.current = { maps, map, pickupMarker, deliveryMarker, route };

      const place = (which, latLng) => {
        onChangeRef.current?.(which, latLng);
        identify(which, latLng);
      };
      map.addListener('click', (e) => place(editableRef.current, e.latLng.toJSON()));
      pickupMarker.addListener('dragend', () => place('pickup', pickupMarker.getPosition().toJSON()));
      deliveryMarker.addListener('dragend', () => place('delivery', deliveryMarker.getPosition().toJSON()));
      setReady(true);
    }).catch(() => onFail?.());
    return () => { alive = false; };
  }, []);

  // Repères et trajet suivent le formulaire ; la vue cadre les deux points
  useEffect(() => {
    const { maps, map, pickupMarker, deliveryMarker, route } = g.current;
    if (!ready || !valid(pickup) || !valid(delivery)) return;
    const a = asLatLng(pickup);
    const b = asLatLng(delivery);
    pickupMarker.setPosition(a);
    deliveryMarker.setPosition(b);
    pickupMarker.setMap(showPickup ? map : null);
    route.setPath(showPickup ? [a, b] : []);
    if (showPickup) {
      const bounds = new maps.LatLngBounds();
      bounds.extend(a);
      bounds.extend(b);
      map.fitBounds(bounds, { top: 120, left: 40, right: 40, bottom: 70 });
      if (map.getZoom() > 16) map.setZoom(16);
    } else {
      map.panTo(b);
      map.setZoom(16);
    }
  }, [ready, pickup.lat, pickup.lng, delivery.lat, delivery.lng, showPickup]);

  // Étiquette au-dessus du repère modifiable, recalculée quand on change de point modifiable
  useEffect(() => {
    if (!ready) return;
    setLabel(null);
    const point = editable === 'pickup' ? pickup : delivery;
    if (valid(point)) identify(editable, asLatLng(point));
  }, [ready, editable]);

  // Position à l'écran de l'étiquette : suit la carte quand on la déplace
  const [labelAt, setLabelAt] = useState(null);
  useEffect(() => {
    const { maps, map } = g.current;
    if (!ready || !label) return undefined;
    const overlay = new maps.OverlayView();
    const marker = editable === 'pickup' ? g.current.pickupMarker : g.current.deliveryMarker;
    overlay.onAdd = () => {};
    overlay.onRemove = () => {};
    overlay.draw = () => {
      const p = overlay.getProjection()?.fromLatLngToContainerPixel(marker.getPosition());
      if (p) setLabelAt({ x: p.x, y: p.y });
    };
    overlay.setMap(map);
    const listeners = ['bounds_changed', 'zoom_changed'].map((ev) => map.addListener(ev, () => overlay.draw()));
    const drag = marker.addListener('position_changed', () => overlay.draw());
    return () => {
      listeners.forEach((l) => l.remove());
      drag.remove();
      overlay.setMap(null);
    };
  }, [ready, label, editable]);

  return (
    <div className="bn-gmap">
      <div ref={el} className="bn-order__mapcanvas" role="application" aria-label="Carte de la commande : départ et arrivée" />
      {label && labelAt && (
        <span className="bn-gmap__label" style={{ left: labelAt.x, top: labelAt.y - (editable === 'pickup' ? 18 : 62) }}>
          {label}
        </span>
      )}
    </div>
  );
}
