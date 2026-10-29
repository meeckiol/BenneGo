import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';

import '../data/client_repository.dart';
import 'order_detail_screen.dart';

enum _Filter { all, active, done }

/// Liste des commandes du client, filtrable entre en cours et terminées.
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  late Future<List<Order>> _future;
  _Filter _filter = _Filter.all;

  @override
  void initState() {
    super.initState();
    _future = context.read<ClientRepository>().orders();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<ClientRepository>().orders());
    await _future;
  }

  bool _matches(Order order) => switch (_filter) {
        _Filter.all => true,
        _Filter.active => !order.isFinal,
        _Filter.done => order.isFinal,
      };

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: _reload,
        child: FutureBuilder<List<Order>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator(color: BnColors.brand));
            }
            if (snapshot.hasError) {
              return ListView(
                padding: const EdgeInsets.all(16),
                children: [BnBanner(message: tr('Impossible de charger vos commandes.'), tone: BnTone.danger)],
              );
            }
            final orders = (snapshot.data ?? const <Order>[]).where(_matches).toList();
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                const Text('Mes commandes', style: TextStyle(color: BnColors.textStrong, fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                SegmentedButton<_Filter>(
                  segments: const [
                    ButtonSegment(value: _Filter.all, label: Text('Toutes')),
                    ButtonSegment(value: _Filter.active, label: Text('En cours')),
                    ButtonSegment(value: _Filter.done, label: Text('Terminées')),
                  ],
                  selected: {_filter},
                  onSelectionChanged: (selection) => setState(() => _filter = selection.first),
                ),
                const SizedBox(height: 16),
                if (orders.isEmpty)
                  BnCard(child: BnEmpty(message: tr('Aucune commande dans cette catégorie.')))
                else
                  for (final order in orders) ...[
                    BnCard(
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute<void>(builder: (_) => OrderDetailScreen(orderId: order.id)),
                        );
                        if (mounted) await _reload();
                      },
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  order.orderNumber,
                                  style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800),
                                ),
                              ),
                              StatusPill(status: order.status),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text('Chargement : ${order.pickupAddress}', style: const TextStyle(color: BnColors.text2, fontSize: 13)),
                          Text('Livraison : ${order.deliveryAddress}', style: const TextStyle(color: BnColors.text2, fontSize: 13)),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Text(
                                formatFcfa(order.amountDue),
                                style: const TextStyle(color: BnColors.brand, fontWeight: FontWeight.w800),
                              ),
                              const Spacer(),
                              Text(formatDateTime(order.createdAt), style: const TextStyle(color: BnColors.text3, fontSize: 12)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
              ],
            );
          },
        ),
      ),
    );
  }
}
