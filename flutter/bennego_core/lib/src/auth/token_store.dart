import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Jeton de session stocké dans le trousseau du téléphone (Keychain iOS, Keystore Android).
class TokenStore {
  TokenStore({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'bennego.token';

  final FlutterSecureStorage _storage;

  Future<String?> read() => _storage.read(key: _key);

  Future<void> write(String token) => _storage.write(key: _key, value: token);

  Future<void> clear() => _storage.delete(key: _key);
}
