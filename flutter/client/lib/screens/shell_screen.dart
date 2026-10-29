import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'account_screen.dart';
import 'chat_route.dart';
import 'home_screen.dart';
import 'orders_screen.dart';

/// Espace client connecté : Accueil, Commandes, Messages et Profil (le parrainage est dans le profil).
/// Ouvre le temps réel au lancement et le ferme à la déconnexion ; les nouveaux messages s'affichent partout.
class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  late final RealtimeClient _realtime;
  late final ChatCenter _chats;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _realtime = context.read<RealtimeClient>();
    _chats = context.read<ChatCenter>();
    final token = context.read<ApiClient>().token;
    if (token != null) _realtime.connect(token);
    _chats.refresh();
  }

  @override
  void dispose() {
    _realtime.disconnect();
    _chats.clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final unread = context.watch<ChatCenter>().total;
    final user = context.watch<Session>().user;
    Widget messagesIcon(IconData icon) => Badge(
          isLabelVisible: unread > 0,
          label: Text(unread > 9 ? '9+' : '$unread'),
          child: Icon(icon),
        );
    return ChatAlertHost(
      center: _chats,
      onOpen: (orderId) => openChatById(context, orderId),
      child: Scaffold(
        body: IndexedStack(
          index: _index,
          children: [
            const HomeScreen(),
            const OrdersScreen(),
            ConversationsScreen(
              api: context.read<ApiClient>(),
              center: _chats,
              myId: user?.id ?? '',
              myRole: 'client',
              onOpen: (order) => openChat(context, order),
            ),
            const AccountScreen(),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (index) => setState(() => _index = index),
          destinations: [
            const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Accueil'),
            const NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined),
              selectedIcon: Icon(Icons.receipt_long),
              label: 'Commandes',
            ),
            NavigationDestination(
              icon: messagesIcon(Icons.chat_bubble_outline),
              selectedIcon: messagesIcon(Icons.chat_bubble),
              label: 'Messages',
            ),
            const NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profil'),
          ],
        ),
      ),
    );
  }
}
