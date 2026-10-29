import 'dart:async';

import 'package:bennego_core/bennego_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';

import '../services/location_tracker.dart';

/// Gains et statistiques du chauffeur, tirés de `GET /drivers/me/summary`.
class DriverSummary {
  const DriverSummary({
    required this.isAvailable,
    required this.rating,
    required this.ratingCount,
    required this.totalTrips,
    required this.paid,
    required this.pendingPayout,
    required this.awaitingConfirmation,
    required this.truckPlate,
    required this.truckType,
  });

  factory DriverSummary.fromJson(Map<String, dynamic> json) {
    final earnings = json['earnings'] as Map<String, dynamic>? ?? const {};
    return DriverSummary(
      isAvailable: json['is_available'] as bool? ?? false,
      rating: parseNumOrNull(json['rating']),
      ratingCount: (json['rating_count'] as num?)?.toInt() ?? 0,
      totalTrips: (json['total_trips'] as num?)?.toInt() ?? 0,
      paid: parseNum(earnings['paid']),
      pendingPayout: parseNum(earnings['pending_payout']),
      awaitingConfirmation: parseNum(earnings['awaiting_confirmation']),
      truckPlate: json['truck_plate'] as String?,
      truckType: json['truck_type'] as String?,
    );
  }

  final bool isAvailable;
  final double? rating;
  final int ratingCount;
  final int totalTrips;
  final double paid;
  final double pendingPayout;
  final double awaitingConfirmation;
  final String? truckPlate;
  final String? truckType;
}

/// Commande proposée au chauffeur (événement temps réel `new_order`).
class IncomingOffer {
  const IncomingOffer({
    required this.orderId,
    required this.orderNumber,
    required this.pickupAddress,
    required this.deliveryAddress,
    required this.driverAmount,
    required this.distanceKm,
  });

  factory IncomingOffer.fromJson(Map<String, dynamic> json) => IncomingOffer(
        orderId: json['order_id'] as String,
        orderNumber: json['order_number'] as String? ?? '',
        pickupAddress: json['pickup_address'] as String? ?? '',
        deliveryAddress: json['delivery_address'] as String? ?? '',
        driverAmount: parseNum(json['driver_amount']),
        distanceKm: parseNumOrNull(json['distance_km']),
      );

  final String orderId;
  final String orderNumber;
  final String pickupAddress;
  final String deliveryAddress;
  final double driverAmount;
  final double? distanceKm;
}

/// État et actions du tableau de bord conducteur : API REST, temps réel et suivi GPS.
class DriverController extends ChangeNotifier {
  DriverController({required this.api, required this.realtime, required this.session, LocationTracker? tracker})
      : _tracker = tracker ?? LocationTracker() {
    realtime.on('connect', (_) {
      if (_available) realtime.emit('driver_available');
    });
    realtime.on('availability_updated', (data) {
      _available = data is Map && data['is_available'] == true;
      _syncTracking();
      notifyListeners();
    });
    realtime.on('new_order', (data) {
      if (activeOrder != null) return;
      offer = IncomingOffer.fromJson(_asMap(data));
      notifyListeners();
    });
    realtime.on('order_taken', (data) {
      if (offer?.orderId == _asMap(data)['order_id']) {
        offer = null;
        notifyListeners();
      }
    });
    for (final event in ['order_reassigned', 'dispute_opened', 'order_status']) {
      realtime.on(event, (_) => unawaited(refresh()));
    }
    realtime.on('error_message', (data) {
      _notify(_asMap(data)['error'] as String? ?? 'Une erreur est survenue');
      unawaited(refresh());
    });
  }

  final ApiClient api;
  final RealtimeClient realtime;
  final Session session;
  final LocationTracker _tracker;

  final StreamController<String> _messages = StreamController<String>.broadcast();

  DriverSummary? summary;
  Order? activeOrder;
  IncomingOffer? offer;
  bool loading = true;
  bool busy = false;
  bool locationDenied = false;
  bool backgroundLimited = false;
  bool _available = false;
  bool _startingTracker = false;
  bool _disposed = false;

  /// Messages destinés aux bandeaux de l'interface (succès, erreurs).
  Stream<String> get messages => _messages.stream;

  bool get isAvailable => _available;
  bool get isConnected => realtime.isConnected;

  /// Ouvre le temps réel et charge le tableau de bord, après la connexion.
  Future<void> start() async {
    final token = api.token;
    if (token != null) realtime.connect(token);
    await refresh();
  }

  /// Ferme le temps réel et oublie les données de la session (déconnexion).
  void stop() {
    _tracker.stop();
    realtime.disconnect();
    summary = null;
    activeOrder = null;
    offer = null;
    _available = false;
    loading = true;
    notifyListeners();
  }

  Future<void> refresh() async {
    try {
      final results = await Future.wait<dynamic>([
        api.get('/drivers/me/summary'),
        api.get('/orders', query: {'limit': 50}),
      ]);
      summary = DriverSummary.fromJson(results[0] as Map<String, dynamic>);
      _available = summary!.isAvailable;
      if (_available && realtime.isConnected) realtime.emit('driver_available');
      final orders = _ordersFrom(results[1]);
      final current = orders.where((o) => o.driverId == session.user?.id && !o.isFinal).toList();
      activeOrder = current.isEmpty ? null : await _fetchOrder(current.first.id);
    } on ApiException catch (error) {
      _notify(error.message);
    }
    loading = false;
    _syncTracking();
    _changed();
  }

