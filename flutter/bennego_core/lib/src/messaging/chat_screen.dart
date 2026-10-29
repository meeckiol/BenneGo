import 'dart:async';

import 'package:flutter/material.dart' hide Text;
import 'package:intl/intl.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../format/format.dart';
import '../models/order.dart';
import '../models/order_status.dart';
import '../realtime/realtime_client.dart';
import '../theme/bn_theme.dart';
import 'chat_center.dart';
import 'chat_message.dart';
import '../i18n/text.dart';
import '../i18n/lang.dart';

/// Dégradé sable doré des messages envoyés, comme l'interface web.
const _sandGradient = LinearGradient(colors: [Color(0xFFE8C38A), BnColors.brand]);

/// Discussion d'une commande en cours, côté client ou chauffeur.
/// En-tête sombre (avatar cerclé d'or, appel), barre d'avancement, bulles sable, réponses rapides.
/// La discussion se ferme d'elle-même quand la commande est terminée (les messages restent en base).
class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.order,
    required this.myId,
    required this.myRole,
    required this.api,
    required this.realtime,
    required this.center,
    required this.quickReplies,
    this.onCall,
  });

  final Order order;
  final String myId;

  /// `client` ou `driver` : détermine l'interlocuteur affiché.
  final String myRole;
  final ApiClient api;
  final RealtimeClient realtime;
  final ChatCenter center;
  final List<String> quickReplies;

  /// Appel téléphonique de l'interlocuteur (lancé par l'application, qui gère `url_launcher`).
  final void Function(String phone)? onCall;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  List<ChatMessage>? _messages;
  late String _status = widget.order.status;

  String get _orderId => widget.order.id;
  bool get _iAmClient => widget.myRole == 'client';
  String get _name =>
      (_iAmClient ? widget.order.driverName : widget.order.clientName) ?? (_iAmClient ? tr('Chauffeur') : tr('Client'));
  String? get _phone => _iAmClient ? widget.order.driverPhone : widget.order.clientPhone;

  @override
  void initState() {
    super.initState();
    widget.center.openOrderId = _orderId;
    widget.realtime.on('connect', _join);
    widget.realtime.on('chat_message', _onMessage);
    widget.realtime.on('order_status', _onStatus);
    _join(null);
    unawaited(_load());
    unawaited(widget.center.markRead(_orderId));
  }

  @override
  void dispose() {
    if (widget.center.openOrderId == _orderId) widget.center.openOrderId = null;
    widget.realtime.off('connect', _join);
    widget.realtime.off('chat_message', _onMessage);
    widget.realtime.off('order_status', _onStatus);
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _join(dynamic _) {
    widget.realtime.emit('chat_join', {'order_id': _orderId});
    widget.realtime.emit('track_order', _orderId);
  }

  Future<void> _load() async {
    try {
      final data = await widget.api.get('/orders/$_orderId/chat') as Map<String, dynamic>;
      final list = (data['messages'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ChatMessage.fromJson)
          .toList();
      if (mounted) setState(() => _messages = list);
      _scrollToEnd();
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _messages = const []);
        _snack(error.message);
      }
    }
  }

  void _onMessage(dynamic data) {
    if (data is! Map) return;
    final message = ChatMessage.fromJson(Map<String, dynamic>.from(data));
    if (message.orderId != _orderId || !mounted) return;
    setState(() => _messages = [...?_messages, message]);
    _scrollToEnd();
    if (message.senderId != widget.myId) unawaited(widget.center.markRead(_orderId));
  }

  void _onStatus(dynamic data) {
    if (data is! Map || data['order_id']?.toString() != _orderId || !mounted) return;
    final status = data['status']?.toString();
    if (status == null) return;
    if (finalOrderStatuses.contains(status)) {
      _snack('Commande terminée : la discussion est fermée.');
      Navigator.of(context).maybePop();
      return;
    }
    setState(() => _status = status);
  }

  void _send([String? quick]) {
    final message = (quick ?? _text.text).trim();
    if (message.isEmpty) return;
    if (!widget.realtime.isConnected) {
      _snack('Connexion interrompue : le message partira dès le retour du réseau. Réessayez dans un instant.');
      return;
    }
    widget.realtime.emit('chat_message', {'order_id': _orderId, 'message': message});
    if (quick == null) _text.clear();
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  void _snack(String message) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    final messages = _messages;
    return Scaffold(
      backgroundColor: BnColors.bg,
      body: Column(
        children: [
          _Header(
            name: _name,
            subtitle: '${statusInfo(_status).label} · ${widget.order.orderNumber}',
            summary: widget.order.summary,
            statusTag: statusInfo(_status).label,
            progress: orderProgress(_status),
            onCall: _phone == null || widget.onCall == null ? null : () => widget.onCall!(_phone!),
          ),
          Expanded(
            child: messages == null
                ? const Center(child: CircularProgressIndicator(color: BnColors.brand))
                : messages.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        _iAmClient
                            ? tr("Aucun message pour l'instant. Posez votre question au chauffeur.")
                            : tr("Aucun message pour l'instant. Prévenez le client de votre arrivée."),
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: BnColors.text2),
                      ),
                    ),
                  )
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
                    itemCount: messages.length,
                    itemBuilder: (context, i) {
                      final m = messages[i];
                      final showDay = i == 0 || !_sameDay(messages[i - 1].createdAt, m.createdAt);
                      return Column(
                        children: [
                          if (showDay) _DaySeparator(date: m.createdAt),
                          _Bubble(message: m, mine: m.senderId == widget.myId),
                        ],
                      );
                    },
                  ),
          ),
          _Composer(controller: _text, quickReplies: widget.quickReplies, onSend: _send),
        ],
      ),
    );
  }
}

bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

class _Header extends StatelessWidget {
  const _Header({
    required this.name,
    required this.subtitle,
    required this.summary,
    required this.statusTag,
    required this.progress,
    required this.onCall,
  });

  final String name;
  final String subtitle;
  final String summary;
  final String statusTag;
  final double progress;
  final VoidCallback? onCall;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(16, MediaQuery.paddingOf(context).top + 10, 16, 16),
      decoration: const BoxDecoration(
        color: Color(0xFF050508),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              _RoundButton(icon: Icons.arrow_back, label: tr('Retour'), onTap: () => Navigator.of(context).maybePop()),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.all(3),
                decoration: const BoxDecoration(shape: BoxShape.circle, gradient: _sandGradient),
                child: CircleAvatar(
                  radius: 22,
                  backgroundColor: const Color(0xFF050508),
                  child: Text(
                    initialsOf(name),
                    style: const TextStyle(color: Color(0xFFE8C38A), fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                    ),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Color(0xFFC9C3B8), fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (onCall != null)
                Semantics(
                  button: true,
                  label: tr('Appeler $name'),
                  child: InkWell(
                    onTap: onCall,
                    customBorder: const CircleBorder(),
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(shape: BoxShape.circle, gradient: _sandGradient),
                      child: const Icon(Icons.call, color: Color(0xFF0B0B10), size: 20),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: BoxDecoration(color: const Color(0xFF1C1D24), borderRadius: BorderRadius.circular(16)),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        summary,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Color(0xFFC9C3B8), fontSize: 13),
                      ),
                    ),
                    Text(
                      statusTag,
                      style: const TextStyle(color: Color(0xFFE8C38A), fontSize: 13, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Stack(
                    children: [
                      Container(height: 6, color: Colors.white.withValues(alpha: 0.14)),
                      FractionallySizedBox(
                        widthFactor: progress.clamp(0.0, 1.0),
                        child: Container(height: 6, decoration: const BoxDecoration(gradient: _sandGradient)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF1C1D24),
            border: Border.all(color: const Color(0xFF33343C)),
          ),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
      ),
    );
  }
}

class _DaySeparator extends StatelessWidget {
  const _DaySeparator({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final yesterday = now.subtract(const Duration(days: 1));
    final label = _sameDay(date, now)
        ? tr("Aujourd'hui")
        : _sameDay(date, yesterday)
        ? tr('Hier')
        : DateFormat('EEEE d MMMM', 'fr_FR').format(date);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: BnColors.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: BnColors.border),
        ),
        child: Text(
          label,
          style: const TextStyle(color: BnColors.text3, fontSize: 11, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.mine});

  final ChatMessage message;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final team = message.isFromTeam;
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(18),
      topRight: const Radius.circular(18),
      bottomLeft: Radius.circular(mine ? 18 : 6),
      bottomRight: Radius.circular(mine ? 6 : 18),
    );
    final textColor = mine ? const Color(0xFF0B0B10) : BnColors.textStrong;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
        decoration: BoxDecoration(
          gradient: mine ? _sandGradient : null,
          color: mine ? null : (team ? const Color(0xFF10261A) : BnColors.surface2),
          borderRadius: radius,
          border: team ? Border.all(color: const Color(0xFF3FA86A), width: 1.5) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (team)
              const Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Assistance BenneGo',
                  style: TextStyle(color: Color(0xFF5BD08D), fontSize: 11, fontWeight: FontWeight.w800),
                ),
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(message.message, style: TextStyle(color: textColor, fontSize: 15, height: 1.35)),
            ),
            const SizedBox(height: 3),
            Text(
              DateFormat('HH:mm', 'fr_FR').format(message.createdAt),
              style: TextStyle(color: textColor.withValues(alpha: 0.6), fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.quickReplies, required this.onSend});

  final TextEditingController controller;
  final List<String> quickReplies;
  final void Function([String? quick]) onSend;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: BnColors.surface,
        border: Border(top: BorderSide(color: BnColors.border)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Réponses rapides : un appui envoie le message
          SizedBox(
            height: 46,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
              itemCount: quickReplies.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, i) => ActionChip(
                label: Text(quickReplies[i]),
                onPressed: () => onSend(quickReplies[i]),
                backgroundColor: BnColors.surface2,
                side: const BorderSide(color: BnColors.border2),
                labelStyle: const TextStyle(color: BnColors.textStrong, fontSize: 13, fontWeight: FontWeight.w600),
                shape: const StadiumBorder(),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: controller,
                    minLines: 1,
                    maxLines: 4,
                    maxLength: 1000,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => onSend(),
                    decoration: InputDecoration(
                      hintText: tr('Écrire un message…'),
                      counterText: '',
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(999),
                        borderSide: BorderSide.none,
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(999),
                        borderSide: const BorderSide(color: BnColors.brand),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Semantics(
                  button: true,
                  label: tr('Envoyer'),
                  child: InkWell(
                    onTap: () => onSend(),
                    customBorder: const CircleBorder(),
                    child: Container(
                      width: 48,
                      height: 48,
                      decoration: const BoxDecoration(shape: BoxShape.circle, gradient: _sandGradient),
                      child: const Icon(Icons.send_rounded, color: Color(0xFF0B0B10)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
