import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

/// API factice : réglages en mémoire, pour tester l'écran sans serveur.
class _FakeApi extends ApiClient {
  _FakeApi() : super(baseUrl: 'http://localhost');

  Map<String, dynamic>? lastPatch;
  Map<String, dynamic> settings = {
    'notifications': {
      'push': true,
      'order_updates': true,
      'messages': true,
      'promotions': true,
      'sound': true,
      'vibration': true,
      'quiet_hours': {'enabled': false, 'start': '22:00', 'end': '06:00'},
    },
    'privacy': {'show_photo': true, 'hide_phone': false},
  };

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async => switch (path) {
        '/account/settings' => {'settings': settings, 'categories': ['order_updates', 'messages', 'promotions']},
        '/account/sessions' => {'sessions': <dynamic>[]},
        _ => <String, dynamic>{},
      };

  @override
  Future<dynamic> patch(String path, {Object? body}) async {
    lastPatch = body as Map<String, dynamic>;
    final n = Map<String, dynamic>.from(settings['notifications'] as Map)
      ..addAll(Map<String, dynamic>.from((lastPatch!['notifications'] as Map?) ?? {}));
    settings = {...settings, 'notifications': n};
    return {'settings': settings};
  }
}

void main() {
  test('seuls les réglages modifiés partent au serveur', () {
    final saved = {
      'notifications': {'messages': true, 'quiet_hours': {'enabled': false, 'start': '22:00'}},
      'privacy': {'hide_phone': false},
    };
    final draft = {
      'notifications': {'messages': false, 'quiet_hours': {'enabled': true, 'start': '22:00'}},
      'privacy': {'hide_phone': false},
    };
    final changes = settingsDiff(saved, draft);
    expect(changes.map((c) => c.key), ['notifications.messages', 'notifications.quiet_hours.enabled']);
    expect(settingsPatch(changes), {
      'notifications': {'messages': false, 'quiet_hours': {'enabled': true}},
    });
  });

  test('heures calmes et décision d\'alerte', () {
    final s = {
      'notifications': {
        'messages': true,
        'promotions': false,
        'sound': true,
        'vibration': true,
        'quiet_hours': {'enabled': true, 'start': '22:00', 'end': '06:00'},
      },
    };
    expect(inQuietHours(s, DateTime(2026, 10, 29, 23, 30)), isTrue);
    expect(inQuietHours(s, DateTime(2026, 10, 29, 6, 0)), isFalse);
    final night = alertPolicyFor(s, 'messages', now: DateTime(2026, 10, 29, 2));
    expect((night.show, night.sound, night.vibrate), (true, false, false));
    final urgent = alertPolicyFor(s, 'messages', urgent: true, now: DateTime(2026, 10, 29, 2));
    expect(urgent.sound, isTrue);
    expect(alertPolicyFor(s, 'promotions').show, isFalse);
    expect(alertPolicyFor(null, 'messages').sound, isTrue);
  });

  test('code PIN : seule l\'empreinte salée est gardée, et vérifiée', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final store = AppLockStore();
    expect(await store.hasPin(), isFalse);
    await store.setPin('2580');
    expect(await store.hasPin(), isTrue);
    expect(await store.verifyPin('2580'), isTrue);
    expect(await store.verifyPin('0000'), isFalse);
    await store.clear();
    expect(await store.hasPin(), isFalse);
  });

  testWidgets('écran de verrouillage : code faux puis bon code', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});
    final store = AppLockStore();
    await store.setPin('1234');
    var unlocked = false;
    await tester.pumpWidget(MaterialApp(
      home: LockScreen(store: store, onUnlocked: () => unlocked = true, onTooManyAttempts: () async {}),
    ));
    await tester.pumpAndSettle();
    for (final d in ['9', '9', '9', '9']) {
      await tester.tap(find.text(d));
      await tester.pumpAndSettle();
    }
    expect(find.textContaining('Code incorrect'), findsOneWidget);
    for (final d in ['1', '2', '3', '4']) {
      await tester.tap(find.text(d));
      await tester.pumpAndSettle();
    }
    expect(unlocked, isTrue);
  });

  testWidgets('réglages : la barre compte les modifications, Annuler les retire, Valider les envoie', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});
    await tester.binding.setSurfaceSize(const Size(420, 1400));
    final api = _FakeApi();
    await tester.pumpWidget(MaterialApp(
      theme: bennegoTheme(),
      home: SettingsScreen(api: api, role: 'client', phone: '+22997000003', onPhoneChanged: (_) {}, onDeleted: (_) async {}),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Réglages'), findsOneWidget);
    expect(find.text('Supprimer mon compte'), findsOneWidget);

    await tester.tap(find.text('Notifications'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(Switch).at(3)); // Promotions
    await tester.pumpAndSettle();
    expect(find.text('1 modification'), findsOneWidget);
    await tester.tap(find.text('Annuler'));
    await tester.pumpAndSettle();
    expect(find.text('1 modification'), findsNothing);

    await tester.tap(find.byType(Switch).at(3));
    await tester.tap(find.byType(Switch).at(4)); // Son
    await tester.pumpAndSettle();
    expect(find.text('2 modifications'), findsOneWidget);
    await tester.tap(find.text('Valider'));
    await tester.pumpAndSettle();
    expect(api.lastPatch, {
      'notifications': {'promotions': false, 'sound': false},
    });
    expect(find.text('2 modifications'), findsNothing);
  });

  testWidgets('admin : ni confidentialité ni suppression du compte', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});
    await tester.pumpWidget(MaterialApp(
      home: SettingsScreen(api: _FakeApi(), role: 'admin', phone: '+22997000001', onPhoneChanged: (_) {}, onDeleted: (_) async {}),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Confidentialité'), findsNothing);
    expect(find.text('Supprimer mon compte'), findsNothing);
    expect(find.text('Sécurité'), findsOneWidget);
  });
}