  /// Historique : courses terminées ou clôturées par ce chauffeur.
  Future<List<Order>> history() async {
    final orders = _ordersFrom(await api.get('/orders', query: {'limit': 100}));
    final me = session.user?.id;
    return orders.where((o) => o.driverId == me && o.isFinal).toList();
  }

  void setAvailable(bool value) {
    _available = value;
    realtime.emit(value ? 'driver_available' : 'driver_unavailable');
    _syncTracking();
    _changed();
  }

  Future<void> acceptOffer() async {
    final current = offer;
    if (current == null) return;
    await _run(() async {
      await api.patch('/orders/${current.orderId}/accept');
      offer = null;
      activeOrder = await _fetchOrder(current.orderId);
      _available = false;
      realtime.emit('driver_unavailable');
      _notify('Course acceptée');
    });
  }

  void dismissOffer() {
    offer = null;
    _changed();
  }

  Future<void> advance(String nextStatus) => _runOnActive((order) async {
        await api.patch('/orders/${order.id}/status', body: {'status': nextStatus});
      });

  Future<void> submitLoading({
    required double volumeM3,
    int? weighbridgeKg,
    required List<XFile> photos,
    XFile? weighbridgeTicket,
  }) =>
      _runOnActive((order) async {
        final form = FormData.fromMap({
          'volume_m3': volumeM3.toString(),
          if (weighbridgeKg != null) 'weighbridge_net_kg': weighbridgeKg.toString(),
          'photos': await _multipart(photos),
          if (weighbridgeTicket != null) 'weighbridge': await _multipart([weighbridgeTicket]),
        });
        await api.postForm('/orders/${order.id}/loading', form);
        _notify('Chargement enregistré');
      });

  Future<void> submitPod(List<XFile> photos) => _runOnActive((order) async {
        final form = FormData.fromMap({'photos': await _multipart(photos)});
        await api.postForm('/orders/${order.id}/pod', form);
        _notify('Photos de livraison envoyées');
      });

  Future<void> reportBreakdown(String reason) => _runOnActive((order) async {
        final position = await _tracker.currentPosition();
        if (position == null) {
          throw const ApiException('Position GPS indisponible : activez la localisation.');
        }
        await api.post('/orders/${order.id}/breakdown', body: {
          'reason': reason,
          'lat': position.latitude,
          'lng': position.longitude,
        });
        _notify('Panne signalée : BenneGo cherche une benne de réserve');
      });

  /// Exécute une action sur la mission en cours, puis recharge son état.
  Future<void> _runOnActive(Future<void> Function(Order order) action) async {
    final order = activeOrder;
    if (order == null) return;
    await _run(() async {
      await action(order);
      await _reloadActive(order.id);
    });
  }

  Future<void> _run(Future<void> Function() action) async {
    busy = true;
    _changed();
    try {
      await action();
    } on ApiException catch (error) {
      _notify(error.message);
    } finally {
      busy = false;
      _changed();
    }
  }

  Future<void> _reloadActive(String orderId) async {
    final order = await _fetchOrder(orderId);
    activeOrder = order.isFinal ? null : order;
    _syncTracking();
  }

  Future<Order> _fetchOrder(String id) async {
    final data = await api.get('/orders/$id') as Map<String, dynamic>;
    return Order.fromJson(data['order'] as Map<String, dynamic>);
  }

  List<Order> _ordersFrom(dynamic data) {
    final list = (data as Map<String, dynamic>)['orders'] as List? ?? const [];
    return list.map((item) => Order.fromJson(item as Map<String, dynamic>)).toList();
  }

  /// Suivi GPS actif tant que le chauffeur est disponible ou en mission.
  void _syncTracking() {
    if (!_available && activeOrder == null) {
      backgroundLimited = false;
      _tracker.stop();
      return;
    }
    if (_tracker.isRunning || _startingTracker) return;
    unawaited(_startTracking());
  }

  Future<void> _startTracking() async {
    _startingTracker = true;
    final granted = await _tracker.ensurePermission();
    _startingTracker = false;
    locationDenied = !granted;
    backgroundLimited = granted && await _tracker.isLimitedToUse();
    if (granted) {
      _tracker.start(onPosition: (position) {
        realtime.emit('driver_location', {
          'lat': position.latitude,
          'lng': position.longitude,
          if (activeOrder != null) 'order_id': activeOrder!.id,
        });
      });
    }
    _changed();
  }

  void _notify(String message) {
    if (!_messages.isClosed) _messages.add(message);
  }

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _tracker.stop();
    realtime.disconnect();
    unawaited(_messages.close());
    super.dispose();
  }
}

Map<String, dynamic> _asMap(dynamic data) => Map<String, dynamic>.from(data as Map);

Future<List<MultipartFile>> _multipart(List<XFile> files) async => [
      for (final file in files) MultipartFile.fromBytes(await file.readAsBytes(), filename: file.name),
    ];
