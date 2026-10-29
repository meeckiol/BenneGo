import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../controllers/driver_controller.dart';

/// Courses terminées de ce chauffeur, les plus récentes en premier.
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late Future<List<Order>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Order>> _load() => context.read<DriverController>().history();

  Future<void> _reload() async {
    setState(() => _future = _load());
    await _future;
  }

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
            final orders = snapshot.data ?? const <Order>[];
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                const BnSectionHead(title: 'Historique des courses'),
                const SizedBox(height: 12),
                if (orders.isEmpty)
                  const BnCard(child: BnEmpty(message: 'Aucune course terminée pour le moment.'))
                else
                  for (final order in orders) ...[
                    BnCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(order.orderNumber, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800)),
                              const Spacer(),
                              StatusPill(status: order.status),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(order.deliveryAddress, style: const TextStyle(color: BnColors.text2, fontSize: 13)),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Text(formatFcfa(order.driverAmount), style: const TextStyle(color: BnColors.brand, fontWeight: FontWeight.w800)),
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
