import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/login_screen.dart';
import 'screens/shell_screen.dart';

/// Espace administrateur BenneGo : connexion ou tableau de bord selon la session.
class AdminApp extends StatelessWidget {
  const AdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      localizationsDelegates: bnLocalizationsDelegates,
      title: 'BenneGo Admin',
      debugShowCheckedModeBanner: false,
      theme: bennegoTheme(),
      home: const _AuthGate(),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    if (session.isRestoring) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (session.user == null) return const LoginScreen();
    // Code PIN / empreinte demandés à l'ouverture et au retour d'arrière-plan, si activés dans les réglages
    return AppLockGate(onTooManyAttempts: session.logoutLocal, child: const ShellScreen());
  }
}
