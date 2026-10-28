import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { goldPin, startDot } from '../../../frontend-client/src/components/mapStyle';
import { MAP_OPTIONS, goldPinIcon, hasGoogleMaps, loadGoogleMaps, onGoogleMapsFailure, startDotIcon, truckIcon } from '../../../shared/googleMaps';

// Position du camion : pastille sable cerclée de noir (les icônes Leaflet par défaut ne se chargent pas une fois l'app compilée)
const truckDot = L.divIcon({
  className: '',
  html: '<span style="display:block;width:22px;height:22px;border-radius:50%;background:#d9a55b;border:4px solid #0b0b10;box-shadow:0 0 0 4px rgba(217,165,91,.35)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

/**
 * Carte de la course du camionneur : chargement, livraison et sa position, centrée sur lui.
 * Google Maps avec une clé (VITE_GOOGLE_MAPS_KEY), sinon OpenStreetMap / CARTO.
 */
export default function RouteMap(props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => onGoogleMapsFailure(() => setFailed(true)), []);
  if (!hasGoogleMaps() || failed) return <LeafletRouteMap {...props} />;
  return <GoogleRouteMap {...props} onFail={() => setFailed(true)} />;
}

const point = (lat, lng) => ({ lat: parseFloat(lat), lng: parseFloat(lng) });

function GoogleRouteMap({ order, position, onFail }) {
  const el = useRef(null);
  const g = useRef({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGoogleMaps().then((maps) => {
      if (!alive) return;
      const a = point(order.pickup_lat, order.pickup_lng);
      const b = point(order.delivery_lat, order.delivery_lng);
      const map = new maps.Map(el.current, { ...MAP_OPTIONS, center: position || a, zoom: 14 });
      new maps.Marker({ map, position: a, icon: startDotIcon(maps), title: order.pickup_address });
      new maps.Marker({ map, position: b, icon: goldPinIcon(maps), title: order.delivery_address });
      g.current = { maps, map };
      setReady(true);
    }).catch(() => onFail?.());
    return () => { alive = false; };
  }, [order.id]);

  useEffect(() => {
    if (!ready || !position) return;
    const { maps, map } = g.current;
    if (!g.current.truck) g.current.truck = new maps.Marker({ map, position, icon: truckIcon(maps), zIndex: 1000, title: 'Votre position' });
    else g.current.truck.setPosition(position);
    map.panTo(position);
  }, [ready, position?.lat, position?.lng]);

  return <div ref={el} style={{ height: '100%', width: '100%' }} />;
}

// Centre la carte Leaflet sur la position GPS
function MapCenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], map.getZoom());
  }, [position, map]);
  return null;
}

function LeafletRouteMap({ order, position }) {
  const center = position ? [position.lat, position.lng] : [parseFloat(order.pickup_lat), parseFloat(order.pickup_lng)];
  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution="© OpenStreetMap © CARTO"
      />
      {position && (
        <Marker position={[position.lat, position.lng]} icon={truckDot}>
          <Popup>Votre position</Popup>
        </Marker>
      )}
      <Marker position={[parseFloat(order.pickup_lat), parseFloat(order.pickup_lng)]} icon={startDot}>
        <Popup>{order.pickup_address}</Popup>
      </Marker>
      <Marker position={[parseFloat(order.delivery_lat), parseFloat(order.delivery_lng)]} icon={goldPin}>
        <Popup>{order.delivery_address}</Popup>
      </Marker>
      {position && <MapCenter position={position} />}
    </MapContainer>
  );
}
