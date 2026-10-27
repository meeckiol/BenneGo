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

  Future<void> logout() => _clear();

  Future<void> _clear() async {
    await store.clear();
    api.token = null;
    _user = null;
    notifyListeners();
  }
}
