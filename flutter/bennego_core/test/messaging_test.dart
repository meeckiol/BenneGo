import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('message de discussion lu depuis le serveur, assistance reconnue', () {
    final message = ChatMessage.fromJson({
      'id': 'm1',
      'order_id': 'o1',
      'sender_id': 'a1',
      'sender_name': 'Assistance BenneGo',
      'sender_role': 'admin',
      'message': 'Bonjour',
      'created_at': '2026-10-29T08:30:00.000Z',
      'order_number': 'BG-1',
    });
    expect(message.orderId, 'o1');
    expect(message.isFromTeam, isTrue);
    expect(message.orderNumber, 'BG-1');
  });

  test('commande : discussion ouverte seulement avec chauffeur et tant que non terminée', () {
    Order order(String status, {String? driver}) => Order.fromJson({
          'id': 'o1',
          'status': status,
          'driver_id': driver,
          'material_name': 'Sable',
          'quantity_m3': '12.00',
          'driver_name': 'Rodrigue Dossou',
        });
    expect(order('pending').hasChat, isFalse);
    expect(order('driver_en_route_delivery', driver: 'd1').hasChat, isTrue);
    expect(order('completed', driver: 'd1').hasChat, isFalse);
    expect(order('loading', driver: 'd1').summary, 'Sable · 12 m³');
    expect(order('loading', driver: 'd1').driverName, 'Rodrigue Dossou');
    expect(orderProgress('accepted') < orderProgress('driver_en_route_delivery'), isTrue);
    expect(orderProgress('completed'), 1);
  });

  testWidgets('splash par tracé : se dessine sans erreur puis se termine', (tester) async {
    var done = false;
    await tester.pumpWidget(MaterialApp(home: TraceSplash(onDone: () => done = true)));
    for (var ms = 0; ms < 4600; ms += 400) {
      await tester.pump(const Duration(milliseconds: 400));
    }
    expect(tester.takeException(), isNull);
    expect(done, isTrue);
  });

  testWidgets('splash par tracé : un appui le passe', (tester) async {
    var done = false;
    await tester.pumpWidget(MaterialApp(home: TraceSplash(onDone: () => done = true)));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.byType(TraceSplash));
    expect(done, isTrue);
  });
}
