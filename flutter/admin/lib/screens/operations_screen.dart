import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/admin_repository.dart';
import 'messages_screen.dart';
import 'order_detail_screen.dart';

/// Opérations : litiges à trancher, reversements aux chauffeurs et commandes récentes.
class OperationsScreen extends StatelessWidget {
  const OperationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Opérations'),
          bottom: const TabBar(
            indicatorColor: BnColors.brand,
            labelColor: BnColors.textStrong,
            unselectedLabelColor: BnColors.text3,
            tabs: [Tab(text: 'Litiges'), Tab(text: 'Reversements'), Tab(text: 'Commandes')],
          ),
        ),
        body: const TabBarView(children: [_DisputesTab(), _PayoutsTab(), _OrdersTab()]),
      ),
    );
  }
}

void _toast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

Future<bool> _confirm(BuildContext context, String question) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      backgroundColor: BnColors.surface,
      content: Text(question),
      actions: [
        TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuler')),
        ElevatedButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Confirmer')),
      ],
    ),
  );
  return ok ?? false;
}

/// Liste rafraîchissable : charge via [load], affiche [itemBuilder] pour chaque élément.
class _AsyncList<T> extends StatelessWidget {
  const _AsyncList({required this.future, required this.onRefresh, required this.itemBuilder, required this.empty});

  final Future<List<T>> future;
  final Future<void> Function() onRefresh;
  final Widget Function(T item) itemBuilder;
  final String empty;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: BnColors.brand,
      onRefresh: onRefresh,
      child: FutureBuilder<List<T>>(
        future: future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(color: BnColors.brand));
          }
          final items = snapshot.data ?? const [];
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              if (snapshot.hasError)
                const BnBanner(message: 'Impossible de charger cette liste.', tone: BnTone.danger)
              else if (items.isEmpty)
                BnCard(child: BnEmpty(message: empty))
              else
                for (final item in items) ...[itemBuilder(item), const SizedBox(height: 10)],
            ],
          );
        },
      ),
    );
  }
}

class _DisputesTab extends StatefulWidget {
  const _DisputesTab();

  @override
  State<_DisputesTab> createState() => _DisputesTabState();
}

class _DisputesTabState extends State<_DisputesTab> {
  late Future<List<Dispute>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AdminRepository>().disputes();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<AdminRepository>().disputes());
    await _future;
  }

  Future<void> _resolve(Dispute dispute, String decision) async {
    final repo = context.read<AdminRepository>();
    final refund = decision == 'refund';
    final question = refund
        ? 'Rembourser le client pour la commande ${dispute.orderNumber} ?'
        : 'Libérer le paiement au chauffeur pour la commande ${dispute.orderNumber} ?';
    if (!await _confirm(context, question)) return;
    try {
      await repo.resolveDispute(dispute.orderId, decision: decision);
      if (mounted) _toast(context, refund ? 'Client remboursé' : 'Paiement libéré au chauffeur');
      await _reload();
    } on ApiException catch (error) {
      if (mounted) _toast(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _AsyncList<Dispute>(
      future: _future,
      onRefresh: _reload,
      empty: 'Aucun litige en attente.',
      itemBuilder: (dispute) => BnCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(dispute.orderNumber, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800)),
                const Spacer(),
                Text(formatFcfa(dispute.totalAmount), style: const TextStyle(color: BnColors.brand, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 6),
            Text('Client : ${dispute.clientName} · Chauffeur : ${dispute.driverName}', style: const TextStyle(color: BnColors.text2, fontSize: 12)),
            const SizedBox(height: 8),
            Text(dispute.reason, style: const TextStyle(color: BnColors.text, height: 1.35)),
            if (dispute.photos.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('${dispute.photos.length} photo(s) jointes', style: const TextStyle(color: BnColors.text3, fontSize: 12)),
              ),
            // La discussion client ↔ chauffeur aide à trancher (horaires, accès, quantité annoncée…)
            TextButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => MessagesScreen(initialScope: 'dispute', openOrderId: dispute.orderId),
              )),
              icon: const Icon(Icons.chat_bubble_outline, size: 18),
              label: const Text('Voir la discussion client ↔ chauffeur'),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(onPressed: () => _resolve(dispute, 'refund'), child: const Text('Rembourser')),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(onPressed: () => _resolve(dispute, 'release'), child: const Text('Libérer au chauffeur')),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PayoutsTab extends StatefulWidget {
  const _PayoutsTab();

  @override
  State<_PayoutsTab> createState() => _PayoutsTabState();
}

class _PayoutsTabState extends State<_PayoutsTab> {
  late Future<List<Payout>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AdminRepository>().payouts();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<AdminRepository>().payouts());
    await _future;
  }

  Future<void> _markPaid(Payout payout) async {
    final repo = context.read<AdminRepository>();
    final controller = TextEditingController();
    final reference = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: BnColors.surface,
        title: const Text('Référence du virement'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'Référence Mobile Money'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text.trim()),
            child: const Text('Enregistrer'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reference == null || reference.isEmpty) return;
    try {
      await repo.markPaid(payout.orderId, reference);
      if (mounted) _toast(context, 'Reversement marqué comme payé');
      await _reload();
    } on ApiException catch (error) {
      if (mounted) _toast(context, error.message);
    }
  }

  Future<void> _retry(Payout payout) async {
    try {
      await context.read<AdminRepository>().retryPayout(payout.orderId);
      if (mounted) _toast(context, 'Virement relancé');
      await _reload();
    } on ApiException catch (error) {
      if (mounted) _toast(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _AsyncList<Payout>(
      future: _future,
      onRefresh: _reload,
      empty: 'Aucun reversement en attente.',
      itemBuilder: (payout) => BnCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(payout.driverName, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800)),
                ),
                BnPill(label: payout.status.isEmpty ? '—' : payout.status, tone: BnTone.warning),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '${payout.orderNumber} · ${payout.momoProvider} ${payout.momoNumber}',
              style: const TextStyle(color: BnColors.text2, fontSize: 12),
            ),
            const SizedBox(height: 8),
            Text(formatFcfa(payout.driverAmount), style: const TextStyle(color: BnColors.brand, fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(onPressed: () => _retry(payout), child: const Text('Relancer')),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(onPressed: () => _markPaid(payout), child: const Text('Marquer payé')),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _OrdersTab extends StatefulWidget {
  const _OrdersTab();

  @override
  State<_OrdersTab> createState() => _OrdersTabState();
}

class _OrdersTabState extends State<_OrdersTab> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AdminRepository>().orders();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<AdminRepository>().orders());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return _AsyncList<Map<String, dynamic>>(
      future: _future,
      onRefresh: _reload,
      empty: 'Aucune commande.',
      itemBuilder: (order) => BnCard(
        onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => OrderDetailScreen(order: order)));
          if (mounted) await _reload();
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('${order['order_number'] ?? ''}', style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800)),
                ),
                StatusPill(status: order['status'] as String? ?? ''),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '${formatFcfa(parseNum(order['total_amount']))} · ${formatDateTime(DateTime.tryParse(order['created_at'] as String? ?? ''))}',
              style: const TextStyle(color: BnColors.text2, fontSize: 12),
            ),
            Text(
              '${order['client_name'] ?? '—'} → ${order['driver_name'] ?? 'chauffeur non assigné'}',
              style: const TextStyle(color: BnColors.text3, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
