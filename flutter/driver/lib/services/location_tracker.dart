import 'dart:async';

import 'package:geolocator/geolocator.dart';

/// Suit la position du chauffeur pendant que l'application est ouverte et qu'il est disponible ou en mission.
/// Le suivi en arrière-plan demande une configuration native supplémentaire (voir le README).
class LocationTracker {
  StreamSubscription<Position>? _subscription;

  bool get isRunning => _subscription != null;

  /// Demande l'accès à la localisation si nécessaire. Renvoie `false` si l'accès est refusé.
  Future<bool> ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }

  /// Position actuelle, ou `null` si la localisation n'est pas accessible.
  Future<Position?> currentPosition() async {
    if (!await ensurePermission()) return null;
    return Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  /// Émet une position à chaque déplacement d'environ 25 mètres.
  void start({required void Function(Position position) onPosition}) {
    stop();
    _subscription = Geolocator.getPositionStream(
      locationSettings: LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 25),
    ).listen(onPosition, onError: (_) {});
  }

  void stop() {
    _subscription?.cancel();
    _subscription = null;
  }
}
