import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../controllers/driver_controller.dart';
import 'account_screen.dart';
import 'history_screen.dart';
import 'home_screen.dart';

/// Espace chauffeur connecté : onglets Accueil, Historique et Compte.
/// Ouvre le temps réel au démarrage et le ferme à la déconnexion.
class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  late final DriverController _driver;
  StreamSubscription<String>? _messages;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _driver = context.read<DriverController>();
    _messages = _driver.messages.listen((message) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
    });
    unawaited(_driver.start());
  }

  @override
  void dispose() {
    _messages?.cancel();
    _driver.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [HomeScreen(), HistoryScreen(), AccountScreen()],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Accueil'),
          NavigationDestination(icon: Icon(Icons.history), label: 'Historique'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Compte'),
        ],
      ),
    );
  }
}
