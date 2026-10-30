import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:intl/intl.dart';

import '../data/client_repository.dart';

/// Période d'un prix, en dates claires : « du 26 oct. au 1 nov. » (texte français, traduit par le widget Text).
String marketPeriod(Map<String, dynamic> item) {
  String day(Object? iso) {
    final date = DateTime.tryParse('$iso');
    return date == null ? '' : DateFormat('d MMM', dateLocale()).format(date);
  }

  return 'du ${day(item['week_start'])} au ${day(item['week_end'])}';
}

/// Flèche de tendance. Pour l'acheteur, une hausse est une mauvaise nouvelle (rouge), une baisse une bonne (vert).
class MarketTrend extends StatelessWidget {
  const MarketTrend({super.key, required this.trend});

  final Object? trend;

  @override
  Widget build(BuildContext context) {
    final (icon, color, label) = switch (trend) {
      'up' => (Icons.arrow_upward, BnColors.danger, 'En hausse'),
      'down' => (Icons.arrow_downward, BnColors.success, 'En baisse'),
      _ => (Icons.arrow_forward, BnColors.text3, 'Stable'),
    };
    return Icon(icon, size: 18, color: color, semanticLabel: tr(label));
  }
}

/// Accueil : prix d'un voyage en camion 10 roues (le plus courant) de chaque matériau.
class MarketPricesCard extends StatelessWidget {
  const MarketPricesCard({super.key, required this.market, this.onMaterial});

  final Market market;
  final ValueChanged<String>? onMaterial;

  @override
  Widget build(BuildContext context) {
    final tenWheels = market.items.where((i) => i['truck_size'] == '10_roues').toList();
    final shown = tenWheels.isNotEmpty ? tenWheels : market.items;
    if (shown.isEmpty) return const SizedBox.shrink();
    return BnCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const BnSectionHead(title: 'Prix du marché'),
          const SizedBox(height: 2),
          Text(
            tenWheels.isNotEmpty ? "Prix d'un voyage en camion 10 roues" : "Prix d'un voyage",
            style: const TextStyle(color: BnColors.text3, fontSize: 12),
          ),
          Text(marketPeriod(shown.first), style: const TextStyle(color: BnColors.text3, fontSize: 12)),
          const SizedBox(height: 6),
          for (final item in shown.take(8))
            InkWell(
              onTap: onMaterial == null ? null : () => onMaterial!('${item['material_name']}'),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        tenWheels.isNotEmpty ? '${item['material_name']}' : '${item['material_name']} · ${item['truck_name']}',
                        style: const TextStyle(color: BnColors.text),
                      ),
                    ),
                    Text(
                      formatFcfa(parseNum(item['price_avg'])),
                      style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(width: 8),
                    MarketTrend(trend: item['trend']),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Commande : prix du marché du matériau choisi, pour le camion qui correspond à la benne demandée.
class MarketPriceHint extends StatelessWidget {
  const MarketPriceHint({super.key, required this.market, required this.materialName, required this.truckType});

  final Market market;
  final String? materialName;
  final String truckType;

  @override
  Widget build(BuildContext context) {
    final material = market.material(materialName);
    if (material == null || material['voyage'] != true) return const SizedBox.shrink();
    final rows = market.items.where((i) => i['material_key'] == material['key']).toList();
    if (rows.isEmpty) return const SizedBox.shrink();
    final truck = market.truckFor(truckType);
    final best = rows.where((i) => i['truck_size'] == truck?['key']).firstOrNull;
    final shown = best != null ? [best] : rows;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: BnColors.brand.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Prix du marché',
            style: TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700, fontSize: 13),
          ),
          Text(marketPeriod(shown.first), style: const TextStyle(color: BnColors.text, fontSize: 12)),
          for (final item in shown)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${item['truck_name']} : ${formatFcfa(parseNum(item['price_avg']))} le voyage',
                          style: const TextStyle(color: BnColors.text, fontSize: 13),
                        ),
                        Text(
                          'entre ${formatFcfa(parseNum(item['price_min']))} et ${formatFcfa(parseNum(item['price_max']))}',
                          style: const TextStyle(color: BnColors.text3, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  MarketTrend(trend: item['trend']),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
