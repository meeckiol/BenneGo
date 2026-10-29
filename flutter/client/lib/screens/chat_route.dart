import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

/// Réponses rapides du client, au-dessus du champ de saisie.
const clientQuickReplies = ['Je suis sur place', 'Où êtes-vous ?', 'Appelez-moi', 'Merci !'];

/// Ouvre la discussion avec le chauffeur d'une commande.
Future<void> openChat(BuildContext context, Order order) {
  final session = context.read<Session>();
  return Navigator.of(context).push(MaterialPageRoute<void>(
    builder: (_) => ChatScreen(
      order: order,
      myId: session.user?.id ?? '',
      myRole: 'client',
      api: context.read<ApiClient>(),
      realtime: context.read<RealtimeClient>(),
      center: context.read<ChatCenter>(),
      quickReplies: clientQuickReplies,
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
