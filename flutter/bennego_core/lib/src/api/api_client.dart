import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import 'api_exception.dart';

/// Libellé de l'appareil pour la liste des appareils connectés (ex. « Application BenneGo · Android »).
String deviceLabel() {
  final os = kIsWeb
      ? 'Navigateur'
      : switch (defaultTargetPlatform) {
          TargetPlatform.android => 'Android',
          TargetPlatform.iOS => 'iPhone',
          TargetPlatform.macOS => 'Mac',
          TargetPlatform.windows => 'Windows',
          _ => 'Linux',
        };
  return 'Application BenneGo · $os';
}

/// Client HTTP de l'API : joint le jeton de session et convertit les erreurs en [ApiException].
class ApiClient {
  ApiClient({this.baseUrl = apiBaseUrl})
      : dio = Dio(
          BaseOptions(
            baseUrl: '$baseUrl/api',
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 30),
            // Nom de l'appareil affiché dans « Appareils connectés » des réglages
            headers: {'Accept': 'application/json', 'X-Device-Label': deviceLabel()},
          ),
        ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final bearer = token;
          if (bearer != null) options.headers['Authorization'] = 'Bearer $bearer';
          handler.next(options);
        },
        onError: (error, handler) {
          if (error.response?.statusCode == 401 && token != null) onUnauthorized?.call();
          handler.next(error);
        },
      ),
    );
  }

  /// Adresse racine du serveur, sans `/api` : sert aussi au temps réel et aux photos.
  final String baseUrl;
  final Dio dio;

  /// Jeton JWT courant, `null` tant que l'utilisateur n'est pas connecté.
  String? token;

  /// Appelé quand le serveur refuse le jeton (session expirée).
  void Function()? onUnauthorized;

  /// Transforme un chemin renvoyé par l'API (ex. `/uploads/x.jpg`) en URL complète.
  String resolveUrl(String path) => path.startsWith('http') ? path : '$baseUrl$path';

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _send(() => dio.get<dynamic>(path, queryParameters: query));

  Future<dynamic> post(String path, {Object? body}) =>
      _send(() => dio.post<dynamic>(path, data: body));

  Future<dynamic> patch(String path, {Object? body}) =>
      _send(() => dio.patch<dynamic>(path, data: body));

  Future<dynamic> delete(String path) => _send(() => dio.delete<dynamic>(path));

  /// Envoi multipart (photos) : Dio gère l'en-tête `multipart/form-data`.
  Future<dynamic> postForm(String path, FormData form) =>
      _send(() => dio.post<dynamic>(path, data: form));

  Future<dynamic> _send(Future<Response<dynamic>> Function() request) async {
    try {
      return (await request()).data;
    } on DioException catch (error) {
      throw toApiException(error);
    }
  }

  /// Message d'erreur lisible, tiré de la réponse du serveur quand elle existe.
  static ApiException toApiException(DioException error) {
    final status = error.response?.statusCode;
    final data = error.response?.data;
    String? message;
    if (data is Map) {
      message = data['error'] as String? ?? data['message'] as String?;
      final errors = data['errors'];
      if (message == null && errors is List && errors.isNotEmpty && errors.first is Map) {
        message = (errors.first as Map)['msg'] as String?;
      }
    }
    message ??= switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.receiveTimeout ||
      DioExceptionType.sendTimeout =>
        'Le serveur met trop de temps à répondre.',
      DioExceptionType.connectionError => 'Connexion impossible. Vérifiez votre réseau.',
      _ => 'Une erreur est survenue. Réessayez.',
    };
    return ApiException(
      message,
      statusCode: status,
      code: data is Map ? data['code'] as String? : null,
      details: data is Map ? Map<String, dynamic>.from(data) : const {},
    );
  }
}
