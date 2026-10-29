import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'account_screen.dart';
import 'home_screen.dart';
import 'orders_screen.dart';
import 'referral_screen.dart';

/// Espace client connecté : Accueil, Commandes, Parrainage et Compte.
/// Ouvre le temps réel au lancement et le ferme à la déconnexion.
class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  late final RealtimeClient _realtime;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _realtime = context.read<RealtimeClient>();
    final token = context.read<ApiClient>().token;
    if (token != null) _realtime.connect(token);
  }

  @override
  void dispose() {
    _realtime.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [HomeScreen(), OrdersScreen(), ReferralScreen(), AccountScreen()],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Accueil'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Commandes'),
          NavigationDestination(icon: Icon(Icons.card_giftcard_outlined), selectedIcon: Icon(Icons.card_giftcard), label: 'Parrainage'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Compte'),
        ],
      ),
    );
  }
}
