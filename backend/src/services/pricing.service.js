const axios = require('axios');

const OSRM_URL = process.env.OSRM_URL || 'http://router.project-osrm.org';
const DEFAULT_COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 0.10;
const B2B_COMMISSION_RATE = 0.04; // 3% à 5% pour grands comptes / courtage B2B

// Grille tarifaire B2B & Abonnements
const B2B_PRICING_PLANS = {
  monthly_saas: {
    name: 'Abonnement Mensuel B2B (SaaS)',
    price: 45000,
    currency: 'XOF',
    duration_days: 30,
    features: ['Accès illimité pour 3 ingénieurs', 'Suivi GPS en direct', 'Export CSV & Rapports de chantier', 'Commission réduite (4%)'],
  },
  site_pack: {
    name: 'Frais Fixes par Chantier (Pack)',
    price: 75000,
    currency: 'XOF',
    duration_days: 180,
    features: ['Pack dédié à un projet de chantier (6 mois)', 'Suivi GPS certifié', 'Facturation proforma groupée', 'Commission réduite (4%)'],
  },
};

// Tarification de base BenneGo (en FCFA)
const PRICING = {
  base_fee: 10000,           // Frais fixes de départ pour transport matériaux
  price_per_km: 1500,        // Prix standard par km
  loading_fee: 5000,         // Frais de manutention/chargement
  min_price: 35000,          // Prix minimum par course

  // Multiplicateurs / barème camions
  truck_multiplier: {
    simple_benne: 1.0,
    double_benne: 1.4,
    plateau: 1.2,
    grue: 1.6,
    semi_remorque: 1.8,
  },

  // Tarifs horaires de référence pour engins lourds (en FCFA/h)
  machinery_hourly: {
    excavatrice: 35000,
    chargeuse: 30000,
    bulldozer: 40000,
    compacteur: 25000,
    niveleuse: 35000,
    default: 30000,
  },
  machinery_mobilization_fee: 30000, // Acheminement de l'engin sur le chantier

  // Tarification Évacuation de gravats
  evacuation: {
    base_pickup_fee: 25000,    // Prise en charge fixe
    price_per_km: 1500,        // Transport vers décharge autorisée
  },
};

/**
 * Calcule la distance et la durée entre deux points via OSRM, avec coordonnées du tracé
 * @param {number} pickupLat
 * @param {number} pickupLng
 * @param {number} deliveryLat
 * @param {number} deliveryLng
 * @returns {Promise<{ distance_km: number, duration_min: number, coordinates: Array<[number, number]> }>}
 */
