/// Message d'une discussion de commande (client, chauffeur ou assistance BenneGo).
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.orderId,
    required this.senderId,
    required this.senderName,
    required this.senderRole,
    required this.message,
    required this.createdAt,
    this.orderNumber,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    id: json['id']?.toString() ?? '',
    orderId: json['order_id']?.toString() ?? '',
    senderId: json['sender_id']?.toString() ?? '',
    senderName: json['sender_name'] as String? ?? '',
    senderRole: json['sender_role'] as String? ?? '',
    message: json['message'] as String? ?? '',
    createdAt: DateTime.tryParse(json['created_at'] as String? ?? '')?.toLocal() ?? DateTime.now(),
    orderNumber: json['order_number'] as String?,
  );

  final String id;
  final String orderId;
  final String senderId;
  final String senderName;

  /// `client`, `driver` ou `admin` (assistance BenneGo).
  final String senderRole;
  final String message;
  final DateTime createdAt;

  /// Présent dans les alertes `chat_notify`, pour le bandeau.
  final String? orderNumber;

  bool get isFromTeam => senderRole == 'admin';
}
