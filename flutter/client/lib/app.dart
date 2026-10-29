import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/login_screen.dart';
import 'screens/shell_screen.dart';

/// Application client : splash animé du camion (comme le web), puis connexion ou espace client selon la session.
class ClientApp extends StatefulWidget {
  const ClientApp({super.key});

  @override
  State<ClientApp> createState() => _ClientAppState();
}

class _ClientAppState extends State<ClientApp> {
  bool _splash = true;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BenneGo',
      debugShowCheckedModeBanner: false,
      theme: bennegoTheme(),
      home: const _AuthGate(),
      builder: (context, child) {
        // Animations réduites dans les réglages du téléphone : pas de splash
        final show = _splash && !MediaQuery.disableAnimationsOf(context);
        return Stack(
          children: [
            child ?? const SizedBox.shrink(),
            if (show) Positioned.fill(child: TruckSplash(onDone: () => setState(() => _splash = false))),
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
    return session.user == null ? const LoginScreen() : const ShellScreen();
  }
}
