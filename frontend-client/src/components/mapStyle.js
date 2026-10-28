import L from 'leaflet';

/*
 * Style commun des cartes BenneGo : fond clair façon plan de ville (CARTO Voyager, données OpenStreetMap),
 * repère d'arrivée sable doré en goutte avec un centre blanc et une tige, point de départ sombre.
 */
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const TILE_OPTIONS = {
  attribution: '© OpenStreetMap © CARTO',
  subdomains: 'abcd',
  maxZoom: 20,
};

export const addTiles = (map) => L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);

const PIN_SVG = `
<svg width="40" height="56" viewBox="0 0 40 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="bn-pin-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8c38a"/>
      <stop offset="1" stop-color="#d9a55b"/>
    </linearGradient>
  </defs>
  <ellipse cx="20" cy="53" rx="7" ry="2.6" fill="#111827" opacity=".22"/>
  <rect x="18" y="30" width="4" height="22" rx="2" fill="#b5803f"/>
  <circle cx="20" cy="18" r="16" fill="url(#bn-pin-gold)" stroke="#ffffff" stroke-width="2.5"/>
  <circle cx="20" cy="18" r="6.5" fill="#ffffff"/>
</svg>`;

export const goldPin = L.divIcon({
  className: '',
  html: PIN_SVG,
  iconSize: [40, 56],
  iconAnchor: [20, 54],
  popupAnchor: [0, -50],
});

export const startDot = L.divIcon({
  className: '',
  html: '<span style="display:block;width:18px;height:18px;border-radius:50%;background:#0b0b10;border:4px solid #ffffff;box-shadow:0 2px 6px rgba(17,24,39,.35)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
