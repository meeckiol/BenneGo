import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../realtime/realtime_client.dart';
import 'chat_message.dart';

/// Messages non lus et alertes de nouveaux messages, pour toute l'application.
/// Les pastilles (onglet, conversations) et le bandeau « nouveau message » s'appuient dessus.
class ChatCenter extends ChangeNotifier {
  ChatCenter({required this.api, required this.realtime}) {
    realtime.on('chat_notify', _onNotify);
    // À chaque (re)connexion, les compteurs sont relus : des messages ont pu arriver entre-temps
    realtime.on('connect', (_) => unawaited(refresh()));
  }

  final ApiClient api;
  final RealtimeClient realtime;
  final StreamController<ChatMessage> _incoming = StreamController<ChatMessage>.broadcast();

  Map<String, int> _unread = const {};
  bool _disposed = false;

  /// Discussion affichée à l'écran : ses messages ne déclenchent ni pastille ni bandeau.
  String? openOrderId;

  /// Nouveaux messages reçus hors de la discussion ouverte, pour afficher le bandeau.
  Stream<ChatMessage> get incoming => _incoming.stream;

  int get total => _unread.values.fold(0, (sum, n) => sum + n);
  int unreadFor(String orderId) => _unread[orderId] ?? 0;

  Future<void> refresh() async {
    try {
      final data = await api.get('/orders/chat/unread') as Map<String, dynamic>;
      final rows = data['unread'] as List? ?? const [];
      _unread = {
        for (final row in rows.whereType<Map<String, dynamic>>())
          row['order_id'].toString(): (row['unread'] as num?)?.toInt() ?? 0,
      };
      _changed();
    } on ApiException {
      // Réseau indisponible : on garde les compteurs connus
    }
  }

  /// Marque une discussion comme lue (serveur et pastilles).
  Future<void> markRead(String orderId) async {
    if (_unread.containsKey(orderId)) {
      _unread = Map.of(_unread)..remove(orderId);
      _changed();
    }
    try {
      await api.post('/orders/$orderId/chat/read');
    } on ApiException {
      // Sans réseau, la lecture sera rattrapée à la prochaine ouverture
    }
  }

  /// Oublie les compteurs (déconnexion).
  void clear() {
    _unread = const {};
    openOrderId = null;
    _changed();
  }

  void _onNotify(dynamic data) {
    if (data is! Map) return;
    final message = ChatMessage.fromJson(Map<String, dynamic>.from(data));
    if (message.orderId == openOrderId) return;
    _unread = Map.of(_unread)..update(message.orderId, (n) => n + 1, ifAbsent: () => 1);
    _changed();
    if (!_incoming.isClosed) _incoming.add(message);
  }

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    realtime.off('chat_notify', _onNotify);
    unawaited(_incoming.close());
    super.dispose();
  }
}
