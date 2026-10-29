/// Erreur renvoyée par l'API ou par le réseau, avec un message prêt à afficher.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.code, this.details = const {}});

  final String message;
  final int? statusCode;

  /// Code d'erreur métier du serveur (ex. `ACCOUNT_DELETION_PENDING`), quand il en donne un.
  final String? code;

  /// Corps de la réponse d'erreur (ex. `restore_until`).
  final Map<String, dynamic> details;

  @override
  String toString() => message;
}
