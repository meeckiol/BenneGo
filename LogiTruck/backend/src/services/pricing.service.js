const axios = require('axios');

const OSRM_URL = process.env.OSRM_URL || 'http://router.project-osrm.org';
const COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 0.10;

// Tarification LogiTruck (en FCFA)
const PRICING = {
  base_fee: 10000,           // Frais fixes de départ
  price_per_km: 1500,        // Prix par km
  loading_fee: 5000,         // Frais de chargement
  min_price: 50000,          // Prix minimum par course
  // Supplément selon type de camion
  truck_multiplier: {
    simple_benne: 1.0,
    double_benne: 1.4,
    plateau: 1.2,
  },
};

/**
 * Calcule la distance et la durée entre deux points via OSRM
 * @param {number} pickupLat - Latitude départ
 * @param {number} pickupLng - Longitude départ
 * @param {number} deliveryLat - Latitude arrivée
 * @param {number} deliveryLng - Longitude arrivée
 * @returns {{ distance_km: number, duration_min: number }}
 */
const calculateRoute = async (pickupLat, pickupLng, deliveryLat, deliveryLng) => {
  try {
    const url = `${OSRM_URL}/route/v1/driving/${pickupLng},${pickupLat};${deliveryLng},${deliveryLat}`;
    const response = await axios.get(url, {
      params: { overview: 'false', annotations: 'false' },
      timeout: 5000,
    });

    if (response.data.code !== 'Ok' || !response.data.routes.length) {
      throw new Error('Impossible de calculer l\'itinéraire');
    }

    const route = response.data.routes[0];
    return {
      distance_km: Math.round((route.distance / 1000) * 10) / 10, // mètres → km
      duration_min: Math.round(route.duration / 60),              // secondes → minutes
    };
  } catch (error) {
    // Fallback: calcul à vol d'oiseau si OSRM indisponible
    console.warn('OSRM indisponible, calcul approximatif:', error.message);
    const distanceRaw = haversineDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);
    return {
      distance_km: Math.round(distanceRaw * 1.3 * 10) / 10, // +30% pour les routes réelles
      duration_min: Math.round((distanceRaw * 1.3) / 30 * 60), // ~30 km/h en ville
    };
  }
};

/**
 * Calcule la distance à vol d'oiseau (formule de Haversine)
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const toRad = (value) => (value * Math.PI) / 180;

/**
 * Calcule le prix d'une course
 * @param {number} distanceKm - Distance en km
 * @param {string} truckType - Type de camion
 * @param {string} materialType - Type de matériau (optionnel)
 * @returns {{ total_amount, commission_amount, driver_amount, price_per_km, breakdown }}
 */
const calculatePrice = (distanceKm, truckType = 'simple_benne', materialType = null) => {
  const multiplier = PRICING.truck_multiplier[truckType] || 1.0;

  // Calcul du prix de base
  const distanceCost = distanceKm * PRICING.price_per_km * multiplier;
  const rawTotal = PRICING.base_fee + distanceCost + PRICING.loading_fee;

  // Arrondir au millier supérieur (pratique courante au Bénin)
  const total_amount = Math.max(
    Math.ceil(rawTotal / 1000) * 1000,
    PRICING.min_price
  );

  // Commission plateforme (10%)
  const commission_amount = Math.round(total_amount * COMMISSION_RATE);
  const driver_amount = total_amount - commission_amount;

  return {
    total_amount,
    commission_amount,
    driver_amount,
    price_per_km: PRICING.price_per_km * multiplier,
    breakdown: {
      base_fee: PRICING.base_fee,
      distance_cost: Math.round(distanceCost),
      loading_fee: PRICING.loading_fee,
      truck_multiplier: multiplier,
      commission_rate: `${COMMISSION_RATE * 100}%`,
    },
  };
};

module.exports = { calculateRoute, calculatePrice, haversineDistance };
