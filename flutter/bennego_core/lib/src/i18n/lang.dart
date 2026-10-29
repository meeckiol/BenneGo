import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'translator.dart';

/// Une langue proposée dans Réglages > Langue.
class AppLanguage {
  const AppLanguage(this.code, this.locale, this.name, this.english, this.hello);

  final String code;

  /// Paramètre régional des dates (noms des jours et des mois), au format du paquet intl.
  final String locale;
  final String name;
  final String english;
  final String hello;
}

/// Mêmes langues que le web (shared/i18n/engine.js).
const appLanguages = [
  AppLanguage('fr', 'fr_FR', 'Français', 'French', 'Bonjour'),
  AppLanguage('en', 'en_GB', 'English', 'English', 'Hello'),
  AppLanguage('es', 'es_ES', 'Español', 'Spanish', 'Hola'),
  AppLanguage('pt', 'pt_BR', 'Português', 'Portuguese', 'Olá'),
  AppLanguage('de', 'de_DE', 'Deutsch', 'German', 'Hallo'),
  AppLanguage('zh', 'zh_CN', '简体中文', 'Chinese, Simplified', '你好'),
  AppLanguage('ja', 'ja_JP', '日本語', 'Japanese', 'こんにちは'),
  AppLanguage('ko', 'ko_KR', '한국어', 'Korean', '안녕하세요'),
  AppLanguage('hi', 'hi_IN', 'हिन्दी', 'Hindi', 'नमस्ते'),
  AppLanguage('ms', 'ms_MY', 'Bahasa Melayu', 'Malay', 'Helo'),
];

/// Paramètre régional des dates dans la langue choisie (« 29 oct. », « 29 Oct », « 10月29日 »…).
String dateLocale() => appLanguages.firstWhere((l) => l.code == Lang.instance.code, orElse: () => appLanguages.first).locale;

/// Langue de l'application : dictionnaire chargé depuis les fichiers partagés, choix gardé sur le téléphone.
class Lang extends ChangeNotifier {
  Lang._();

  static final instance = Lang._();
  static const _key = 'bennego.langue';

  String _code = 'fr';
  Translator? _translator;
  bool _chosen = false;

  String get code => _code;

  /// Vrai si une langue a été choisie sur ce téléphone (sinon celle du compte peut s'appliquer).
  bool get chosen => _chosen;

  /// Au lancement : langue enregistrée, sinon celle du téléphone si elle est proposée, sinon le français.
  Future<void> init({FlutterSecureStorage storage = const FlutterSecureStorage()}) async {
    String? stored;
    try {
      stored = await storage.read(key: _key);
    } catch (_) {
      stored = null;
    }
    _chosen = stored != null;
    final device = WidgetsBinding.instance.platformDispatcher.locale.languageCode;
    await set(stored ?? device, persist: false, storage: storage);
  }

  Future<void> set(String code, {bool persist = true, FlutterSecureStorage storage = const FlutterSecureStorage()}) async {
    final lang = appLanguages.any((l) => l.code == code) ? code : 'fr';
    Translator? translator;
    if (lang != 'fr') {
      try {
        final raw = await rootBundle.loadString('packages/bennego_core/assets/i18n/$lang.json');
        translator = Translator(Map<String, String>.from(jsonDecode(raw) as Map));
      } catch (_) {
        translator = null; // dictionnaire absent : français
      }
    }
    _code = lang;
    _translator = translator;
    if (persist) {
      _chosen = true;
      try {
        await storage.write(key: _key, value: lang);
      } catch (_) {
        // Stockage indisponible : la langue vaut pour cette session
      }
    }
    notifyListeners();
    _rebuildAll();
  }

  /// Tout l'écran est redessiné : les textes calculés plus haut (onglets, menus) changent aussi de langue.
  static void _rebuildAll() {
    void mark(Element element) {
      element.markNeedsBuild();
      element.visitChildren(mark);
    }

    WidgetsBinding.instance.rootElement?.visitChildren(mark);
  }

  /// Pour les tests : dictionnaire fourni directement.
  @visibleForTesting
  void useDictionary(String code, Map<String, String> dict) {
    _code = code;
    _translator = code == 'fr' ? null : Translator(dict);
    notifyListeners();
    _rebuildAll();
  }

  String translate(String text) => _translator?.translate(text) ?? text;
}

/// Traduction d'un texte dans la langue choisie (les widgets Text traduisent déjà leur contenu).
String tr(String text) => Lang.instance.translate(text);

/// Rend la langue disponible aux widgets : un changement de langue redessine tout ce qui affiche du texte.
class LangScope extends InheritedNotifier<Lang> {
  LangScope({super.key, required super.child}) : super(notifier: Lang.instance);

  /// Abonne le widget aux changements de langue.
  static void watch(BuildContext context) => context.dependOnInheritedWidgetOfExactType<LangScope>();
}
