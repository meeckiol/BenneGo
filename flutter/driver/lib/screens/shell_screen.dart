import 'dart:async';

import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../controllers/driver_controller.dart';
import 'chat_route.dart';
import 'courses_screen.dart';
import 'home_screen.dart';
import 'profile_screen.dart';

/// Espace chauffeur connecté : onglets Accueil, Courses, Messages et Profil (sans passation de commande).
/// Ouvre le temps réel au démarrage et le ferme à la déconnexion ; les nouveaux messages s'affichent partout.
class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  late final DriverController _driver;
  late final ChatCenter _chats;
  StreamSubscription<String>? _messages;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _driver = context.read<DriverController>();
    _chats = context.read<ChatCenter>();
    _messages = _driver.messages.listen((message) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
    });
    unawaited(_driver.start());
    unawaited(_chats.refresh());
  }

  @override
  void dispose() {
    _messages?.cancel();
    _driver.stop();
    _chats.clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final unread = context.watch<ChatCenter>().total;
    final user = context.watch<Session>().user;
    return ChatAlertHost(
      center: _chats,
      onOpen: (orderId) => openChatById(context, orderId),
      child: Scaffold(
        body: IndexedStack(
          index: _index,
          children: [
            const HomeScreen(),
            const CoursesScreen(),
            ConversationsScreen(
              api: context.read<ApiClient>(),
              center: _chats,
              myId: user?.id ?? '',
              myRole: 'driver',
              onOpen: (order) => openChat(context, order),
            ),
            const ProfileScreen(),
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
              label: 'Courses',
            ),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: unread > 0,
                label: Text(unread > 9 ? '9+' : '$unread'),
                child: const Icon(Icons.chat_bubble_outline),
              ),
              selectedIcon: Badge(
                isLabelVisible: unread > 0,
                label: Text(unread > 9 ? '9+' : '$unread'),
                child: const Icon(Icons.chat_bubble),
              ),
              label: 'Messages',
            ),
            const NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profil'),
          ],
        ),
      ),
    );
  }
}
