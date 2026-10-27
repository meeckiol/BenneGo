import 'package:bennego_core/bennego_core.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/admin_repository.dart';

/// Tableau de bord : indicateurs clés et commandes des sept derniers jours.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<AdminStats> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AdminRepository>().stats();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<AdminRepository>().stats());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: _reload,
        child: FutureBuilder<AdminStats>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator(color: BnColors.brand));
            }
            final stats = snapshot.data;
            if (stats == null) {
              return ListView(
                padding: const EdgeInsets.all(16),
                children: const [BnBanner(message: 'Impossible de charger le tableau de bord.', tone: BnTone.danger)],
              );
            }
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                const Text('Tableau de bord', style: TextStyle(color: BnColors.textStrong, fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.35,
                  children: [
                    BnKpi(label: 'Commandes', value: '${stats.orders}', sub: '${stats.completed} terminées · ${stats.pending} en attente'),
                    BnKpi(label: 'Volume (GMV)', value: formatFcfa(stats.gmv), sub: 'Total des transactions', icon: Icons.inventory_2_outlined, color: BnColors.info),
                    BnKpi(label: 'Revenus plateforme', value: formatFcfa(stats.revenue), sub: 'Commission 10 %', icon: Icons.account_balance_wallet_outlined),
                    BnKpi(label: 'Chauffeurs disponibles', value: '${stats.driversAvailable} / ${stats.driversTotal}', icon: Icons.local_shipping_outlined, color: BnColors.success),
                    BnKpi(label: 'Clients inscrits', value: '${stats.clientsTotal}', icon: Icons.people_outline, color: BnColors.violet),
                    BnKpi(label: 'Annulées', value: '${stats.cancelled}', icon: Icons.cancel_outlined, color: BnColors.danger),
                  ],
                ),
                const SizedBox(height: 16),
                BnCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const BnSectionHead(title: 'Commandes par jour · 7 derniers jours'),
                      const SizedBox(height: 16),
                      SizedBox(height: 200, child: _WeekChart(days: stats.weekly)),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _WeekChart extends StatelessWidget {
  const _WeekChart({required this.days});

  final List<WeekDay> days;

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) return const BnEmpty(message: 'Pas encore de données cette semaine.');
    return BarChart(
      BarChartData(
        borderData: FlBorderData(show: false),
        gridData: const FlGridData(show: false),
        titlesData: FlTitlesData(
          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              getTitlesWidget: (value, meta) {
                final index = value.toInt();
                if (index < 0 || index >= days.length) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(days[index].label, style: const TextStyle(color: BnColors.text3, fontSize: 11)),
                );
              },
            ),
          ),
        ),
        barGroups: [
          for (var i = 0; i < days.length; i++)
            BarChartGroupData(
              x: i,
              barRods: [
                BarChartRodData(
                  toY: days[i].orders.toDouble(),
                  color: BnColors.brand,
                  width: 16,
                  borderRadius: BorderRadius.circular(6),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
