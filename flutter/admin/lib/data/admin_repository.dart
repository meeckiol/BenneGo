import 'package:bennego_core/bennego_core.dart';

int _int(Object? value) => (value as num?)?.toInt() ?? 0;

List<String> _paths(Object? value) {
  if (value is! List) return const [];
  return value
      .map((item) => item is String ? item : (item is Map ? (item['url'] ?? item['path']) : null))
      .whereType<String>()
      .toList();
}

/// Indicateurs du tableau de bord (`GET /admin/stats`).
class AdminStats {
  const AdminStats({
    required this.orders,
    required this.completed,
    required this.pending,
    required this.cancelled,
    required this.driversAvailable,
    required this.driversTotal,
    required this.clientsTotal,
    required this.gmv,
    required this.revenue,
    required this.weekly,
  });

  factory AdminStats.fromJson(Map<String, dynamic> json) {
    final orders = json['orders'] as Map<String, dynamic>? ?? const {};
    final drivers = json['drivers'] as Map<String, dynamic>? ?? const {};
    final clients = json['clients'] as Map<String, dynamic>? ?? const {};
    final revenue = json['revenue'] as Map<String, dynamic>? ?? const {};
    final weekly = (json['weekly'] as List? ?? const []).whereType<Map<String, dynamic>>();
    return AdminStats(
      orders: _int(orders['total']),
      completed: _int(orders['completed']),
      pending: _int(orders['pending']),
      cancelled: _int(orders['cancelled']),
      driversAvailable: _int(drivers['available']),
      driversTotal: _int(drivers['total']),
      clientsTotal: _int(clients['total']),
      gmv: parseNum(revenue['total_gmv']),
      revenue: parseNum(revenue['total_revenue']),
      weekly: [for (final day in weekly) WeekDay.fromJson(day)],
    );
  }

  final int orders;
  final int completed;
  final int pending;
  final int cancelled;
  final int driversAvailable;
  final int driversTotal;
  final int clientsTotal;
  final double gmv;
  final double revenue;
  final List<WeekDay> weekly;
}

/// Activité d'un jour de la semaine écoulée.
class WeekDay {
  const WeekDay({required this.label, required this.orders, required this.revenue});

  factory WeekDay.fromJson(Map<String, dynamic> json) => WeekDay(
        label: json['day'] as String? ?? '',
        orders: _int(json['commandes']),
        revenue: parseNum(json['revenus']),
      );

  final String label;
  final int orders;
  final double revenue;
}

/// Commande en litige (`GET /admin/disputes`). L'identifiant est celui de la commande.
class Dispute {
  const Dispute({
    required this.orderId,
    required this.orderNumber,
    required this.clientName,
    required this.driverName,
    required this.reason,
    required this.totalAmount,
    required this.photos,
    required this.openedAt,
  });

  factory Dispute.fromJson(Map<String, dynamic> json) => Dispute(
        orderId: json['id'] as String,
        orderNumber: json['order_number'] as String? ?? '',
        clientName: json['client_name'] as String? ?? '',
        driverName: json['driver_name'] as String? ?? '',
        reason: json['dispute_reason'] as String? ?? '',
        totalAmount: parseNum(json['total_amount']),
        photos: [..._paths(json['loading_photos']), ..._paths(json['dispute_photos'])],
        openedAt: DateTime.tryParse(json['dispute_opened_at'] as String? ?? ''),
      );

  final String orderId;
  final String orderNumber;
  final String clientName;
  final String driverName;
  final String reason;
  final double totalAmount;
  final List<String> photos;
  final DateTime? openedAt;
}

/// Reversement à un chauffeur (`GET /admin/payouts`).
class Payout {
  const Payout({
    required this.orderId,
    required this.orderNumber,
    required this.driverName,
    required this.driverAmount,
    required this.momoNumber,
    required this.momoProvider,
    required this.status,
  });

  factory Payout.fromJson(Map<String, dynamic> json) => Payout(
        orderId: json['order_id'] as String,
        orderNumber: json['order_number'] as String? ?? '',
        driverName: json['driver_name'] as String? ?? '',
        driverAmount: parseNum(json['driver_amount']),
        momoNumber: json['momo_number'] as String? ?? '',
        momoProvider: json['momo_provider'] as String? ?? '',
        status: json['payout_status'] as String? ?? '',
      );

  final String orderId;
  final String orderNumber;
  final String driverName;
  final double driverAmount;
  final String momoNumber;
  final String momoProvider;
  final String status;
}

class DriverRow {
  const DriverRow({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.isActive,
    required this.isAvailable,
    required this.truckPlate,
    required this.truckType,
    required this.rating,
    required this.totalTrips,
  });

