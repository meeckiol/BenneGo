import 'package:flutter/material.dart';

import 'dashboard_screen.dart';
import 'more_screen.dart';
import 'operations_screen.dart';
import 'people_screen.dart';
import 'package:bennego_core/bennego_core.dart';

/// Espace administrateur : tableau de bord, opérations, utilisateurs et outils.
class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [DashboardScreen(), OperationsScreen(), PeopleScreen(), MoreScreen()],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: tr('Bord')),
          NavigationDestination(icon: Icon(Icons.account_balance_outlined), selectedIcon: Icon(Icons.account_balance), label: tr('Opérations')),
          NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: tr('Utilisateurs')),
          NavigationDestination(icon: Icon(Icons.apps_outlined), selectedIcon: Icon(Icons.apps), label: tr('Outils')),
        ],
      ),
    );
  }
}
