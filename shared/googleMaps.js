/*
 * Google Maps pour les cartes BenneGo (même fond que Gozem : rues, bâtiments, noms des lieux).
 * La clé vient de VITE_GOOGLE_MAPS_KEY (fichier .env de chaque application). Sans clé, les écrans
 * gardent la carte OpenStreetMap / CARTO.
 */
let loading = null;
let authFailed = false;
const failureListeners = new Set();

// Clé refusée par Google (mauvaise clé, API non activée, domaine non autorisé) : les cartes repassent sur OpenStreetMap
if (typeof window !== 'undefined') {
  window.gm_authFailure = () => {
    authFailed = true;
    console.error('Google Maps : clé refusée. Vérifiez VITE_GOOGLE_MAPS_KEY, les API activées et les domaines autorisés.');
    failureListeners.forEach((fn) => fn());
  };
}

/** Prévient une carte si Google refuse la clé après coup. Renvoie la fonction de désabonnement. */
export const onGoogleMapsFailure = (fn) => {
  failureListeners.add(fn);
  return () => failureListeners.delete(fn);
};

export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';
export const hasGoogleMaps = () => Boolean(GOOGLE_MAPS_KEY) && !authFailed;

/** Charge l'API une seule fois (bibliothèques : lieux, géométrie, repères). */
export function loadGoogleMaps() {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const callback = `bnGoogleMapsReady${Date.now()}`;
    // Réseau lent ou serveurs Google injoignables : au-delà de 10 s, on passe sur la carte de secours
    const timer = setTimeout(() => {
      loading = null;
      reject(new Error('Google Maps trop long à charger'));
    }, 10000);
    window[callback] = () => {
      clearTimeout(timer);
      delete window[callback];
      resolve(window.google.maps);
    };
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_KEY,
      libraries: 'places,geometry',
      language: 'fr',
      region: 'BJ',
      loading: 'async',
      callback,
    });
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      loading = null;
      reject(new Error('Google Maps indisponible'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

// Options communes : carte nette façon application de transport, sans contrôles superflus
export const MAP_OPTIONS = {
  disableDefaultUI: true,
  clickableIcons: false,
  gestureHandling: 'greedy',
  keyboardShortcuts: false,
  // Les lieux (restaurants, écoles…) restent visibles comme sur Gozem ; on masque seulement les arrêts de bus
  styles: [
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  ],
};

const svgIcon = (maps, svg, size, anchor) => ({
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  scaledSize: new maps.Size(size[0], size[1]),
  anchor: new maps.Point(anchor[0], anchor[1]),
});

/** Repère d'arrivée sable doré : goutte, centre blanc et tige, comme la carte actuelle. */
export const goldPinIcon = (maps) => svgIcon(maps, `
<svg width="40" height="56" viewBox="0 0 40 56" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8c38a"/><stop offset="1" stop-color="#d9a55b"/></linearGradient></defs>
  <ellipse cx="20" cy="53" rx="7" ry="2.6" fill="#111827" opacity=".22"/>
  <rect x="18" y="30" width="4" height="22" rx="2" fill="#b5803f"/>
  <circle cx="20" cy="18" r="16" fill="url(#g)" stroke="#ffffff" stroke-width="2.5"/>
  <circle cx="20" cy="18" r="6.5" fill="#ffffff"/>
</svg>`, [40, 56], [20, 54]);

/** Point de départ : pastille noire cerclée de blanc. */
export const startDotIcon = (maps) => svgIcon(maps, `
<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
  <circle cx="11" cy="11" r="8" fill="#0b0b10" stroke="#ffffff" stroke-width="4"/>
</svg>`, [22, 22], [11, 11]);

/** Camion (position du chauffeur) : pastille sable cerclée de noir avec halo. */
export const truckIcon = (maps) => svgIcon(maps, `
<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
  <circle cx="17" cy="17" r="16" fill="#d9a55b" opacity=".3"/>
  <circle cx="17" cy="17" r="10" fill="#d9a55b" stroke="#0b0b10" stroke-width="4"/>
</svg>`, [34, 34], [17, 17]);

/** Trajet en pointillés sable entre deux points. */
export const dashedRoute = (maps) => ({
  strokeOpacity: 0,
  icons: [{
    icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#d9a55b', strokeWeight: 5, scale: 2 },
    offset: '0',
    repeat: '14px',
  }],
});

/**
 * Nom lisible d'un point : le lieu connu le plus proche (« Restaurant Vignoble »), sinon la rue.
 * Utilise le géocodage inverse de Google.
 */
export async function placeNameAt(maps, latLng) {
  const geocoder = new maps.Geocoder();
  const { results } = await geocoder.geocode({ location: latLng });
  if (!results?.length) return null;
  const poi = results.find((r) => r.types.some((t) => ['point_of_interest', 'establishment', 'premise'].includes(t)));
  const best = poi || results[0];
  const named = best.address_components?.find((c) => c.types.some((t) => ['point_of_interest', 'establishment', 'premise'].includes(t)));
  if (named) return named.long_name;
  // Adresse courte : deux premiers éléments (« Rue 203, Cotonou »)
  return best.formatted_address.split(',').slice(0, 2).join(',').trim();
}

/**
 * Suggestions d'adresses au Bénin pendant la saisie (Places API New).
 * @returns {Promise<Array<{ id, main, secondary, toPlace }>>}
 */
export async function suggestPlaces(maps, input, { sessionToken, near } = {}) {
  const { AutocompleteSuggestion } = await maps.importLibrary('places');
  const request = { input, includedRegionCodes: ['bj'], language: 'fr', sessionToken };
  if (near) request.locationBias = { center: near, radius: 30000 };
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
  return (suggestions || []).filter((s) => s.placePrediction).map(({ placePrediction: p }) => ({
    id: p.placeId,
    main: p.mainText?.text || p.text?.text,
    secondary: p.secondaryText?.text || '',
    toPlace: () => p.toPlace(),
  }));
}

/** Coordonnées et nom d'une suggestion choisie. */
export async function resolvePlace(suggestion) {
  const place = suggestion.toPlace();
  await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] });
  return {
    lat: place.location.lat(),
    lng: place.location.lng(),
    name: place.displayName || suggestion.main,
    address: place.formattedAddress,
  };
}
