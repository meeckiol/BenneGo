import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../controllers/driver_controller.dart';
import 'mission_screen.dart';

/// Onglet « Courses » (comme « Commandes » côté client) : recherche, filtres à compteurs et cartes avec la part du chauffeur.
class CoursesScreen extends StatefulWidget {
  const CoursesScreen({super.key});

  @override
  State<CoursesScreen> createState() => _CoursesScreenState();
}

enum _Filter { all, active, done }

class _CoursesScreenState extends State<CoursesScreen> {
  late Future<List<Order>> _future;
  _Filter _filter = _Filter.all;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Order>> _load() => context.read<DriverController>().courses();

  Future<void> _reload() async {
    setState(() => _future = _load());
    await _future;
  }

  bool _matches(Order o) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return [o.orderNumber, o.pickupAddress, o.deliveryAddress, o.summary].any((v) => v.toLowerCase().contains(q));
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
            // En cours d'abord, puis les plus récentes
            final orders = [...?snapshot.data]
              ..sort((a, b) {
                final rank = (a.isFinal ? 1 : 0) - (b.isFinal ? 1 : 0);
                if (rank != 0) return rank;
                return (b.createdAt ?? DateTime(2000)).compareTo(a.createdAt ?? DateTime(2000));
              });
            final done = orders.where((o) => o.isFinal).length;
            final earned = orders
                .where((o) => const ['delivered', 'validated', 'completed'].contains(o.status))
                .fold<double>(0, (sum, o) => sum + o.driverAmount);
            final counts = {_Filter.all: orders.length, _Filter.active: orders.length - done, _Filter.done: done};
            final visible = orders
                .where((o) => switch (_filter) {
                      _Filter.all => true,
                      _Filter.active => !o.isFinal,
                      _Filter.done => o.isFinal,
                    })
                .where(_matches)
                .toList();

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text('$done course(s) terminée(s) · ${formatFcfa(earned)} gagnés',
                    style: const TextStyle(color: BnColors.text3, fontSize: 14)),
                const SizedBox(height: 4),
                const Text('Mes courses',
                    style: TextStyle(color: BnColors.textStrong, fontSize: 30, fontWeight: FontWeight.w800)),
                const SizedBox(height: 14),
                TextField(
                  onChanged: (value) => setState(() => _query = value),
                  decoration: const InputDecoration(
                    hintText: 'Rechercher une course',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final (filter, label) in const [
                      (_Filter.all, 'Toutes'),
                      (_Filter.active, 'En cours'),
                      (_Filter.done, 'Terminées'),
                    ])
                      ChoiceChip(
                        label: Text('$label  ${counts[filter]}'),
                        selected: _filter == filter,
                        onSelected: (_) => setState(() => _filter = filter),
                        showCheckmark: false,
                        selectedColor: BnColors.brand,
                        labelStyle: TextStyle(
                          color: _filter == filter ? const Color(0xFF0B0B10) : BnColors.text,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                if (visible.isEmpty)
                  BnCard(
                    child: BnEmpty(
                      message: orders.isEmpty
                          ? "Aucune course pour le moment. Passez en ligne depuis l'accueil pour recevoir vos premières courses."
                          : 'Aucune course dans ce filtre.',
                    ),
                  )
                else
                  for (final order in visible) ...[
                    _CourseCard(order: order),
                    const SizedBox(height: 12),
                  ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  const _CourseCard({required this.order});

  final Order order;

  String get _payLabel {
    if (order.status == 'cancelled') return 'Annulée';
    if (order.paymentStatus == 'released') return 'Versé';
    if (order.status == 'validated' || order.status == 'completed') return 'Versement en cours';
    if (order.status == 'delivered') return 'Attente confirmation client';
    return 'Votre part';
  }

  @override
  Widget build(BuildContext context) {
    final active = context.watch<DriverController>().activeOrder;
    final isActive = active?.id == order.id;
    return BnCard(
      onTap: isActive
          ? () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const MissionScreen()))
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(order.orderNumber,
                    style: const TextStyle(color: BnColors.textStrong, fontSize: 17, fontWeight: FontWeight.w800)),
              ),
              StatusPill(status: order.status),
            ],
          ),
          Text(order.summary, style: const TextStyle(color: BnColors.text3, fontSize: 13)),
          const SizedBox(height: 12),
          // Avancement de la course
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: order.status == 'cancelled' ? 0 : order.progress,
              minHeight: 6,
              color: BnColors.brand,
              backgroundColor: BnColors.border,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: BnColors.brand.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                Expanded(child: Text(_payLabel, style: const TextStyle(color: Color(0xFFE8C38A), fontSize: 13))),
                Text(formatFcfa(order.driverAmount),
                    style: const TextStyle(color: BnColors.textStrong, fontSize: 16, fontWeight: FontWeight.w800)),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _Leg(label: 'DEPUIS', address: order.pickupAddress, sub: formatDateTime(order.createdAt))),
              const SizedBox(width: 12),
              Expanded(child: _Leg(label: 'VERS', address: order.deliveryAddress, sub: order.statusLabel)),
            ],
          ),
          if (isActive) ...[
            const SizedBox(height: 10),
            const Text('Gérer la course →', style: TextStyle(color: BnColors.brand, fontWeight: FontWeight.w700)),
          ],
        ],
      ),
    );
  }
}

class _Leg extends StatelessWidget {
  const _Leg({required this.label, required this.address, required this.sub});

  final String label;
  final String address;
  final String sub;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: BnColors.text3, fontSize: 11, fontWeight: FontWeight.w700)),
        Text(address.isEmpty ? '—' : address,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
        Text(sub, style: const TextStyle(color: BnColors.text3, fontSize: 12)),
      ],
    );
  }
}
