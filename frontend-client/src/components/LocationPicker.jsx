import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { addTiles, goldPin } from './mapStyle';
import 'leaflet/dist/leaflet.css';

const PICKER_ZOOM = 12;

/**
 * Choix du lieu de chantier sur une carte : un clic ou un déplacement du repère met à jour les coordonnées.
 * `value` = { lat, lng } (nombres ou chaînes), `onChange({ lat, lng })`.
 */
export default function LocationPicker({ value, onChange }) {
  const el = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const start = [Number(value.lat), Number(value.lng)];
    map.current = L.map(el.current).setView(start, PICKER_ZOOM);
    addTiles(map.current);
    // Titre et texte alternatif : le repère est un bouton au clavier, il doit avoir un nom pour les lecteurs d'écran
    marker.current = L.marker(start, {
      icon: goldPin,
      draggable: true,
      title: 'Emplacement du chantier',
      alt: 'Emplacement du chantier',
    }).addTo(map.current);

    const emit = (latlng) => onChangeRef.current({ lat: latlng.lat, lng: latlng.lng });
    map.current.on('click', (event) => {
      marker.current.setLatLng(event.latlng);
      emit(event.latlng);
    });
    marker.current.on('dragend', () => emit(marker.current.getLatLng()));

    return () => { map.current.remove(); map.current = null; };
  }, []);

  // Quand le formulaire change les coordonnées (autre champ, choix de projet), le repère suit
  useEffect(() => {
    const lat = Number(value.lat);
    const lng = Number(value.lng);
    if (!map.current || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    marker.current.setLatLng([lat, lng]);
  }, [value.lat, value.lng]);

  return (
    <div role="group" aria-label="Carte du chantier de livraison">
      <div
        ref={el}
        style={{ height: 240, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-2)' }}
      />
      <p className="bn-subtitle" style={{ marginTop: 6 }}>
        Touchez la carte ou déplacez le repère pour placer le chantier.
      </p>
    </div>
  );
}
