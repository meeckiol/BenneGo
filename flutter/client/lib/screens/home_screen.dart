import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/client_config.dart';
import '../data/client_repository.dart';
import 'new_order_screen.dart';
import 'order_detail_screen.dart';

/// Accueil client : nouvelle commande, services, commande en cours et indice des prix BTP.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<Order>> _orders;
  late Future<List<Map<String, dynamic>>> _barometer;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final repo = context.read<ClientRepository>();
    _orders = repo.orders(limit: 20);
    _barometer = repo.barometer().catchError((_) => <Map<String, dynamic>>[]);
  }

  Future<void> _reload() async {
    setState(_load);
    await _orders;
  }

  Future<void> _newOrder(String type) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => NewOrderScreen(initialType: type)));
    if (mounted) await _reload();
  }

  Future<void> _openOrder(Order order) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => OrderDetailScreen(orderId: order.id)));
    if (mounted) await _reload();
  }

  Future<void> _whatsApp() async {
    final text = Uri.encodeComponent('Bonjour BenneGo, j\'ai besoin d\'aide');
    await launchUrl(Uri.parse('https://wa.me/$supportWhatsApp?text=$text'), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<Session>().user;
    return SafeArea(
      child: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: _reload,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                BnAvatar(initials: user?.initials ?? 'B'),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Bonjour', style: TextStyle(color: BnColors.text2, fontSize: 12)),
                      Text(
                        user?.firstName ?? 'vous',
                        style: const TextStyle(color: BnColors.textStrong, fontSize: 20, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            BnCard(
              color: BnColors.brand.withValues(alpha: 0.12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'LIVRAISON DE MATÉRIAUX & BTP',
                    style: TextStyle(color: BnColors.brand, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Commandez, suivez, payez en sécurité.',
                    style: TextStyle(color: BnColors.textStrong, fontSize: 22, fontWeight: FontWeight.w800, height: 1.2),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    "Votre paiement reste bloqué sur BenneGo jusqu'à ce que vous confirmiez la réception.",
                    style: TextStyle(color: BnColors.text2, height: 1.4),
                  ),
                  const SizedBox(height: 16),
                  BnPrimaryButton(
                    label: 'Nouvelle commande',
                    icon: Icons.add_circle_outline,
                    onPressed: () => _newOrder('MATERIAL'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.25,
              children: [
                _ServiceTile(
                  title: 'Transport de matériaux',
                  hint: 'Sable, gravier, latérite',
                  icon: Icons.landscape_outlined,
                  highlighted: true,
                  onTap: () => _newOrder('MATERIAL'),
                ),
                _ServiceTile(
                  title: "Location d'engins",
                  hint: 'Pelles, bulldozers, chargeurs',
                  icon: Icons.construction_outlined,
                  onTap: () => _newOrder('RENTAL'),
                ),
                _ServiceTile(
                  title: 'Évacuation de gravats',
                  hint: 'Décharge autorisée',
                  icon: Icons.delete_sweep_outlined,
                  onTap: () => _newOrder('EVACUATION'),
                ),
                if (supportWhatsApp.isNotEmpty)
                  _ServiceTile(
                    title: 'Assistance',
                    hint: 'Écrivez-nous sur WhatsApp',
                    icon: Icons.chat_outlined,
                    onTap: _whatsApp,
                  ),
              ],
            ),
            const SizedBox(height: 20),
            FutureBuilder<List<Order>>(
              future: _orders,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: BnColors.brand)));
                }
                final orders = snapshot.data ?? const <Order>[];
                final current = orders.where((o) => !o.isFinal).firstOrNull;
                final recent = orders.take(3).toList();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (current != null) ...[
                      _CurrentOrderCard(order: current, onTap: () => _openOrder(current)),
                      const SizedBox(height: 20),
                    ],
                    if (recent.isNotEmpty) ...[
                      const BnSectionHead(title: 'Dernières commandes'),
                      const SizedBox(height: 8),
                      for (final order in recent) ...[
                        BnCard(
                          onTap: () => _openOrder(order),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(order.orderNumber, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${formatDateTime(order.createdAt)} · ${formatFcfa(order.amountDue)}',
                                      style: const TextStyle(color: BnColors.text2, fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                              StatusPill(status: order.status),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                    ],
                  ],
                );
              },
            ),
            const SizedBox(height: 12),
            FutureBuilder<List<Map<String, dynamic>>>(
              future: _barometer,
              builder: (context, snapshot) {
                final items = snapshot.data ?? const <Map<String, dynamic>>[];
                if (items.isEmpty) return const SizedBox.shrink();
                return BnCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      BnSectionHead(title: 'Indice des prix BTP · semaine ${items.first['week_number'] ?? ''}'),
                      const SizedBox(height: 8),
                      for (final item in items.take(6))
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Expanded(child: Text('${item['material_name']}', style: const TextStyle(color: BnColors.text))),
                              Text(
                                '${formatFcfa(parseNum(item['avg_price_m3']))}/m³',
                                style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({
    required this.title,
    required this.hint,
    required this.icon,
    required this.onTap,
    this.highlighted = false,
  });

  final String title;
  final String hint;
  final IconData icon;
  final VoidCallback onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return BnCard(
      onTap: onTap,
      color: highlighted ? BnColors.brand.withValues(alpha: 0.16) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: BnColors.brand),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
              Text(hint, style: const TextStyle(color: BnColors.text2, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}

class _CurrentOrderCard extends StatelessWidget {
  const _CurrentOrderCard({required this.order, required this.onTap});

  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return BnCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('COMMANDE EN COURS', style: TextStyle(color: BnColors.text2, fontSize: 11, fontWeight: FontWeight.w700)),
              const Spacer(),
              StatusPill(status: order.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(order.orderNumber, style: const TextStyle(color: BnColors.textStrong, fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text('Chargement : ${order.pickupAddress}', style: const TextStyle(color: BnColors.text2, fontSize: 13)),
          Text('Livraison : ${order.deliveryAddress}', style: const TextStyle(color: BnColors.text2, fontSize: 13)),
          const SizedBox(height: 12),
          const Text('Suivre la commande →', style: TextStyle(color: BnColors.brand, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
