import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import '../i18n/lang.dart';

/// Charge les formats français (dates). À appeler une fois au démarrage de chaque application.
Future<void> initFrenchFormats() => initializeDateFormatting('fr_FR');

final NumberFormat _amountFormat = NumberFormat('#,##0', 'fr_FR');
final DateFormat _dateTimeFormat = DateFormat('dd/MM/yyyy HH:mm', 'fr_FR');

/// Montant en FCFA, par exemple `45 000 FCFA`.
String formatFcfa(num amount) => tr('${_amountFormat.format(amount)} FCFA');

/// Date et heure locales, par exemple `24/10/2026 14:30`.
String formatDateTime(DateTime? value) => value == null ? '—' : _dateTimeFormat.format(value.toLocal());

/// Nombre décimal lu depuis du JSON. PostgreSQL renvoie souvent les décimaux sous forme de chaîne.
double parseNum(Object? value) => parseNumOrNull(value) ?? 0;

double? parseNumOrNull(Object? value) => switch (value) {
      num n => n.toDouble(),
      String s => double.tryParse(s),
      _ => null,
    };

/// Initiales de deux mots au maximum, par exemple `Rodrigue Dossou` donne `RD`.
String initialsOf(String name) {
  final letters = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .take(2)
      .map((part) => part[0].toUpperCase())
      .join();
  return letters.isEmpty ? 'B' : letters;
}
