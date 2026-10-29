import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/login_screen.dart';
import 'screens/shell_screen.dart';

/// Application chauffeur : splash animé par tracé du logo, puis connexion ou espace chauffeur selon la session.
class DriverApp extends StatefulWidget {
  const DriverApp({super.key});

  @override
  State<DriverApp> createState() => _DriverAppState();
}

class _DriverAppState extends State<DriverApp> {
  bool _splash = true;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      localizationsDelegates: bnLocalizationsDelegates,
      title: 'BenneGo Chauffeur',
      debugShowCheckedModeBanner: false,
      theme: bennegoTheme(),
      home: const _AuthGate(),
      builder: (context, child) {
        // Animations réduites dans les réglages du téléphone : pas de splash
        final show = _splash && !MediaQuery.disableAnimationsOf(context);
        return Stack(
          children: [
            child ?? const SizedBox.shrink(),
            if (show) Positioned.fill(child: TraceSplash(onDone: () => setState(() => _splash = false))),
          ],
        );
      },
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
