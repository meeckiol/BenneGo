import 'package:bennego_core/bennego_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Order.fromJson lit les décimaux envoyés en chaîne par PostgreSQL', () {
    final order = Order.fromJson({
      'id': 'a1',
      'order_number': 'BG-2026-0001',
      'order_type': 'MATERIAL',
      'status': 'accepted',
      'pickup_lat': '6.36540000',
      'pickup_lng': '2.41830000',
      'delivery_lat': '6.40000000',
      'delivery_lng': '2.40000000',
      'quantity_m3': '12.50',
      'total_amount': '45000.00',
      'driver_amount': '40500.00',
      'distance_km': null,
      'pod_photos': ['/uploads/a.jpg'],
      'photos': [
        {'kind': 'loading', 'url': '/uploads/b.jpg'},
      ],
      'loading_volume_m3': null,
      'dispute_status': 'open',
    });

    expect(order.pickupLat, closeTo(6.3654, 1e-6));
    expect(order.quantityM3, 12.5);
    expect(order.totalAmount, 45000);
    expect(order.distanceKm, isNull);
    expect(order.loadingVolumeM3, isNull);
    expect(order.isLoadingRecorded, isFalse);
    expect(order.isDisputeOpen, isTrue);
    expect(order.isFinal, isFalse);
    expect(order.podPhotos, ['/uploads/a.jpg']);
    expect(order.photos.single.kind, 'loading');
  });

  test('statusInfo renvoie le libellé français, et le statut brut si inconnu', () {
    expect(statusInfo('accepted').label, 'Chauffeur assigné');
    expect(statusInfo('validated').tone, BnTone.success);
    expect(statusInfo('statut_inconnu').label, 'statut_inconnu');
  });
}
