import 'package:bennego_core/bennego_core.dart';
import 'package:bennego_driver/domain/mission_steps.dart';
import 'package:flutter_test/flutter_test.dart';

Order _order({String type = 'MATERIAL', required String status, String? loadingVolume, List<String> pod = const []}) =>
    Order.fromJson({
      'id': 'o1',
      'order_type': type,
      'status': status,
      'loading_volume_m3': loadingVolume,
      'pod_photos': pod,
    });

void main() {
  group('carrière vers chantier', () {
    test('démarre par le départ vers la carrière', () {
      expect(nextMissionStep(_order(status: 'accepted'))?.nextStatus, 'driver_en_route_pickup');
    });

    test('au chargement sans volume enregistré, on ouvre le formulaire', () {
      final step = nextMissionStep(_order(status: 'loading'));
      expect(step?.kind, MissionStepKind.loading);
      expect(step?.nextStatus, isNull);
    });

    test('après le chargement, on peut partir livrer', () {
      final step = nextMissionStep(_order(status: 'loading', loadingVolume: '12.5'));
      expect(step?.nextStatus, 'driver_en_route_delivery');
    });

    test('livré sans photos de livraison : envoi des photos', () {
      expect(nextMissionStep(_order(status: 'delivered'))?.kind, MissionStepKind.pod);
    });

    test('livré avec photos : rien à faire, on attend le client', () {
      expect(nextMissionStep(_order(status: 'delivered', pod: ['/uploads/a.jpg'])), isNull);
    });
  });

  test('location d\'engin : la fin des heures envoie vers livré', () {
    expect(nextMissionStep(_order(type: 'RENTAL', status: 'machine_operating'))?.nextStatus, 'delivered');
  });
}
