import '../theme/bn_theme.dart';

/// Libellé et ton d'un statut de commande.
class StatusInfo {
  const StatusInfo(this.label, this.tone);

  final String label;
  final BnTone tone;
}

/// Statuts de commande, alignés sur l'interface web.
const Map<String, StatusInfo> _statusInfo = {
  'awaiting_payment': StatusInfo('À payer', BnTone.danger),
  'pending': StatusInfo('Recherche chauffeur', BnTone.warning),
  'accepted': StatusInfo('Chauffeur assigné', BnTone.info),
  'driver_en_route_pickup': StatusInfo('Chauffeur en route', BnTone.violet),
  'loading': StatusInfo('Chargement', BnTone.brand),
  'machine_operating': StatusInfo('Engin en action', BnTone.brand),
  'driver_en_route_delivery': StatusInfo('En livraison', BnTone.info),
  'delivered': StatusInfo('Livré · à confirmer', BnTone.warning),
  'validated': StatusInfo('Réception confirmée', BnTone.success),
  'completed': StatusInfo('Terminée', BnTone.success),
  'cancelled': StatusInfo('Annulée', BnTone.danger),
};

/// Statuts qui clôturent une commande.
const List<String> finalOrderStatuses = ['validated', 'completed', 'cancelled'];

/// Libellé et ton d'un statut ; un statut inconnu s'affiche tel quel.
StatusInfo statusInfo(String status) => _statusInfo[status] ?? StatusInfo(status, BnTone.neutral);