const calculateRoute = async (pickupLat, pickupLng, deliveryLat, deliveryLng) => {
  try {
    const url = `${OSRM_URL}/route/v1/driving/${pickupLng},${pickupLat};${deliveryLng},${deliveryLat}`;
    const response = await axios.get(url, {
      params: { overview: 'simplified', geometries: 'geojson', steps: 'false' },
      timeout: 5000,
    });

    if (response.data.code !== 'Ok' || !response.data.routes.length) {
      throw new Error('Impossible de calculer l\'itinéraire');
    }

    const route = response.data.routes[0];
    return {
      distance_km: Math.round((route.distance / 1000) * 10) / 10,
      duration_min: Math.round(route.duration / 60),
      coordinates: route.geometry?.coordinates || [],
    };
  } catch (error) {
    // Fallback: calcul à vol d'oiseau si OSRM indisponible
    console.warn('OSRM indisponible, calcul approximatif:', error.message);
    const distanceRaw = haversineDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);
    const distance_km = Math.round(distanceRaw * 1.3 * 10) / 10;
    return {
      distance_km,
      duration_min: Math.round((distanceRaw * 1.3) / 30 * 60),
      coordinates: [[pickupLng, pickupLat], [deliveryLng, deliveryLat]],
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
 * Calcule la distance minimale entre un point GPS et un segment ou tracé (pour détection de déviation)
 */
const pointToLineDistanceKm = (pointLat, pointLng, lineCoords) => {
  if (!lineCoords || lineCoords.length === 0) return 0;
  let minDistance = Infinity;
  for (const [lng, lat] of lineCoords) {
    const dist = haversineDistance(pointLat, pointLng, lat, lng);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
};

/**
 * Calcule le prix d'une course ou prestation selon le service (Matériaux, Location Engin, Évacuation)
 * Compatible avec l'ancienne signature calculatePrice(distanceKm, truckType, materialType)
 * ou avec un objet d'options complet.
 *
 * Formules :
 * 1. Transport Matériaux : Prix Matériau + (Distance × Prix/Km × Multiplicateur) + Prise en charge
 * 2. Location Engins : Tarif Horaire × Nombre d'Heures (+ forfait mobilisation)
 * 3. Évacuation Gravats : Forfait Fixe + (Distance décharge × Prix/Km) × Nombre de rotations
 *
 * @param {number|object} arg1 - Distance en km ou objet d'options
 * @param {string} [truckType='simple_benne']
 * @param {string|object} [materialType=null]
 * @returns {{ total_amount, commission_amount, driver_amount, price_per_km, breakdown }}
 */
const calculatePrice = (arg1, truckType = 'simple_benne', materialType = null) => {
  let opts = {};

  if (typeof arg1 === 'object' && arg1 !== null) {
    opts = arg1;
  } else {
    opts = {
      distance_km: Number(arg1) || 0,
      truck_type: truckType || 'simple_benne',
      material_type: materialType,
      order_type: 'MATERIAL',
    };
  }

  const orderType = (opts.order_type || 'MATERIAL').toUpperCase();
  const isB2b = Boolean(opts.is_b2b);
  const commissionRate = opts.commission_rate || (isB2b ? B2B_COMMISSION_RATE : DEFAULT_COMMISSION_RATE);

  let rawTotal = 0;
  let pricePerKm = 0;
  let breakdown = {};

  if (orderType === 'RENTAL') {
    // SERVICE 2 : Location d'Engins Lourds
    // Formule : Tarif Horaire de l'Engin × Nombre d'Heures (+ Forfait d'acheminement)
    const hours = Math.max(parseFloat(opts.duration_hours) || 4, 1); // Min 1 heure
    const hourlyRate = parseFloat(opts.hourly_rate) ||
      PRICING.machinery_hourly[opts.machinery_type] ||
      PRICING.machinery_hourly.default;
    const mobilizationFee = opts.include_mobilization !== false ? PRICING.machinery_mobilization_fee : 0;

    const rentalSubtotal = hours * hourlyRate;
    rawTotal = rentalSubtotal + mobilizationFee;
    pricePerKm = 0;

    breakdown = {
      order_type: 'RENTAL',
      duration_hours: hours,
      hourly_rate: hourlyRate,
      rental_subtotal: rentalSubtotal,
      mobilization_fee: mobilizationFee,
    };
  } else if (orderType === 'EVACUATION') {
    // SERVICE 3 : Logistique d'Évacuation de gravats
    // Formule : Prix Fixe de Prise en Charge + (Distance × Prix au Km) × Rotations
    const distanceKm = Math.max(parseFloat(opts.distance_km) || 0, 0);
    const rotations = Math.max(parseInt(opts.rotations || opts.trucks_count, 10) || 1, 1);
    const basePickup = parseFloat(opts.base_fare) || PRICING.evacuation.base_pickup_fee;
    pricePerKm = parseFloat(opts.km_rate) || PRICING.evacuation.price_per_km;

    const distanceCost = distanceKm * pricePerKm;
    rawTotal = (basePickup + distanceCost) * rotations;

    breakdown = {
      order_type: 'EVACUATION',
      rotations,
      base_pickup_fee: basePickup,
      distance_km: distanceKm,
      distance_cost: Math.round(distanceCost * rotations),
      price_per_km: pricePerKm,
    };
  } else {
    // SERVICE 1 : Transport de Matériaux (Cœur de métier)
    // Formule : Prix du Matériau + (Distance × Prix au Km du Camion) + Prise en charge
    const distanceKm = Math.max(parseFloat(opts.distance_km) || 0, 0);
    const truckKey = opts.truck_type || 'simple_benne';
    const multiplier = PRICING.truck_multiplier[truckKey] || 1.0;
    pricePerKm = PRICING.price_per_km * multiplier;

    const distanceCost = distanceKm * pricePerKm;
    const baseFee = parseFloat(opts.base_fare) || PRICING.base_fee;
    const loadingFee = PRICING.loading_fee;

    // Coût d'achat du matériau s'il est commandé directement via BenneGo
    const materialUnitPrice = parseFloat(opts.material_unit_price) || 0;
    const quantity = parseFloat(opts.quantity_m3 || opts.quantity) || 0;
    const materialCost = materialUnitPrice * quantity;

    rawTotal = baseFee + distanceCost + loadingFee + materialCost;

    breakdown = {
      order_type: 'MATERIAL',
      base_fee: baseFee,
      distance_km: distanceKm,
      distance_cost: Math.round(distanceCost),
      loading_fee: loadingFee,
      material_unit_price: materialUnitPrice,
      quantity,
      material_cost: Math.round(materialCost),
      truck_multiplier: multiplier,
      truck_type: truckKey,
    };
  }

  // Arrondir au millier supérieur
  const minFloor = orderType === 'RENTAL' ? 50000 : PRICING.min_price;
  const total_amount = Math.max(Math.ceil(rawTotal / 1000) * 1000, minFloor);

  // Commission séquestre plateforme & reversement prestataire
  const commission_amount = Math.round(total_amount * commissionRate);
  const driver_amount = total_amount - commission_amount;

  breakdown.commission_rate = `${Math.round(commissionRate * 100)}%`;
  breakdown.is_b2b = isB2b;

  return {
    total_amount,
    commission_amount,
    driver_amount,
    price_per_km: pricePerKm,
    breakdown,
  };
};

module.exports = {
  calculateRoute,
  calculatePrice,
  haversineDistance,
  pointToLineDistanceKm,
  PRICING,
  B2B_PRICING_PLANS,
  DEFAULT_COMMISSION_RATE,
  B2B_COMMISSION_RATE,
};
