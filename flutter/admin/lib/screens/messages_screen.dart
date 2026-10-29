import 'dart:async';

import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../data/admin_repository.dart';

const _who = {'client': 'Client', 'driver': 'Chauffeur', 'admin': 'Assistance BenneGo'};

String _when(DateTime? d) => d == null ? '' : DateFormat('d MMM HH:mm', dateLocale()).format(d);

/// Messagerie client ↔ chauffeur côté administration : discussions en cours, en litige ou toutes
/// (y compris terminées), lecture et message de l'assistance BenneGo reçu par le client et le chauffeur.
class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key, this.initialScope = 'active', this.openOrderId});

  final String initialScope;

  /// Ouvre directement cette discussion (lien depuis un litige).
  final String? openOrderId;

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  late String _scope = widget.initialScope;
  String _query = '';
  List<Conversation>? _list;
  Timer? _timer;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    unawaited(_load(openFirst: widget.openOrderId));
    // Liste rafraîchie toutes les 15 s : nouveaux messages et nouvelles courses
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load({String? openFirst}) async {
    try {
      final list = await context.read<AdminRepository>().conversations(scope: _scope, query: _query);
      if (!mounted) return;
      setState(() => _list = list);
      if (openFirst != null) {
        final match = list.where((c) => c.orderId == openFirst);
        if (match.isNotEmpty) unawaited(_open(match.first));
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _list ??= const []);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _open(Conversation c) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => _ConversationScreen(conversation: c)));
    unawaited(_load());
  }

  @override
  Widget build(BuildContext context) {
    final list = _list;
    return Scaffold(
      appBar: AppBar(title: const Text('Messagerie')),
      body: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              "Discussions entre clients et chauffeurs. Votre message part au nom de l'Assistance BenneGo et prévient les deux.",
              style: TextStyle(color: BnColors.text2, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: InputDecoration(hintText: tr('N° de commande, client, chauffeur'), prefixIcon: Icon(Icons.search)),
              onChanged: (value) {
                _query = value;
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 350), _load);
              },
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: [
                for (final (scope, label) in const [('active', 'En cours'), ('dispute', 'Litiges'), ('all', 'Toutes')])
                  ChoiceChip(
                    label: Text(label),
                    selected: _scope == scope,
                    showCheckmark: false,
                    selectedColor: BnColors.brand,
                    labelStyle: TextStyle(
                      color: _scope == scope ? const Color(0xFF0B0B10) : BnColors.text,
                      fontWeight: FontWeight.w700,
                    ),
                    onSelected: (_) {
                      setState(() => _scope = scope);
                      unawaited(_load());
                    },
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (list == null)
              const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator(color: BnColors.brand)))
            else if (list.isEmpty)
              BnCard(child: BnEmpty(message: tr('Aucune discussion.')))
            else
              for (final c in list) ...[
                BnCard(
                  onTap: () => _open(c),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(c.orderNumber, style: const TextStyle(color: BnColors.brand, fontWeight: FontWeight.w800)),
                          ),
                          Text(_when(c.lastAt), style: const TextStyle(color: BnColors.text3, fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('${c.clientName} ↔ ${c.driverName ?? 'sans chauffeur'}',
                          style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text(
                        c.lastMessage == null ? tr('Aucun message') : '${_who[c.lastSenderRole] ?? ''} : ${c.lastMessage}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: BnColors.text2, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          StatusPill(status: c.status),
                          if (c.disputeOpen) BnPill(label: tr('Litige'), tone: BnTone.danger),
                          BnPill(label: tr('${c.messageCount} message(s)')),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
  }
}

class _ConversationScreen extends StatefulWidget {
  const _ConversationScreen({required this.conversation});

  final Conversation conversation;

  @override
  State<_ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<_ConversationScreen> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  List<ChatMessage>? _messages;
  Timer? _timer;
  bool _sending = false;

  Conversation get _c => widget.conversation;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    // Discussion ouverte : rafraîchie toutes les 5 s
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await context.read<AdminRepository>().chat(_c.orderId);
      if (!mounted) return;
      final grew = list.length != (_messages?.length ?? -1);
      setState(() => _messages = list);
      if (grew) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
        });
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _messages ??= const []);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _send() async {
    final message = _text.text.trim();
    if (message.isEmpty) return;
    setState(() => _sending = true);
    try {
      await context.read<AdminRepository>().sendTeamMessage(_c.orderId, message);
      _text.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Message envoyé au client et au chauffeur')));
      }
      await _load();
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
    if (mounted) setState(() => _sending = false);
  }

  @override
  Widget build(BuildContext context) {
    final messages = _messages;
    return Scaffold(
      appBar: AppBar(title: Text(_c.orderNumber)),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: BnColors.border))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Client : ${_c.clientName}${_c.clientPhone == null ? '' : ' · ${_c.clientPhone}'}',
                    style: const TextStyle(color: BnColors.text2, fontSize: 13)),
                if (_c.driverName != null)
                  Text('Chauffeur : ${_c.driverName}${_c.driverPhone == null ? '' : ' · ${_c.driverPhone}'}',
                      style: const TextStyle(color: BnColors.text2, fontSize: 13)),
              ],
            ),
          ),
          Expanded(
            child: messages == null
                ? const Center(child: CircularProgressIndicator(color: BnColors.brand))
                : messages.isEmpty
                    ? const Center(child: Text('Aucun message dans cette discussion.', style: TextStyle(color: BnColors.text2)))
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.all(14),
                        itemCount: messages.length,
                        itemBuilder: (context, i) => _AdminBubble(message: messages[i]),
                      ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _text,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 1000,
                      decoration: InputDecoration(hintText: tr("Écrire en tant qu'Assistance BenneGo…"), counterText: ''),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    tooltip: tr('Envoyer'),
                    onPressed: _sending ? null : _send,
                    style: IconButton.styleFrom(backgroundColor: BnColors.brand, foregroundColor: const Color(0xFF0B0B10)),
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AdminBubble extends StatelessWidget {
  const _AdminBubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final team = message.isFromTeam;
    final color = switch (message.senderRole) {
      'admin' => BnColors.success,
      'driver' => BnColors.brand,
      _ => BnColors.info,
    };
    final name = _who[message.senderRole] ?? message.senderName;
    return Align(
      alignment: team ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              team || message.senderName.isEmpty ? name : '$name · ${message.senderName}',
              style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            Text(message.message, style: const TextStyle(color: BnColors.textStrong, height: 1.35)),
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.centerRight,
              child: Text(_when(message.createdAt), style: const TextStyle(color: BnColors.text3, fontSize: 11)),
            ),
          ],
        ),
      ),
    );
  }
}
