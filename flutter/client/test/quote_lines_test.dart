import 'package:bennego_client/domain/quote_lines.dart';
import 'package:bennego_core/bennego_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('le devis matériaux détaille chargement et arrondi, et la somme donne le total', () {
    final lines = quoteLines(
      {
        'order_type': 'MATERIAL',
        'base_fee': 10000,
        'distance_km': 25.9,
        'distance_cost': 54390,
        'loading_fee': 5000,
        'material_cost': 0,
        'truck_type': 'double_benne',
        'rounding': 610,
        'minimum_applied': false,
        'minimum_price': 35000,
      },
      distanceKm: 25.9,
      pricePerKm: 2100,
    );

    expect(lines.map((l) => l.label), [
      'Prise en charge du camion',
      'Transport : ${formatKm(25.9)} × ${formatFcfa(2100)}/km',
      'Chargement à la carrière',
      'Arrondi au millier supérieur',
    ]);
    expect(lines[1].hint, 'Double benne · ×1,4');
    expect(lines.fold<double>(0, (sum, l) => sum + l.amount), 70000);
    expect(formatKm(25.9), '25,9 km');
  });

  test('une course courte affiche le complément au prix minimum', () {
    final lines = quoteLines(
      {
        'order_type': 'MATERIAL',
        'base_fee': 10000,
        'distance_cost': 4500,
        'loading_fee': 5000,
        'rounding': 15500,
        'minimum_applied': true,
        'minimum_price': 35000,
      },
      distanceKm: 3,
      pricePerKm: 1500,
    );

    expect(lines.last.label, 'Complément au prix minimum (${formatFcfa(35000)})');
    expect(lines.last.amount, 15500);
  });
}
