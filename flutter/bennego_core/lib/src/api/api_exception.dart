/// Erreur renvoyée par l'API ou par le réseau, avec un message prêt à afficher.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}