  factory DriverRow.fromJson(Map<String, dynamic> json) => DriverRow(
        id: json['id'] as String,
        fullName: json['full_name'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        isActive: json['is_active'] as bool? ?? true,
        isAvailable: json['is_available'] as bool? ?? false,
        truckPlate: json['truck_plate'] as String? ?? '',
        truckType: json['truck_type'] as String? ?? '',
        rating: parseNumOrNull(json['rating']),
        totalTrips: _int(json['total_trips']),
      );

  final String id;
  final String fullName;
  final String phone;
  final bool isActive;
  final bool isAvailable;
  final String truckPlate;
  final String truckType;
  final double? rating;
  final int totalTrips;
}

class ClientRow {
  const ClientRow({required this.id, required this.fullName, required this.phone, required this.email, required this.isActive});

  factory ClientRow.fromJson(Map<String, dynamic> json) => ClientRow(
        id: json['id'] as String,
        fullName: json['full_name'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        email: json['email'] as String? ?? '',
        isActive: json['is_active'] as bool? ?? true,
      );

  final String id;
  final String fullName;
  final String phone;
  final String email;
  final bool isActive;
}

/// Demande de relève après une panne, et chauffeurs disponibles pour la reprendre.
class ReliefRequest {
  const ReliefRequest({
    required this.id,
    required this.orderNumber,
    required this.originalDriverName,
    required this.pickupAddress,
    required this.deliveryAddress,
    required this.breakdownReason,
  });

  factory ReliefRequest.fromJson(Map<String, dynamic> json) => ReliefRequest(
        id: json['id'] as String,
        orderNumber: json['order_number'] as String? ?? '',
        originalDriverName: json['original_driver_name'] as String? ?? '',
        pickupAddress: json['pickup_address'] as String? ?? '',
        deliveryAddress: json['delivery_address'] as String? ?? '',
        breakdownReason: json['breakdown_reason'] as String? ?? '',
      );

  final String id;
  final String orderNumber;
  final String originalDriverName;
  final String pickupAddress;
  final String deliveryAddress;
  final String breakdownReason;
}

class ReliefCandidate {
  const ReliefCandidate({required this.id, required this.fullName, required this.truckPlate, required this.truckType});

  factory ReliefCandidate.fromJson(Map<String, dynamic> json) => ReliefCandidate(
        id: json['id'] as String,
        fullName: json['full_name'] as String? ?? '',
        truckPlate: json['truck_plate'] as String? ?? tr('sans plaque'),
        truckType: json['truck_type'] as String? ?? '',
      );

  final String id;
  final String fullName;
  final String truckPlate;
  final String truckType;
}

/// Code promo (`GET /admin/promos`).
class Promo {
  const Promo({
    required this.id,
    required this.code,
    required this.discountType,
    required this.discountValue,
    required this.usageLimit,
    required this.usedCount,
    required this.isActive,
  });

  factory Promo.fromJson(Map<String, dynamic> json) => Promo(
        id: json['id'] as String,
        code: json['code'] as String? ?? '',
        discountType: json['discount_type'] as String? ?? 'percentage',
        discountValue: parseNum(json['discount_value']),
        usageLimit: _int(json['usage_limit']),
        usedCount: _int(json['used_count']),
        isActive: json['is_active'] as bool? ?? true,
      );

  final String id;
  final String code;
  final String discountType;
  final double discountValue;
  final int usageLimit;
  final int usedCount;
  final bool isActive;

  String get discountLabel => discountType == 'percentage' ? '${discountValue.round()} %' : formatFcfa(discountValue);
}

/// Discussion client ↔ chauffeur d'une commande (`GET /admin/conversations`).
class Conversation {
  const Conversation({
    required this.orderId,
    required this.orderNumber,
    required this.status,
    required this.disputeOpen,
    required this.clientName,
    required this.clientPhone,
    required this.driverName,
    required this.driverPhone,
    required this.messageCount,
    required this.lastMessage,
    required this.lastSenderRole,
    required this.lastAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) => Conversation(
        orderId: json['id'] as String,
        orderNumber: json['order_number'] as String? ?? '',
        status: json['status'] as String? ?? '',
        disputeOpen: json['dispute_status'] == 'open',
        clientName: json['client_name'] as String? ?? tr('Client'),
        clientPhone: json['client_phone'] as String?,
        driverName: json['driver_name'] as String?,
        driverPhone: json['driver_phone'] as String?,
        messageCount: _int(json['message_count']),
        lastMessage: json['last_message'] as String?,
        lastSenderRole: json['last_sender_role'] as String?,
        lastAt: DateTime.tryParse(json['last_at'] as String? ?? '')?.toLocal(),
      );

  final String orderId;
  final String orderNumber;
  final String status;
  final bool disputeOpen;
  final String clientName;
  final String? clientPhone;
  final String? driverName;
  final String? driverPhone;
  final int messageCount;
  final String? lastMessage;
  final String? lastSenderRole;
  final DateTime? lastAt;
}

/// Accès à l'API de l'espace administrateur.
class AdminRepository {
  AdminRepository(this.api);

  final ApiClient api;

  Future<AdminStats> stats() async {
    final data = await api.get('/admin/stats') as Map<String, dynamic>;
    return AdminStats.fromJson(data);
  }

