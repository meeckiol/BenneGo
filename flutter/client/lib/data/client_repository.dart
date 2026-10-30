import 'package:bennego_core/bennego_core.dart';
import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

/// Estimation de prix renvoyée par `POST /orders/estimate`.
class Estimate {
  const Estimate({
    required this.totalAmount,
    required this.distanceKm,
    required this.durationMin,
    this.amountDue,
    this.referralDiscount = 0,
    this.creditBalance = 0,
    this.creditUsed = 0,
    this.pricePerKm,
    this.breakdown = const {},
  });

  factory Estimate.fromJson(Map<String, dynamic> json) => Estimate(
        totalAmount: parseNum(json['total_amount']),
        distanceKm: parseNumOrNull(json['distance_km']),
        durationMin: parseNumOrNull(json['duration_min']),
        amountDue: parseNumOrNull(json['amount_due']),
        referralDiscount: parseNum(json['referral_discount']),
        creditBalance: parseNum(json['credit_balance']),
        creditUsed: parseNum(json['credit_used']),
        pricePerKm: parseNumOrNull(json['price_per_km']),
        breakdown: json['breakdown'] is Map ? Map<String, dynamic>.from(json['breakdown'] as Map) : const {},
      );

  final double totalAmount;

  /// Montant à payer après la réduction du filleul et le crédit utilisé.
  final double? amountDue;
  final double referralDiscount;
  final double creditBalance;
  final double creditUsed;

  double get toPay => amountDue ?? totalAmount;
  final double? distanceKm;
  final double? durationMin;

  /// Prix au km appliqué (coefficient du camion compris) et détail du prix calculé par le serveur.
  final double? pricePerKm;
  final Map<String, dynamic> breakdown;
}

/// Paramètres du widget de paiement KKiaPay d'une commande.
class CheckoutConfig {
  const CheckoutConfig({
    required this.amount,
    required this.apiKey,
    required this.sandbox,
    required this.phone,
    required this.name,
    required this.orderId,
    required this.orderNumber,
  });

  factory CheckoutConfig.fromJson(Map<String, dynamic> json) => CheckoutConfig(
        amount: parseNum(json['amount']),
        apiKey: json['api_key'] as String? ?? '',
        sandbox: json['sandbox'] as bool? ?? true,
        phone: json['phone'] as String? ?? '',
        name: json['name'] as String? ?? '',
        orderId: json['order_id'] as String? ?? '',
        orderNumber: json['order_number'] as String? ?? '',
      );

  final double amount;
  final String apiKey;
  final bool sandbox;
  final String phone;
  final String name;
  final String orderId;
  final String orderNumber;

  /// Options passées à `openKkiapayWidget`, comme dans l'interface web.
  Map<String, dynamic> get widgetOptions => {
        'amount': amount,
        'api_key': apiKey,
        'sandbox': sandbox,
        'phone': phone,
        'name': name,
        'data': orderId,
        'reason': 'BenneGo $orderNumber',
        'theme': '#D9A55B',
      };
}

/// Accès à l'API pour l'application client.
class ClientRepository {
  ClientRepository(this.api);

  final ApiClient api;

  Future<List<Order>> orders({int limit = 50}) async {
    final data = await api.get('/orders', query: {'limit': limit}) as Map<String, dynamic>;
    return (data['orders'] as List? ?? const [])
        .map((item) => Order.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Order> order(String id) async {
    final data = await api.get('/orders/$id') as Map<String, dynamic>;
    return Order.fromJson(data['order'] as Map<String, dynamic>);
  }

  Future<Estimate> estimate(Map<String, dynamic> payload) async {
    final data = await api.post('/orders/estimate', body: payload) as Map<String, dynamic>;
    return Estimate.fromJson(data);
  }

  Future<Order> createOrder(Map<String, dynamic> payload) async {
    final data = await api.post('/orders', body: payload) as Map<String, dynamic>;
    return Order.fromJson(data['order'] as Map<String, dynamic>);
  }

  Future<CheckoutConfig> checkout(String orderId) async {
    final data = await api.get('/payments/orders/$orderId/checkout') as Map<String, dynamic>;
    return CheckoutConfig.fromJson(data);
  }

  /// Enregistre le paiement KKiaPay : l'argent est bloqué en séquestre.
  Future<void> confirmPayment(String orderId, String transactionId) async {
    await api.post('/payments/orders/$orderId/confirm', body: {'transaction_id': transactionId});
  }

  /// Confirme la réception : le séquestre est libéré au chauffeur. La route dépend du type de commande.
  Future<void> confirmReception(Order order) async {
    final action = switch (order.orderType) {
      'RENTAL' => 'confirm-rental',
      'EVACUATION' => 'confirm-evacuation',
      _ => 'confirm-delivery',
    };
    await api.post('/orders/${order.id}/$action');
  }

  Future<void> dispute(String orderId, String reason, List<XFile> photos) async {
    final parts = <MultipartFile>[];
    for (final photo in photos) {
      parts.add(MultipartFile.fromBytes(await photo.readAsBytes(), filename: photo.name));
    }
    await api.postForm('/orders/$orderId/dispute', FormData.fromMap({'reason': reason, 'photos': parts}));
  }

  Future<void> cancel(String orderId) async {
    await api.post('/orders/$orderId/cancel', body: <String, dynamic>{});
  }

  Future<void> reviewDriver(String orderId, int rating, String comment) async {
    await api.post('/reviews/orders/$orderId/driver', body: {
      'rating': rating,
      if (comment.isNotEmpty) 'comment': comment,
    });
  }

  Future<Map<String, dynamic>> referral() async {
    final data = await api.get('/referrals/me');
    return data as Map<String, dynamic>;
  }

  Future<void> applyReferralCode(String code) async {
    await api.post('/referrals', body: {'referral_code': code});
  }

  /// Prix du marché publiés chaque semaine par BenneGo (prix d'un voyage par taille de camion),
  /// avec le catalogue des matériaux sous leurs noms d'ici.
  Future<Market> market() async {
    final results = await Future.wait([api.get('/barometer/catalog'), api.get('/barometer')]);
    final catalog = results[0] as Map<String, dynamic>;
    final prices = results[1] as Map<String, dynamic>;
    return Market(
      materials: (catalog['materials'] as List? ?? const []).cast<Map<String, dynamic>>(),
      trucks: (catalog['trucks'] as List? ?? const []).cast<Map<String, dynamic>>(),
      items: (prices['items'] as List? ?? const []).cast<Map<String, dynamic>>(),
    );
  }
}

/// Prix du marché : catalogue (matériaux, camions) et derniers prix publiés.
class Market {
  const Market({this.materials = const [], this.trucks = const [], this.items = const []});

  final List<Map<String, dynamic>> materials;
  final List<Map<String, dynamic>> trucks;
  final List<Map<String, dynamic>> items;

  /// Matériau du catalogue portant ce nom, s'il existe.
  Map<String, dynamic>? material(String? name) => materials.where((m) => m['name'] == name).firstOrNull;

  /// Taille de camion (6, 10 ou 12 roues) qui correspond à une benne BenneGo.
  Map<String, dynamic>? truckFor(String truckType) =>
      trucks.where((t) => (t['truck_types'] as List? ?? const []).contains(truckType)).firstOrNull;
}
