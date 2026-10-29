import 'dart:async';

import 'package:flutter/material.dart' hide Text;
import 'package:flutter/services.dart';

import '../format/format.dart';
import '../settings/account_prefs.dart';
import 'chat_center.dart';
import 'chat_message.dart';
import '../i18n/text.dart';
import '../i18n/lang.dart';

/// Bandeau « nouveau message » en haut de l'écran, avec son et vibration, où qu'on soit dans l'application.
/// Un appui ouvre la discussion. À placer autour du contenu de l'espace connecté.
class ChatAlertHost extends StatefulWidget {
  const ChatAlertHost({super.key, required this.center, required this.onOpen, required this.child});

  final ChatCenter center;
  final void Function(String orderId) onOpen;
  final Widget child;

  @override
  State<ChatAlertHost> createState() => _ChatAlertHostState();
}

class _ChatAlertHostState extends State<ChatAlertHost> {
  StreamSubscription<ChatMessage>? _sub;
  ChatMessage? _shown;
  Timer? _hide;

  @override
  void initState() {
    super.initState();
    _sub = widget.center.incoming.listen(_show);
    // Réglages du compte : son, vibration, heures calmes et type « Messages »
    unawaited(AccountPrefs.instance.load(widget.center.api));
  }

  @override
  void dispose() {
    _sub?.cancel();
    _hide?.cancel();
    super.dispose();
  }

  void _show(ChatMessage message) {
    if (!mounted) return;
    // Messages coupés : pastille seulement ; heures calmes ou son coupé : bandeau sans son
    final policy = AccountPrefs.instance.policy('messages');
    if (!policy.show) return;
    if (policy.sound) unawaited(SystemSound.play(SystemSoundType.alert));
    if (policy.vibrate) unawaited(HapticFeedback.mediumImpact());
    setState(() => _shown = message);
    _hide?.cancel();
    _hide = Timer(const Duration(seconds: 5), () {
      if (mounted) setState(() => _shown = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final message = _shown;
    return Stack(
      children: [
        widget.child,
        Positioned(
          left: 12,
          right: 12,
          top: MediaQuery.paddingOf(context).top + 8,
          child: IgnorePointer(
            ignoring: message == null,
            child: AnimatedSlide(
              offset: message == null ? const Offset(0, -1.6) : Offset.zero,
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOut,
              child: AnimatedOpacity(
                opacity: message == null ? 0 : 1,
                duration: const Duration(milliseconds: 220),
                child: message == null
                    ? const SizedBox.shrink()
                    : _Banner(
                        message: message,
                        onTap: () {
                          setState(() => _shown = null);
                          widget.onOpen(message.orderId);
                        },
                      ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.message, required this.onTap});

  final ChatMessage message;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name = message.senderName.isEmpty ? tr('Nouveau message') : message.senderName;
    return Material(
      color: const Color(0xFF050508),
      elevation: 10,
      shadowColor: Colors.black54,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(colors: [Color(0xFFE8C38A), Color(0xFFD9A55B)]),
                ),
                child: Text(
                  initialsOf(name),
                  style: const TextStyle(color: Color(0xFF0B0B10), fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: name,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          if (message.orderNumber != null)
                            TextSpan(
                              text: ' · ${message.orderNumber}',
                              style: const TextStyle(color: Color(0xFFC9C3B8)),
                            ),
                        ],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                    ),
                    Text(
                      message.message,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Color(0xFFE5E1D8), fontSize: 13),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chat_bubble_outline, color: Color(0xFFE8C38A), size: 18),
            ],
          ),
        ),
      ),
    );
  }
}
