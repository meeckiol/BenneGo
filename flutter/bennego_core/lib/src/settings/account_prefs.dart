import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../i18n/lang.dart';

/// Ce que l'application peut faire pour une alerte : rien, un bandeau sans son, ou bandeau + son + vibration.
class AlertPolicy {
  const AlertPolicy({required this.show, required this.sound, required this.vibrate});

  static const all = AlertPolicy(show: true, sound: true, vibrate: true);

  final bool show;
  final bool sound;
  final bool vibrate;
}

int _minutes(String hhmm) {
  final parts = hhmm.split(':');
  return (int.tryParse(parts.first) ?? 0) * 60 + (int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0);
}

/// Heures calmes à l'heure du téléphone (au Bénin, la même que celle du serveur). Plage passant minuit acceptée.
bool inQuietHours(Map<String, dynamic>? settings, [DateTime? now]) {
  final quiet = (settings?['notifications'] as Map?)?['quiet_hours'] as Map?;
  if (quiet == null || quiet['enabled'] != true) return false;
  final time = now ?? DateTime.now();
  final local = time.hour * 60 + time.minute;
  final start = _minutes('${quiet['start'] ?? '22:00'}');
  final end = _minutes('${quiet['end'] ?? '06:00'}');
  if (start == end) return false;
  return start < end ? local >= start && local < end : local >= start || local < end;
}

/// Décision pour une alerte de ce type selon les réglages ; une alerte urgente (course en cours) sonne quand même.
AlertPolicy alertPolicyFor(Map<String, dynamic>? settings, String category, {bool urgent = false, DateTime? now}) {
  final n = settings?['notifications'] as Map?;
  if (n == null) return AlertPolicy.all;
  final show = n[category] != false;
  final sound = show && n['sound'] != false && (urgent || !inQuietHours(settings, now));
  return AlertPolicy(show: show, sound: sound, vibrate: sound && n['vibration'] != false);
}

/// Réglages du compte gardés en mémoire après la connexion, pour les alertes dans l'application.
class AccountPrefs {
  AccountPrefs._();

  static final instance = AccountPrefs._();

  Map<String, dynamic>? settings;

  Future<void> load(ApiClient api) async {
    try {
      final data = await api.get('/account/settings') as Map<String, dynamic>;
      settings = Map<String, dynamic>.from(data['settings'] as Map);
      // Téléphone sans langue choisie : on reprend celle du compte
      final language = settings?['language'] as String?;
      if (language != null && !Lang.instance.chosen && language != Lang.instance.code) {
        await Lang.instance.set(language, persist: false);
      }
    } on ApiException {
      // Réglages indisponibles : les alertes gardent leur comportement par défaut
    }
  }

  AlertPolicy policy(String category, {bool urgent = false}) => alertPolicyFor(settings, category, urgent: urgent);
}
