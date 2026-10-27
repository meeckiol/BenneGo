import 'package:bennego_core/bennego_core.dart';

/// Ce que le chauffeur doit faire ensuite : changer de statut, saisir le chargement ou envoyer les photos.
enum MissionStepKind { status, loading, pod }

/// Action proposée sur une mission.
class MissionStep {
  const MissionStep(this.label, {this.kind = MissionStepKind.status, this.nextStatus});

  final String label;
  final MissionStepKind kind;

  /// Statut à envoyer au serveur ; `null` pour les étapes qui ouvrent un formulaire.
  final String? nextStatus;
}

/// Étape suivante selon le type de commande, le statut et l'état du chargement, ou `null` s'il n'y a rien à faire.
///
/// Libellés et ordre repris du parcours de l'interface web conducteur.
MissionStep? nextMissionStep(Order order) {
  final loaded = order.isLoadingRecorded;
  final noPod = order.podPhotos.isEmpty;
  return switch (order.orderType) {
    'RENTAL' => _rental(order.status, noPod),
    'EVACUATION' => _evacuation(order.status, loaded, noPod),
    _ => _material(order.status, loaded, noPod),
  };
}

/// Statuts pendant lesquels le chauffeur peut signaler une panne.
const List<String> breakdownStatuses = [
  'accepted',
  'driver_en_route_pickup',
  'loading',
  'machine_operating',
  'driver_en_route_delivery',
];

MissionStep? _material(String status, bool loaded, bool noPod) => switch (status) {
      'accepted' => const MissionStep('Partir vers la carrière', nextStatus: 'driver_en_route_pickup'),
      'driver_en_route_pickup' => const MissionStep("Confirmer l'arrivée à la carrière", nextStatus: 'loading'),
      'loading' when !loaded => const MissionStep('Enregistrer le chargement', kind: MissionStepKind.loading),
      'loading' => const MissionStep('Chargement terminé - Partir livrer', nextStatus: 'driver_en_route_delivery'),
      'driver_en_route_delivery' => const MissionStep('Confirmer la livraison', nextStatus: 'delivered'),
      'delivered' when noPod => const MissionStep('Envoyer les photos de livraison', kind: MissionStepKind.pod),
      _ => null,
    };

MissionStep? _rental(String status, bool noPod) => switch (status) {
      'accepted' => const MissionStep("Acheminer l'engin vers le chantier", nextStatus: 'driver_en_route_pickup'),
      'driver_en_route_pickup' =>
        const MissionStep('Arrivé sur site - Démarrer les travaux', nextStatus: 'machine_operating'),
      'machine_operating' => const MissionStep("Fin des heures - Confirmer l'opération", nextStatus: 'delivered'),
      'delivered' when noPod => const MissionStep('Envoyer les photos de livraison', kind: MissionStepKind.pod),
      _ => null,
    };

MissionStep? _evacuation(String status, bool loaded, bool noPod) => switch (status) {
      'accepted' => const MissionStep('Partir vers le chantier à nettoyer', nextStatus: 'driver_en_route_pickup'),
      'driver_en_route_pickup' =>
        const MissionStep('Arrivé au chantier - Chargement des gravats', nextStatus: 'loading'),
      'loading' when !loaded => const MissionStep('Enregistrer le chargement', kind: MissionStepKind.loading),
      'loading' => const MissionStep('Camion chargé - Partir vers la décharge', nextStatus: 'driver_en_route_delivery'),
      'driver_en_route_delivery' =>
        const MissionStep('Confirmer le déversement à la décharge', nextStatus: 'delivered'),
      'delivered' when noPod => const MissionStep('Envoyer les photos de livraison', kind: MissionStepKind.pod),
      _ => null,
    };
