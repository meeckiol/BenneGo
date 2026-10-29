import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../format/format.dart';
import '../models/order.dart';
import '../theme/bn_theme.dart';
import 'chat_center.dart';
import 'chat_message.dart';

/// Onglet « Messages » : une conversation par commande en cours avec chauffeur (design A du web).
/// Les discussions disparaissent une fois la commande terminée.
class ConversationsScreen extends StatefulWidget {
  const ConversationsScreen({
    super.key,
    required this.api,
    required this.center,
    required this.myId,
    required this.myRole,
    required this.onOpen,
  });

  final ApiClient api;
  final ChatCenter center;
  final String myId;

  /// `client` ou `driver`.
  final String myRole;

  /// Ouvre la discussion d'une commande ; la liste se recharge au retour.
  final Future<void> Function(Order order) onOpen;

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _Thread {
  const _Thread(this.order, this.last);

  final Order order;
  final ChatMessage? last;
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  List<_Thread>? _threads;
  String? _error;

  bool get _iAmClient => widget.myRole == 'client';

  @override
  void initState() {
    super.initState();
    widget.center.addListener(_onUnreadChanged);
    unawaited(_load());
  }

  @override
  void dispose() {
    widget.center.removeListener(_onUnreadChanged);
    super.dispose();
  }

  // Un nouveau message arrive : la liste se met à jour (dernier message, ordre)
  int _lastTotal = 0;
  void _onUnreadChanged() {
    final total = widget.center.total;
    if (total > _lastTotal) unawaited(_load());
    _lastTotal = total;
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    try {
      final data = await widget.api.get('/orders', query: {'limit': 100}) as Map<String, dynamic>;
      final orders = (data['orders'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(Order.fromJson)
          .where((o) => o.hasChat && (_iAmClient || o.driverId == widget.myId))
          .toList();
      final threads = await Future.wait(
        orders.map((o) async {
          try {
            final chat = await widget.api.get('/orders/${o.id}/chat') as Map<String, dynamic>;
            final list = chat['messages'] as List? ?? const [];
            return _Thread(o, list.isEmpty ? null : ChatMessage.fromJson(list.last as Map<String, dynamic>));
          } on ApiException {
            return _Thread(o, null);
          }
        }),
      );
      threads.sort(
        (a, b) => (b.last?.createdAt ?? b.order.createdAt ?? DateTime(2000)).compareTo(
          a.last?.createdAt ?? a.order.createdAt ?? DateTime(2000),
        ),
      );
      if (!mounted) return;
      setState(() {
        _threads = threads;
        _error = null;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _threads ??= const [];
        _error = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final threads = _threads;
    return RefreshIndicator(
      color: BnColors.brand,
      onRefresh: () async {
        await Future.wait([_load(), widget.center.refresh()]);
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(20, MediaQuery.paddingOf(context).top + 18, 20, 14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [BnColors.brand.withValues(alpha: 0.16), Colors.transparent],
              ),
            ),
            child: const Text(
              'Messages',
              style: TextStyle(color: BnColors.textStrong, fontSize: 30, fontWeight: FontWeight.w800),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Text(_error!, style: const TextStyle(color: BnColors.danger)),
            ),
          if (threads == null)
            const Padding(
              padding: EdgeInsets.all(40),
              child: Center(child: CircularProgressIndicator(color: BnColors.brand)),
            )
          else if (threads.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  const Icon(Icons.chat_bubble_outline, size: 40, color: BnColors.brand),
                  const SizedBox(height: 12),
                  const Text(
                    'Aucune discussion en cours',
                    style: TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _iAmClient
                        ? "Une discussion s'ouvre avec le chauffeur dès qu'il accepte une commande."
                        : "Une discussion s'ouvre avec le client dès que vous acceptez une course.",
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: BnColors.text2),
                  ),
                ],
              ),
            )
          else
            for (final t in threads)
              _ThreadRow(
                thread: t,
                unread: widget.center.unreadFor(t.order.id),
                iAmClient: _iAmClient,
                myId: widget.myId,
                onTap: () async {
                  await widget.onOpen(t.order);
                  unawaited(_load());
                },
              ),
        ],
      ),
    );
  }
}

class _ThreadRow extends StatelessWidget {
  const _ThreadRow({
    required this.thread,
    required this.unread,
    required this.iAmClient,
    required this.myId,
    required this.onTap,
  });

  final _Thread thread;
  final int unread;
  final bool iAmClient;
  final String myId;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final order = thread.order;
    final last = thread.last;
    final name = (iAmClient ? order.driverName : order.clientName) ?? (iAmClient ? 'Chauffeur' : 'Client');
    final prefix = last == null
        ? ''
        : last.isFromTeam
        ? 'BenneGo : '
        : last.senderId == myId
        ? 'Vous : '
        : '';
    final preview = last == null
        ? (iAmClient ? 'Écrivez au chauffeur' : 'Écrivez au client')
        : '$prefix${last.message}';
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: BnColors.border)),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 26,
              backgroundColor: const Color(0xFF050508),
              child: Text(
                initialsOf(name),
                style: const TextStyle(color: Color(0xFFE8C38A), fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: BnColors.textStrong, fontSize: 16, fontWeight: FontWeight.w700),
                        ),
                      ),
                      if (last != null)
                        Text(_timeOf(last.createdAt), style: const TextStyle(color: BnColors.text3, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                    decoration: BoxDecoration(
                      color: BnColors.brand.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '${order.orderNumber} · ${order.statusLabel}',
                      style: const TextStyle(color: Color(0xFFE8C38A), fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          preview,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: unread > 0 ? BnColors.textStrong : BnColors.text3,
                            fontSize: 14,
                            fontWeight: unread > 0 ? FontWeight.w600 : FontWeight.w400,
                          ),
                        ),
                      ),
                      if (unread > 0) ...[const SizedBox(width: 8), UnreadBadge(count: unread)],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _timeOf(DateTime d) {
  final now = DateTime.now();
  final sameDay = d.year == now.year && d.month == now.month && d.day == now.day;
  return sameDay ? DateFormat('HH:mm', 'fr_FR').format(d) : DateFormat('d MMM', 'fr_FR').format(d);
}

/// Pastille sable du nombre de messages non lus (au-delà de 9 : « 9+ »).
class UnreadBadge extends StatelessWidget {
  const UnreadBadge({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$count message(s) non lu(s)',
      child: Container(
        constraints: const BoxConstraints(minWidth: 20),
        height: 20,
        padding: const EdgeInsets.symmetric(horizontal: 5),
        alignment: Alignment.center,
        decoration: BoxDecoration(color: BnColors.brand, borderRadius: BorderRadius.circular(999)),
        child: Text(
          count > 9 ? '9+' : '$count',
          style: const TextStyle(color: Color(0xFF0B0B10), fontSize: 11, fontWeight: FontWeight.w800),
        ),
      ),
    );
  }
}
