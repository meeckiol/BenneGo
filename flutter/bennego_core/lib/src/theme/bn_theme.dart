import 'package:flutter/material.dart';

/// Ton d'une pastille ou d'un bandeau.
enum BnTone { neutral, brand, info, success, warning, danger, violet }

/// Couleurs de BenneGo, identiques aux jetons de `shared/theme.css` (thème sombre).
abstract final class BnColors {
  static const brand = Color(0xFFF6A906);
  static const bg = Color(0xFF0B0B10);
  static const surface = Color(0xFF15151D);
  static const surface2 = Color(0xFF1C1C26);
  static const border = Color(0xFF272735);
  static const border2 = Color(0xFF353546);
  static const textStrong = Color(0xFFF5F5F8);
  static const text = Color(0xFFE4E4EC);
  static const text2 = Color(0xFFA3A3B5);
  static const text3 = Color(0xFF6F6F82);
  static const success = Color(0xFF22C55E);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFEF4444);
  static const info = Color(0xFF60A5FA);
  static const violet = Color(0xFFA78BFA);
}

/// Couleur associée à un ton.
Color toneColor(BnTone tone) => switch (tone) {
      BnTone.neutral => BnColors.text2,
      BnTone.brand => BnColors.brand,
      BnTone.info => BnColors.info,
      BnTone.success => BnColors.success,
      BnTone.warning => BnColors.warning,
      BnTone.danger => BnColors.danger,
      BnTone.violet => BnColors.violet,
    };

/// Thème Material sombre avec l'accent or du logo, comme l'interface web.
ThemeData bennegoTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: BnColors.brand,
    brightness: Brightness.dark,
    primary: BnColors.brand,
    // Texte sombre sur l'or : le blanc n'atteint que 2:1
    onPrimary: const Color(0xFF0B0B10),
    surface: BnColors.surface,
  );
  final inputBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: const BorderSide(color: BnColors.border2),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: BnColors.bg,
    appBarTheme: const AppBarTheme(
      backgroundColor: BnColors.bg,
      foregroundColor: BnColors.textStrong,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: BnColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: BnColors.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: BnColors.surface2,
      border: inputBorder,
      enabledBorder: inputBorder,
      focusedBorder: inputBorder.copyWith(borderSide: const BorderSide(color: BnColors.brand)),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: BnColors.brand,
        foregroundColor: Colors.white,
        disabledBackgroundColor: BnColors.border2,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: BnColors.surface,
      indicatorColor: BnColors.brand.withValues(alpha: 0.18),
      labelTextStyle: const WidgetStatePropertyAll(TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
    ),
  );
}
