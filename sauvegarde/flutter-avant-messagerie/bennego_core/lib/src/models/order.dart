import '../format/format.dart';
import 'order_status.dart';

/// Photo rattachée à une commande : chargement, pesée, litige ou livraison.
class OrderPhoto {
  const OrderPhoto({required this.kind, required this.path});

  factory OrderPhoto.fromJson(Map<String, dynamic> json) => OrderPhoto(
        kind: json['kind'] as String? ?? '',
        path: json['url'] as String? ?? json['path'] as String? ?? '',
      );

  final String kind;

  /// Chemin renvoyé par l'API, par exemple `/uploads/abc.jpg`.
  final String path;
}

/// Commande, telle que renvoyée par l'API.
class Order {
  const Order({
    required this.id,
    required this.orderNumber,
    required this.orderType,
    required this.status,
    required this.paymentStatus,
    required this.pickupAddress,
    required this.deliveryAddress,
    required this.pickupLat,
    required this.pickupLng,
    required this.deliveryLat,
    required this.deliveryLng,
    required this.quantityM3,
    required this.totalAmount,
    required this.driverAmount,
    required this.distanceKm,
    required this.createdAt,
    required this.clientId,
    required this.driverId,
    required this.loadingVolumeM3,
    required this.weighbridgeNetKg,
    required this.disputeStatus,
    required this.disputeReason,
    required this.clientRating,
    required this.podPhotos,
    required this.photos,
  });

  factory Order.fromJson(Map<String, dynamic> json) => Order(
        id: json['id'] as String,
        orderNumber: json['order_number'] as String? ?? '',
        orderType: json['order_type'] as String? ?? 'MATERIAL',
        status: json['status'] as String? ?? '',
        paymentStatus: json['payment_status'] as String? ?? '',
        pickupAddress: json['pickup_address'] as String? ?? '',
        deliveryAddress: json['delivery_address'] as String? ?? '',
        pickupLat: parseNum(json['pickup_lat']),
        pickupLng: parseNum(json['pickup_lng']),
        deliveryLat: parseNum(json['delivery_lat']),
        deliveryLng: parseNum(json['delivery_lng']),
        quantityM3: parseNum(json['quantity_m3']),
        totalAmount: parseNum(json['total_amount']),
        driverAmount: parseNum(json['driver_amount']),
        distanceKm: parseNumOrNull(json['distance_km']),
        createdAt: DateTime.tryParse(json['created_at'] as String? ?? ''),
        clientId: json['client_id'] as String?,
        driverId: json['driver_id'] as String?,
        loadingVolumeM3: parseNumOrNull(json['loading_volume_m3']),
        weighbridgeNetKg: parseNumOrNull(json['weighbridge_net_kg']),
        disputeStatus: json['dispute_status'] as String?,
        disputeReason: json['dispute_reason'] as String?,
        clientRating: (json['client_rating'] as num?)?.toInt(),
        podPhotos: _photoPaths(json['pod_photos']),
        photos: _orderPhotos(json['photos']),
      );

  final String id;
  final String orderNumber;
  final String orderType;
  final String status;
  final String paymentStatus;
  final String pickupAddress;
  final String deliveryAddress;
  final double pickupLat;
  final double pickupLng;
  final double deliveryLat;
  final double deliveryLng;
  final double quantityM3;
  final double totalAmount;
  final double driverAmount;
  final double? distanceKm;
  final DateTime? createdAt;
  final String? clientId;
  final String? driverId;
  final double? loadingVolumeM3;
  final double? weighbridgeNetKg;
  final String? disputeStatus;
  final String? disputeReason;
  final int? clientRating;
  final List<String> podPhotos;
  final List<OrderPhoto> photos;

  bool get isFinal => finalOrderStatuses.contains(status);
  bool get isDisputeOpen => disputeStatus == 'open';
  bool get isLoadingRecorded => loadingVolumeM3 != null;
  String get statusLabel => statusInfo(status).label;
}

List<String> _photoPaths(Object? value) {
  if (value is! List) return const [];
  return value
      .map((item) => item is String ? item : (item is Map ? (item['url'] ?? item['path']) : null))
      .whereType<String>()
      .toList();
}

List<OrderPhoto> _orderPhotos(Object? value) {
  if (value is! List) return const [];
  return value.whereType<Map<String, dynamic>>().map(OrderPhoto.fromJson).toList();
}
