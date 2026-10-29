import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

/// Réponses rapides du chauffeur, au-dessus du champ de saisie.
const driverQuickReplies = ["J'arrive", 'Je suis devant le chantier', 'Je suis à la carrière', 'Appelez-moi', 'Merci !'];

/// Ouvre la discussion avec le client d'une course.
Future<void> openChat(BuildContext context, Order order) {
  final session = context.read<Session>();
  return Navigator.of(context).push(MaterialPageRoute<void>(
    builder: (_) => ChatScreen(
      order: order,
      myId: session.user?.id ?? '',
      myRole: 'driver',
      api: context.read<ApiClient>(),
      realtime: context.read<RealtimeClient>(),
      center: context.read<ChatCenter>(),
      quickReplies: driverQuickReplies,
      onCall: (phone) => launchUrl(Uri(scheme: 'tel', path: phone)),
    ),
  ));
}

/// Ouvre une discussion depuis son numéro de commande (bandeau « nouveau message »).
Future<void> openChatById(BuildContext context, String orderId) async {
  final api = context.read<ApiClient>();
  try {
    final data = await api.get('/orders/$orderId') as Map<String, dynamic>;
    if (!context.mounted) return;
    await openChat(context, Order.fromJson(data['order'] as Map<String, dynamic>));
  } on ApiException catch (error) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
  }
}
