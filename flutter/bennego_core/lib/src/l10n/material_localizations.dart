import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:intl/intl.dart';

import '../i18n/lang.dart';

/// Textes des composants Material (bouton Retour, copier / coller, sélecteurs de date et d'heure) dans la
/// langue choisie : sans cela, Flutter les affiche en anglais quelle que soit la langue de l'application.
class BnMaterialLocalizations extends DefaultMaterialLocalizations {
  const BnMaterialLocalizations();

  DateFormat _f(String pattern) => DateFormat(pattern, dateLocale());

  @override
  String get backButtonTooltip => tr('Retour');
  @override
  String get closeButtonTooltip => tr('Fermer');
  @override
  String get deleteButtonTooltip => tr('Supprimer');
  @override
  String get moreButtonTooltip => tr('Plus');
  @override
  String get showMenuTooltip => tr('Afficher le menu');
  @override
  String get openAppDrawerTooltip => tr('Ouvrir le menu');
  @override
  String get searchFieldLabel => tr('Rechercher');
  @override
  String get cancelButtonLabel => tr('Annuler');
  @override
  String get okButtonLabel => tr('Valider');
  @override
  String get copyButtonLabel => tr('Copier');
  @override
  String get cutButtonLabel => tr('Couper');
  @override
  String get pasteButtonLabel => tr('Coller');
  @override
  String get selectAllButtonLabel => tr('Tout sélectionner');
  @override
  String get shareButtonLabel => tr('Partager');

  // Sélecteur de date
  @override
  String get datePickerHelpText => tr('Choisir une date');
  @override
  String get dateInputLabel => tr('Saisir une date');
  @override
  String get dateHelpText => tr('jj/mm/aaaa');
  @override
  String get unspecifiedDate => tr('Date');
  @override
  String get invalidDateFormatLabel => tr('Format de date invalide.');
  @override
  String get dateOutOfRangeLabel => tr('Date hors des limites.');
  @override
  String get calendarModeButtonLabel => tr('Afficher le calendrier');
  @override
  String get inputDateModeButtonLabel => tr('Saisir au clavier');
  @override
  String formatYear(DateTime date) => _f('y').format(date);
  @override
  String formatCompactDate(DateTime date) => DateFormat('dd/MM/yyyy').format(date);
  @override
  String formatShortDate(DateTime date) => _f('yMMMd').format(date);
  @override
  String formatMediumDate(DateTime date) => _f('MMMEd').format(date);
  @override
  String formatFullDate(DateTime date) => _f('yMMMMEEEEd').format(date);
  @override
  String formatMonthYear(DateTime date) => _f('yMMMM').format(date);
  @override
  String formatShortMonthDay(DateTime date) => _f('MMMd').format(date);
  @override
  DateTime? parseCompactDate(String? inputString) {
    if (inputString == null) return null;
    try {
      return DateFormat('dd/MM/yyyy').parseStrict(inputString.trim());
    } on FormatException {
      return null;
    }
  }

  // Initiales des jours, du dimanche au samedi (le 1er janvier 2023 est un dimanche)
  @override
  List<String> get narrowWeekdays => [for (var i = 0; i < 7; i++) _f('EEEEE').format(DateTime(2023, 1, 1 + i))];
  // intl compte depuis le lundi (0), Flutter depuis le dimanche (0)
  @override
  int get firstDayOfWeekIndex => (_f('d').dateSymbols.FIRSTDAYOFWEEK + 1) % 7;

  // Sélecteur d'heure
  @override
  String get timePickerDialHelpText => tr("Choisir l'heure");
  @override
  String get timePickerInputHelpText => tr("Saisir l'heure");
  @override
  String get timePickerHourLabel => tr('Heure');
  @override
  String get timePickerMinuteLabel => tr('Minute');
  @override
  String get invalidTimeLabel => tr('Heure invalide');
  @override
  String get dialModeButtonLabel => tr('Afficher le cadran');
  @override
  String get inputTimeModeButtonLabel => tr('Saisir au clavier');
}

class _BnMaterialLocalizationsDelegate extends LocalizationsDelegate<MaterialLocalizations> {
  const _BnMaterialLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => true;

  @override
  Future<MaterialLocalizations> load(Locale locale) => SynchronousFuture(const BnMaterialLocalizations());

  @override
  bool shouldReload(_BnMaterialLocalizationsDelegate old) => false;
}

/// À passer à `MaterialApp(localizationsDelegates: …)` dans chaque application.
const bnLocalizationsDelegates = <LocalizationsDelegate<dynamic>>[
  _BnMaterialLocalizationsDelegate(),
  DefaultWidgetsLocalizations.delegate,
];
