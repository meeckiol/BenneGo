// Détail d'un devis, ligne par ligne, à partir du « breakdown » calculé par le serveur.
// La somme des lignes donne le prix de la course (arrondi ou complément au prix minimum compris).

export const money = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;
export const km = (n) => `${(Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;

export const TRUCK_HINTS = {
  simple_benne: 'Benne simple · tarif de base',
  double_benne: 'Double benne · ×1,4',
  plateau: 'Plateau · ×1,2',
  pickup: 'Pick-up léger · ×0,55',
  grue: 'Camion grue · ×1,6',
  semi_remorque: 'Semi-remorque · ×1,8',
};

/** @returns {{ label: string, hint?: string, amount: number }[]} */
export function quoteLines(breakdown, { distanceKm, pricePerKm } = {}) {
  if (!breakdown) return [];
  const lines = [];
  const dist = distanceKm ?? breakdown.distance_km;
  const add = (label, value, hint) => {
    const amount = Number(value) || 0;
    if (amount > 0) lines.push({ label, amount, hint });
  };

  if (breakdown.order_type === 'RENTAL') {
    add(`Location : ${breakdown.duration_hours} h × ${money(breakdown.hourly_rate)}/h`, breakdown.rental_subtotal);
    add('Mobilisation & transport engin', breakdown.mobilization_fee);
  } else if (breakdown.order_type === 'EVACUATION') {
    const rotations = Number(breakdown.rotations) || 1;
    // Le forfait est compté à chaque rotation ; le transport l'est déjà dans distance_cost
    add(
      rotations > 1 ? `Forfait prise en charge : ${rotations} × ${money(breakdown.base_pickup_fee)}` : 'Forfait prise en charge',
      (Number(breakdown.base_pickup_fee) || 0) * rotations,
    );
    add(`Transport vers la décharge : ${km(dist)} × ${money(breakdown.price_per_km)}/km`, breakdown.distance_cost);
  } else {
    add('Prise en charge du camion', breakdown.base_fee);
    add(`Transport : ${km(dist)} × ${money(pricePerKm)}/km`, breakdown.distance_cost, TRUCK_HINTS[breakdown.truck_type]);
    add('Chargement à la carrière', breakdown.loading_fee);
    add(`Matériau : ${breakdown.quantity} m³ × ${money(breakdown.material_unit_price)}`, breakdown.material_cost);
  }
  add(
    breakdown.minimum_applied
      ? `Complément au prix minimum (${money(breakdown.minimum_price)})`
      : 'Arrondi au millier supérieur',
    breakdown.rounding,
  );
  return lines;
}