  /// Discussions : `active` (en cours), `dispute` (litiges ouverts) ou `all` (toutes, y compris terminées).
  Future<List<Conversation>> conversations({String scope = 'active', String? query}) async {
    final data = await api.get('/admin/conversations', query: {
      'scope': scope,
      if (query != null && query.trim().isNotEmpty) 'q': query.trim(),
    }) as Map<String, dynamic>;
    return (data['conversations'] as List? ?? const [])
        .map((e) => Conversation.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<ChatMessage>> chat(String orderId) async {
    final data = await api.get('/orders/$orderId/chat') as Map<String, dynamic>;
    return (data['messages'] as List? ?? const []).map((e) => ChatMessage.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Message de l'assistance BenneGo : le client et le chauffeur sont prévenus.
  Future<void> sendTeamMessage(String orderId, String message) async {
    await api.post('/admin/orders/$orderId/chat', body: {'message': message});
  }

  Future<List<Dispute>> disputes() async {
    final data = await api.get('/admin/disputes') as Map<String, dynamic>;
    return (data['disputes'] as List? ?? const []).map((e) => Dispute.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Tranche un litige : `refund` rembourse le client, `release` libère le paiement au chauffeur.
  Future<void> resolveDispute(String orderId, {required String decision, String? note}) async {
    await api.post('/admin/orders/$orderId/dispute/resolve', body: {
      'decision': decision,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  Future<List<Payout>> payouts() async {
    final data = await api.get('/admin/payouts') as Map<String, dynamic>;
    return (data['payouts'] as List? ?? const []).map((e) => Payout.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> markPaid(String orderId, String reference) async {
    await api.post('/payments/orders/$orderId/mark-paid', body: {'reference': reference});
  }

  Future<void> retryPayout(String orderId) async {
    await api.post('/payments/orders/$orderId/retry-payout');
  }

  Future<void> releaseEscrow(String orderId) async {
    await api.post('/payments/orders/$orderId/release');
  }

  Future<List<Map<String, dynamic>>> orders({String? status}) async {
    final data = await api.get('/admin/orders', query: {'limit': 50, 'status': ?status}) as Map<String, dynamic>;
    return (data['orders'] as List? ?? const []).cast<Map<String, dynamic>>();
  }

  Future<List<DriverRow>> drivers() async {
    final data = await api.get('/admin/drivers') as Map<String, dynamic>;
    return (data['drivers'] as List? ?? const []).map((e) => DriverRow.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<ClientRow>> clients() async {
    final data = await api.get('/admin/clients') as Map<String, dynamic>;
    return (data['clients'] as List? ?? const []).map((e) => ClientRow.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> setActive(String userId, {required bool isActive}) async {
    await api.patch('/admin/users/$userId/activate', body: {'is_active': isActive});
  }

  Future<({List<ReliefRequest> requests, List<ReliefCandidate> candidates})> reliefs() async {
    final data = await api.get('/admin/reliefs') as Map<String, dynamic>;
    return (
      requests: (data['requests'] as List? ?? const [])
          .map((e) => ReliefRequest.fromJson(e as Map<String, dynamic>))
          .toList(),
      candidates: (data['candidates'] as List? ?? const [])
          .map((e) => ReliefCandidate.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Future<void> assignRelief(String requestId, String driverId) async {
    await api.post('/admin/reliefs/$requestId/assign', body: {'relief_driver_id': driverId});
  }

  /// Publie l'indice hebdomadaire affiché sur l'accueil client.
  Future<void> publishBarometer(Map<String, dynamic> body) async {
    await api.post('/admin/barometer', body: body);
  }

  Future<List<Map<String, dynamic>>> barometer() async {
    final data = await api.get('/barometer') as Map<String, dynamic>;
    return (data['items'] as List? ?? const []).cast<Map<String, dynamic>>();
  }

  Future<List<Promo>> promos() async {
    final data = await api.get('/admin/promos') as Map<String, dynamic>;
    return (data['promos'] as List? ?? const []).map((e) => Promo.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> savePromo(Map<String, dynamic> body, {String? id}) async {
    if (id == null) {
      await api.post('/admin/promos', body: body);
    } else {
      await api.patch('/admin/promos/$id', body: body);
    }
  }

  Future<void> deletePromo(String id) async {
    await api.delete('/admin/promos/$id');
  }

  /// Avis sur la plateforme et avis sur les chauffeurs.
  Future<Map<String, dynamic>> reviews() async {
    final data = await api.get('/admin/reviews');
    return data as Map<String, dynamic>;
  }
}

/// Semaine ISO (numéro et année) d'une date, pour publier l'indice du baromètre.
({int year, int week}) isoWeekOf(DateTime date) {
  final day = DateTime.utc(date.year, date.month, date.day);
  final thursday = day.add(Duration(days: 4 - day.weekday));
  final dayOfYear = thursday.difference(DateTime.utc(thursday.year, 1, 1)).inDays + 1;
  return (year: thursday.year, week: (dayOfYear - 1) ~/ 7 + 1);
}
