import 'package:bennego_core/bennego_core.dart';

/// Étapes de la frise de suivi, dans l'ordre du parcours.
const List<String> timelineStatuses = [
  'awaiting_payment',
  'pending',
  'accepted',
  'driver_en_route_pickup',
  'loading',
  'driver_en_route_delivery',
  'delivered',
  'validated',
];

/// Rang de l'étape courante dans la frise. L'engin en action est rangé avec le chargement.
int timelineIndex(String status) {
  if (status == 'machine_operating') return timelineStatuses.indexOf('loading');
  if (status == 'completed') return timelineStatuses.length - 1;
  final index = timelineStatuses.indexOf(status);
  return index < 0 ? 0 : index;
}

/// Actions proposées au client selon l'état de la commande.
class OrderActions {
  const OrderActions(this.order);

  final Order order;

  bool get canPay => order.status == 'awaiting_payment';
  bool get canConfirmReception => order.status == 'delivered' && !order.isDisputeOpen;
  bool get canDispute => order.status == 'delivered' && !order.isDisputeOpen;
  bool get canReview => (order.status == 'validated' || order.status == 'completed') && order.clientRating == null;
  bool get canCancel => const ['awaiting_payment', 'pending', 'accepted'].contains(order.status);
  bool get showTracking =>
      order.driverId != null &&
      const ['accepted', 'driver_en_route_pickup', 'loading', 'machine_operating', 'driver_en_route_delivery']
          .contains(order.status);

  bool get hasAny => canPay || canConfirmReception || canDispute || canReview || canCancel;
}
