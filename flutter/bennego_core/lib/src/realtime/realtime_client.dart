import 'package:socket_io_client/socket_io_client.dart' as io;

/// Connexion temps réel (Socket.IO) authentifiée par le jeton de session.
/// Les écouteurs enregistrés avant la connexion sont rattachés dès qu'elle est ouverte.
class RealtimeClient {
  RealtimeClient({required this.baseUrl});

  final String baseUrl;
  final Map<String, List<void Function(dynamic data)>> _handlers = {};
  io.Socket? _socket;

  bool get isConnected => _socket?.connected ?? false;

  /// Ouvre la connexion ; le serveur vérifie le jeton à la poignée de main.
  void connect(String token) {
    disconnect();
    final socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableReconnection()
          .disableAutoConnect()
          .build(),
    );
    _handlers.forEach((event, handlers) {
      for (final handler in handlers) {
        socket.on(event, handler);
      }
    });
    socket.connect();
    _socket = socket;
  }

  /// Écoute un événement du serveur ; l'écouteur survit aux reconnexions.
  void on(String event, void Function(dynamic data) handler) {
    _handlers.putIfAbsent(event, () => []).add(handler);
    _socket?.on(event, handler);
  }

  /// Retire un écouteur enregistré avec [on], par exemple à la fermeture d'un écran.
  void off(String event, void Function(dynamic data) handler) {
    _handlers[event]?.remove(handler);
    _socket?.off(event, handler);
  }

  void emit(String event, [Object? data]) => _socket?.emit(event, data);

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }
}
