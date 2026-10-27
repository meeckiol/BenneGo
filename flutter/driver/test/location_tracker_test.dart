import 'package:bennego_driver/services/location_tracker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

void main() {
  test('Android : suivi dans un service de premier plan avec notification permanente', () {
    final settings = LocationTracker.trackingSettings(platform: TargetPlatform.android);

    expect(settings, isA<AndroidSettings>());
    final notification = (settings as AndroidSettings).foregroundNotificationConfig;
    expect(notification, isNotNull);
    expect(notification!.setOngoing, isTrue);
    expect(settings.distanceFilter, 25);
  });

  test('iOS : mises à jour maintenues en arrière-plan, avec l\'indicateur de localisation', () {
    final settings = LocationTracker.trackingSettings(platform: TargetPlatform.iOS);

    expect(settings, isA<AppleSettings>());
    final apple = settings as AppleSettings;
    expect(apple.allowBackgroundLocationUpdates, isTrue);
    expect(apple.showBackgroundLocationIndicator, isTrue);
    expect(apple.pauseLocationUpdatesAutomatically, isFalse);
  });

  test('autres plateformes : réglages de base, sans service de premier plan', () {
    final settings = LocationTracker.trackingSettings(platform: TargetPlatform.linux);

    expect(settings, isNot(isA<AndroidSettings>()));
    expect(settings, isNot(isA<AppleSettings>()));
    expect(settings.distanceFilter, 25);
  });
}
