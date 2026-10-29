import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

import '../theme/bn_theme.dart';
import '../i18n/text.dart';
import '../i18n/lang.dart';

/// Code PIN (empreinte salée, jamais le code lui-même) et choix de l'empreinte, dans le trousseau du téléphone.
class AppLockStore {
  AppLockStore({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  static const _pinKey = 'bennego.lock.pin';
  static const _bioKey = 'bennego.lock.biometric';
  static const pinLength = 4;

  final FlutterSecureStorage _storage;

  static String _hash(String salt, String pin) => sha256.convert(utf8.encode('$salt:$pin')).toString();

  Future<bool> hasPin() async => (await _storage.read(key: _pinKey)) != null;

  Future<void> setPin(String pin) async {
    final random = Random.secure();
    final salt = base64Url.encode(List<int>.generate(16, (_) => random.nextInt(256)));
    await _storage.write(key: _pinKey, value: '$salt:${_hash(salt, pin)}');
  }

  Future<bool> verifyPin(String pin) async {
    final stored = await _storage.read(key: _pinKey);
    if (stored == null) return false;
    final i = stored.indexOf(':');
    return i > 0 && _hash(stored.substring(0, i), pin) == stored.substring(i + 1);
  }

  Future<bool> biometricEnabled() async => (await _storage.read(key: _bioKey)) == '1';

  Future<void> setBiometric(bool enabled) =>
      enabled ? _storage.write(key: _bioKey, value: '1') : _storage.delete(key: _bioKey);

  /// Verrou retiré (ou déconnexion après trop d'essais) : code et empreinte oubliés.
  Future<void> clear() async {
    await _storage.delete(key: _pinKey);
    await _storage.delete(key: _bioKey);
  }
}

/// Empreinte ou visage du téléphone. Sans capteur (ou en test), répond simplement « non ».
class Biometrics {
  const Biometrics();

  Future<bool> available() async {
    try {
      final auth = LocalAuthentication();
      return await auth.canCheckBiometrics && (await auth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<bool> authenticate(String reason) async {
    try {
      return await LocalAuthentication().authenticate(localizedReason: reason, biometricOnly: true);
    } catch (_) {
      return false;
    }
  }
}

/// Verrouille l'espace connecté au lancement et au retour après [timeout] en arrière-plan,
/// tant qu'un code PIN est défini. Le contenu reste en mémoire derrière l'écran de verrouillage.
class AppLockGate extends StatefulWidget {
  const AppLockGate({
    super.key,
    required this.child,
    required this.onTooManyAttempts,
    this.store,
    this.biometrics = const Biometrics(),
    this.timeout = const Duration(seconds: 30),
  });

  final Widget child;

  /// Cinq codes faux de suite : on déconnecte (le verrou est effacé, il faudra le mot de passe).
  final Future<void> Function() onTooManyAttempts;
  final AppLockStore? store;
  final Biometrics biometrics;
  final Duration timeout;

  @override
  State<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends State<AppLockGate> with WidgetsBindingObserver {
  late final AppLockStore _store = widget.store ?? AppLockStore();
  bool _locked = false;
  bool _checked = false;
  DateTime? _pausedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_store.hasPin().then((has) {
      if (!mounted) return;
      setState(() {
        _locked = has;
        _checked = true;
      });
    }));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      _pausedAt ??= DateTime.now();
    } else if (state == AppLifecycleState.resumed) {
      final since = _pausedAt;
      _pausedAt = null;
      if (since != null && DateTime.now().difference(since) >= widget.timeout) {
        unawaited(_store.hasPin().then((has) {
          if (has && mounted) setState(() => _locked = true);
        }));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        if (!_checked) const Positioned.fill(child: ColoredBox(color: BnColors.bg)),
        if (_locked)
          Positioned.fill(
            child: LockScreen(
              store: _store,
              biometrics: widget.biometrics,
              onUnlocked: () => setState(() => _locked = false),
              onTooManyAttempts: () async {
                await _store.clear();
                await widget.onTooManyAttempts();
              },
            ),
          ),
      ],
    );
  }
}

/// Pavé numérique à 4 chiffres, avec l'empreinte proposée d'office quand elle est activée.
class LockScreen extends StatefulWidget {
  const LockScreen({
    super.key,
    required this.store,
    required this.onUnlocked,
    required this.onTooManyAttempts,
    this.biometrics = const Biometrics(),
  });

  final AppLockStore store;
  final Biometrics biometrics;
  final VoidCallback onUnlocked;
  final Future<void> Function() onTooManyAttempts;

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  static const _maxAttempts = 5;
  String _pin = '';
  int _failures = 0;
  bool _bio = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_initBiometric());
  }

  Future<void> _initBiometric() async {
    final enabled = await widget.store.biometricEnabled() && await widget.biometrics.available();
    if (!mounted) return;
    setState(() => _bio = enabled);
    if (enabled) await _tryBiometric();
  }

  Future<void> _tryBiometric() async {
    if (await widget.biometrics.authenticate('Déverrouiller BenneGo') && mounted) widget.onUnlocked();
  }

  Future<void> _tap(String digit) async {
    if (_pin.length >= AppLockStore.pinLength) return;
    setState(() {
      _pin += digit;
      _error = null;
    });
    if (_pin.length < AppLockStore.pinLength) return;
    if (await widget.store.verifyPin(_pin)) {
      if (mounted) widget.onUnlocked();
      return;
    }
    unawaited(HapticFeedback.heavyImpact());
    _failures++;
    if (_failures >= _maxAttempts) {
      await widget.onTooManyAttempts();
      return;
    }
    if (mounted) {
      setState(() {
        _pin = '';
        _error = 'Code incorrect · ${_maxAttempts - _failures} essai(s) restant(s)';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: BnColors.bg,
      child: SafeArea(
        child: Column(
          children: [
            const Spacer(),
            const Icon(Icons.lock_outline, color: BnColors.brand, size: 40),
            const SizedBox(height: 14),
            const Text('BenneGo est verrouillé',
                style: TextStyle(color: BnColors.textStrong, fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(_error ?? tr('Saisissez votre code PIN'),
                style: TextStyle(color: _error == null ? BnColors.text2 : BnColors.danger)),
            const SizedBox(height: 22),
            PinDots(length: _pin.length),
            const Spacer(),
            PinPad(
              onDigit: _tap,
              onBackspace: () => setState(() => _pin = _pin.isEmpty ? '' : _pin.substring(0, _pin.length - 1)),
              extra: _bio
                  ? IconButton(
                      onPressed: _tryBiometric,
                      icon: const Icon(Icons.fingerprint, color: BnColors.brand, size: 34),
                      tooltip: tr('Empreinte'),
                    )
                  : null,
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

/// Points du code saisi.
class PinDots extends StatelessWidget {
  const PinDots({super.key, required this.length});

  final int length;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < AppLockStore.pinLength; i++)
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 9),
            width: 15,
            height: 15,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: i < length ? BnColors.brand : Colors.transparent,
              border: Border.all(color: i < length ? BnColors.brand : BnColors.border2, width: 2),
            ),
          ),
      ],
    );
  }
}

/// Pavé numérique 3 × 4 ; [extra] prend la case en bas à gauche (empreinte).
class PinPad extends StatelessWidget {
  const PinPad({super.key, required this.onDigit, required this.onBackspace, this.extra});

  final void Function(String digit) onDigit;
  final VoidCallback onBackspace;
  final Widget? extra;

  @override
  Widget build(BuildContext context) {
    Widget key(String d) => SizedBox(
          width: 78,
          height: 66,
          child: TextButton(
            onPressed: () => onDigit(d),
            style: TextButton.styleFrom(shape: const CircleBorder(), foregroundColor: BnColors.textStrong),
            child: Text(d, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w600)),
          ),
        );
    Widget row(List<Widget> children) => Row(mainAxisAlignment: MainAxisAlignment.center, children: children);
    return Column(
      children: [
        row([key('1'), key('2'), key('3')]),
        row([key('4'), key('5'), key('6')]),
        row([key('7'), key('8'), key('9')]),
        row([
          SizedBox(width: 78, height: 66, child: Center(child: extra)),
          key('0'),
          SizedBox(
            width: 78,
            height: 66,
            child: IconButton(
              onPressed: onBackspace,
              icon: const Icon(Icons.backspace_outlined, color: BnColors.text2),
              tooltip: tr('Effacer'),
            ),
          ),
        ]),
      ],
    );
  }
}

/// Création d'un code : saisi deux fois. Renvoie vrai si le code est enregistré.
Future<bool> showPinSetup(BuildContext context, AppLockStore store) async {
  final pin = await Navigator.of(context).push<String>(MaterialPageRoute(builder: (_) => const _PinSetupScreen()));
  if (pin == null) return false;
  await store.setPin(pin);
  return true;
}

class _PinSetupScreen extends StatefulWidget {
  const _PinSetupScreen();

  @override
  State<_PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends State<_PinSetupScreen> {
  String _pin = '';
  String? _first;
  String? _error;

  void _tap(String d) {
    if (_pin.length >= AppLockStore.pinLength) return;
    setState(() {
      _pin += d;
      _error = null;
    });
    if (_pin.length < AppLockStore.pinLength) return;
    if (_first == null) {
      setState(() {
        _first = _pin;
        _pin = '';
      });
    } else if (_first == _pin) {
      Navigator.of(context).pop(_pin);
    } else {
      setState(() {
        _first = null;
        _pin = '';
        _error = 'Les deux codes sont différents, recommencez';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Code PIN')),
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(),
            Text(_first == null ? tr('Choisissez un code à 4 chiffres') : tr('Confirmez votre code'),
                style: const TextStyle(color: BnColors.textStrong, fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(_error ?? tr('Il vous sera demandé à l\'ouverture de BenneGo'),
                style: TextStyle(color: _error == null ? BnColors.text2 : BnColors.danger)),
            const SizedBox(height: 22),
            PinDots(length: _pin.length),
            const Spacer(),
            PinPad(
              onDigit: _tap,
              onBackspace: () => setState(() => _pin = _pin.isEmpty ? '' : _pin.substring(0, _pin.length - 1)),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
