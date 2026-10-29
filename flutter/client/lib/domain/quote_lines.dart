import 'package:bennego_core/bennego_core.dart';
import 'package:intl/intl.dart';

/// Une ligne du détail du devis : libellé, précision facultative et montant.
class QuoteLine {
  const QuoteLine(this.label, this.amount, {this.hint});

  final String label;
  final String? hint;
  final double amount;
}

const _truckHints = {
  'simple_benne': 'Benne simple · tarif de base',
  'double_benne': 'Double benne · ×1,4',
  'plateau': 'Plateau · ×1,2',
  'pickup': 'Pick-up léger · ×0,55',
  'grue': 'Camion grue · ×1,6',
  'semi_remorque': 'Semi-remorque · ×1,8',
};

final NumberFormat _kmFormat = NumberFormat('#,##0.#', 'fr_FR');

/// Distance au format français : « 25,9 km ».
String formatKm(num km) => '${_kmFormat.format(km)} km';

/// Détail du prix renvoyé par le serveur, ligne par ligne, pour que la somme donne le total affiché.
List<QuoteLine> quoteLines(Map<String, dynamic> breakdown, {double? distanceKm, double? pricePerKm}) {
  final lines = <QuoteLine>[];
  final km = distanceKm ?? parseNum(breakdown['distance_km']);
  void add(String label, Object? value, {String? hint}) {
    final amount = parseNum(value);
    if (amount > 0) lines.add(QuoteLine(label, amount, hint: hint));
  }

  switch (breakdown['order_type']) {
    case 'RENTAL':
      add(
        "Location : ${parseNum(breakdown['duration_hours']).round()} h × ${formatFcfa(parseNum(breakdown['hourly_rate']))}/h",
        breakdown['rental_subtotal'],
      );
      add('Mobilisation & transport engin', breakdown['mobilization_fee']);
    case 'EVACUATION':
      final rotations = parseNum(breakdown['rotations']).round();
      add('Forfait prise en charge', breakdown['base_pickup_fee'], hint: rotations > 1 ? '$rotations rotations' : null);
      add(
        'Transport vers la décharge : ${formatKm(km)} × ${formatFcfa(parseNum(breakdown['price_per_km']))}/km',
        breakdown['distance_cost'],
      );
    default:
      add('Prise en charge du camion', breakdown['base_fee']);
      add(
        'Transport : ${formatKm(km)} × ${formatFcfa(pricePerKm ?? 0)}/km',
        breakdown['distance_cost'],
        hint: _truckHints[breakdown['truck_type']],
      );
      add('Chargement à la carrière', breakdown['loading_fee']);
      add(
        'Matériau : ${_kmFormat.format(parseNum(breakdown['quantity']))} m³ × ${formatFcfa(parseNum(breakdown['material_unit_price']))}',
        breakdown['material_cost'],
      );
  }
  // Écart avec le prix affiché : arrondi au millier supérieur, ou complément jusqu'au prix minimum
  add(
    breakdown['minimum_applied'] == true
        ? 'Complément au prix minimum (${formatFcfa(parseNum(breakdown['minimum_price']))})'
        : 'Arrondi au millier supérieur',
    breakdown['rounding'],
  );
  return lines;
}
