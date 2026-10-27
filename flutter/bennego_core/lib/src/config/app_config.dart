/// Adresse du serveur BenneGo, surchargeable à la compilation :
/// `flutter run --dart-define=API_URL=http://10.0.2.2:3000` (émulateur Android),
/// `flutter build appbundle --dart-define=API_URL=https://api.votre-domaine.bj` (production).
const String apiBaseUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:3000');
