import 'package:bennego_client/domain/order_flow.dart';
import 'package:bennego_core/bennego_core.dart';
import 'package:flutter_test/flutter_test.dart';

Order _order({String status = 'pending', String? disputeStatus, String? driverId, int? clientRating}) =>
    Order.fromJson({
      'id': 'o1',
      'status': status,
      'dispute_status': disputeStatus,
      'driver_id': driverId,
      'client_rating': clientRating,
    });

void main() {
  test('la frise place l\'engin en action avec le chargement', () {
    expect(timelineIndex('machine_operating'), timelineIndex('loading'));
    expect(timelineIndex('validated'), timelineStatuses.length - 1);
    expect(timelineIndex('completed'), timelineStatuses.length - 1);
  });

  test('une commande à payer propose le paiement et l\'annulation', () {
    final actions = OrderActions(_order(status: 'awaiting_payment'));
    expect(actions.canPay, isTrue);
    expect(actions.canCancel, isTrue);
    expect(actions.canConfirmReception, isFalse);
    expect(actions.showTracking, isFalse);
  });

  test('une livraison en attente ouvre réception et litige, sauf si un litige est déjà ouvert', () {
    expect(OrderActions(_order(status: 'delivered')).canConfirmReception, isTrue);
    expect(OrderActions(_order(status: 'delivered')).canDispute, isTrue);
    final disputed = OrderActions(_order(status: 'delivered', disputeStatus: 'open'));
    expect(disputed.canConfirmReception, isFalse);
    expect(disputed.canDispute, isFalse);
  });

  test('l\'avis n\'est proposé qu\'une fois, après validation', () {
    expect(OrderActions(_order(status: 'validated')).canReview, isTrue);
    expect(OrderActions(_order(status: 'validated', clientRating: 5)).canReview, isFalse);
    expect(OrderActions(_order(status: 'pending')).canReview, isFalse);
  });

  test('le suivi GPS n\'est visible que pendant la course, avec un chauffeur assigné', () {
    expect(OrderActions(_order(status: 'driver_en_route_delivery', driverId: 'd1')).showTracking, isTrue);
    expect(OrderActions(_order(status: 'driver_en_route_delivery')).showTracking, isFalse);
    expect(OrderActions(_order(status: 'validated', driverId: 'd1')).showTracking, isFalse);
  });
}
