import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

/// Suit la position du chauffeur tant qu'il est disponible ou en mission, écran verrouillé compris.
/// Sur Android, le suivi tourne dans un service de premier plan avec une notification permanente.
/// Sur iOS, il utilise le mode « Localisation » de l'application (voir le README).
class LocationTracker {
  StreamSubscription<Position>? _subscription;

  bool get isRunning => _subscription != null;

  /// Réglages du suivi continu, adaptés à la plateforme (par défaut, celle de l'appareil).
  static LocationSettings trackingSettings({TargetPlatform? platform}) {
    const accuracy = LocationAccuracy.high;
    const distanceFilter = 25;
    switch (platform ?? defaultTargetPlatform) {
      case TargetPlatform.android:
        return AndroidSettings(
          accuracy: accuracy,
          distanceFilter: distanceFilter,
          foregroundNotificationConfig: const ForegroundNotificationConfig(
            notificationTitle: 'BenneGo Chauffeur',
            notificationText: 'Votre position est partagée pendant que vous êtes disponible ou en mission.',
            notificationChannelName: 'Suivi de position',
            enableWakeLock: true,
            setOngoing: true,
          ),
        );
      case TargetPlatform.iOS:
        return AppleSettings(
          accuracy: accuracy,
          distanceFilter: distanceFilter,
          activityType: ActivityType.automotiveNavigation,
          pauseLocationUpdatesAutomatically: false,
          allowBackgroundLocationUpdates: true,
          showBackgroundLocationIndicator: true,
        );
      default:
        return const LocationSettings(accuracy: accuracy, distanceFilter: distanceFilter);
    }
  }

  /// Demande l'accès à la localisation si nécessaire. Renvoie `false` si l'accès est refusé.
  Future<bool> ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }

  /// Vrai sur iOS quand l'accès est limité à l'utilisation de l'application : le suivi s'arrête alors à l'écran verrouillé.
  Future<bool> isLimitedToUse() async {
    if (defaultTargetPlatform != TargetPlatform.iOS) return false;
    final permission = await Geolocator.checkPermission();
    return permission == LocationPermission.whileInUse;
  }

  /// Position actuelle, ou `null` si la localisation n'est pas accessible.
  Future<Position?> currentPosition() async {
    if (!await ensurePermission()) return null;
    return Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  /// Émet une position à chaque déplacement d'environ 25 mètres, écran verrouillé compris.
  void start({required void Function(Position position) onPosition}) {
    stop();
    _subscription = Geolocator.getPositionStream(locationSettings: trackingSettings()).listen(onPosition, onError: (_) {});
  }

  void stop() {
    _subscription?.cancel();
    _subscription = null;
  }
}
