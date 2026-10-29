import 'package:bennego_admin/data/admin_repository.dart';
import 'package:bennego_admin/screens/order_detail_screen.dart';
import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

Widget _wrap(Map<String, dynamic> order) => Provider<AdminRepository>.value(
      value: AdminRepository(ApiClient(baseUrl: 'http://localhost')),
      child: MaterialApp(home: OrderDetailScreen(order: order)),
    );

void main() {
  testWidgets('la fiche détaille le devis, les réductions et la répartition', (tester) async {
    await tester.binding.setSurfaceSize(const Size(420, 2000));
    await tester.pumpWidget(_wrap({
      'id': 'o1',
      'order_number': 'LT-2026-1',
      'order_type': 'MATERIAL',
      'status': 'validated',
      'payment_status': 'escrow_held',
      'client_name': 'Awa',
      'driver_name': 'Koffi',
      'distance_km': '25.90',
      'price_per_km': '2100.00',
      'total_amount': '70000.00',
      'commission_amount': '7000.00',
      'driver_amount': '63000.00',
      'referral_discount': '1500.00',
      'credit_used': '0',
      'discount_amount': '1500.00',
      'price_breakdown': {
        'order_type': 'MATERIAL',
        'base_fee': 10000,
        'distance_cost': 54390,
        'loading_fee': 5000,
        'truck_type': 'double_benne',
        'rounding': 610,
        'commission_rate': '10%',
      },
    }));

    expect(find.text('Chargement à la carrière'), findsOneWidget);
    expect(find.text('Arrondi au millier supérieur'), findsOneWidget);
    expect(find.text(formatFcfa(68500)), findsOneWidget); // payé par le client
    expect(find.text('Commission BenneGo (10%)'), findsOneWidget);
    expect(find.text(formatFcfa(5500)), findsOneWidget); // net après réduction
    expect(find.text('Libérer le paiement au chauffeur'), findsOneWidget);
  });

  testWidgets('une ancienne commande sans détail affiche un message', (tester) async {
    await tester.pumpWidget(_wrap({'id': 'o2', 'order_number': 'BG-1', 'status': 'completed', 'total_amount': '45000'}));
    expect(find.textContaining('Détail non enregistré'), findsOneWidget);
    expect(find.text('Libérer le paiement au chauffeur'), findsNothing);
  });
}
