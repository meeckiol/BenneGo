import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import 'app_user.dart';
import 'token_store.dart';

/// Session de l'utilisateur connecté : connexion, restauration au lancement et déconnexion.
class Session extends ChangeNotifier {
  Session({required this.api, required this.store}) {
    api.onUnauthorized = () => unawaited(_clear());
  }

  final ApiClient api;
  final TokenStore store;

  AppUser? _user;
  bool _restoring = true;

  AppUser? get user => _user;

  /// Vrai pendant la lecture de la session enregistrée au lancement.
  bool get isRestoring => _restoring;

  /// Restaure la session enregistrée, si le jeton est encore accepté par le serveur.
  Future<void> restore() async {
    final token = await store.read();
    if (token != null) {
      api.token = token;
      try {
        final data = await api.get('/auth/me') as Map<String, dynamic>;
        _user = AppUser.fromJson(data['user'] as Map<String, dynamic>);
      } on ApiException catch (error) {
        // Jeton refusé : on repart de zéro. Une erreur réseau garde le jeton pour la prochaine fois.
        if (error.statusCode == 401 || error.statusCode == 403) await _clear();
      }
    }
    _restoring = false;
    notifyListeners();
  }

  /// Connecte l'utilisateur. [requiredRole] refuse les comptes qui n'ont pas accès à l'application.
  Future<AppUser> login({required String phone, required String password, String? requiredRole}) async {
    final data = await api.post('/auth/login', body: {'phone': phone, 'password': password}) as Map<String, dynamic>;
    return _open(data, requiredRole);
  }

  Future<AppUser> _open(Map<String, dynamic> data, String? requiredRole) async {
    final user = AppUser.fromJson(data['user'] as Map<String, dynamic>);
    if (requiredRole != null && user.role != requiredRole) {
      throw const ApiException('Ce compte ne peut pas utiliser cette application.');
    }
    final token = data['token'] as String;
    await store.write(token);
    api.token = token;
    _user = user;
    notifyListeners();
    return user;
  }

  /// Reprend un compte supprimé il y a moins de 60 jours (numéro + mot de passe), puis connecte.
  Future<AppUser> restoreAccount({required String phone, required String password, String? requiredRole}) async {
    final data = await api.post('/auth/restore', body: {'phone': phone, 'password': password}) as Map<String, dynamic>;
    return _open(data, requiredRole);
  }

  /// Déconnexion : la session de cet appareil est fermée côté serveur (elle quitte « Appareils connectés »).
  Future<void> logout() async {
    if (api.token != null) {
      try {
        await api.post('/account/logout');
      } on ApiException {
        // Hors ligne ou session déjà fermée : on déconnecte quand même ce téléphone
      }
    }
    await _clear();
  }

  /// Déconnexion locale seulement : la session est déjà fermée par le serveur (compte supprimé).
  Future<void> logoutLocal() => _clear();

  /// Après un changement de numéro dans les réglages.
  void updatePhone(String phone) {
    final user = _user;
    if (user == null) return;
    _user = user.copyWith(phone: phone);
    notifyListeners();
  }

  Future<void> _clear() async {
    await store.clear();
    api.token = null;
    _user = null;
    notifyListeners();
  }
}
