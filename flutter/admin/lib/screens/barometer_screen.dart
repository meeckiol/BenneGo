import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../data/admin_repository.dart';

/// Prix du marché : chaque semaine, l'équipe publie le prix d'un voyage de matériau selon la taille du camion,
/// avec les noms utilisés au Bénin. La tendance se calcule toute seule par rapport à la semaine précédente.
class BarometerScreen extends StatefulWidget {
  const BarometerScreen({super.key});

  @override
  State<BarometerScreen> createState() => _BarometerScreenState();
}

DateTime _mondayOf(DateTime date) => DateTime(date.year, date.month, date.day - (date.weekday - 1));
String _iso(DateTime date) => DateFormat('yyyy-MM-dd').format(date);
String _day(DateTime date) => DateFormat('d MMM', dateLocale()).format(date);
String _period(DateTime start) => tr('du ${_day(start)} au ${_day(start.add(const Duration(days: 6)))}');

class _BarometerScreenState extends State<BarometerScreen> {
  final _formKey = GlobalKey<FormState>();
  final _min = TextEditingController();
  final _avg = TextEditingController();
  final _max = TextEditingController();
  List<Map<String, dynamic>> _materials = const [];
  List<Map<String, dynamic>> _trucks = const [];
  late Future<List<Map<String, dynamic>>> _current;
  String? _material;
  String _truck = '10_roues';
  // Semaines proposées : la dernière (rattrapage), celle-ci, la prochaine
  final DateTime _thisMonday = _mondayOf(DateTime.now());
  late DateTime _week = _thisMonday;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final repo = context.read<AdminRepository>();
    _current = repo.marketPrices();
    repo.marketCatalog().then((catalog) {
      if (!mounted) return;
      setState(() {
        _materials = (catalog['materials'] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .where((m) => m['voyage'] == true)
            .toList();
        _trucks = (catalog['trucks'] as List? ?? const []).cast<Map<String, dynamic>>();
      });
    }).catchError((_) {});
  }

  @override
  void dispose() {
    for (final controller in [_min, _avg, _max]) {
      controller.dispose();
    }
    super.dispose();
  }

  int? _money(TextEditingController controller) => int.tryParse(controller.text.replaceAll(RegExp(r'[\s.,]'), ''));

  void _toast(String message) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _publish() async {
    if (!_formKey.currentState!.validate()) return;
    final min = _money(_min)!;
    final avg = _money(_avg)!;
    final max = _money(_max)!;
    if (!(min <= avg && avg <= max)) {
      _toast(tr('Le prix le plus bas doit être inférieur ou égal au prix courant, lui-même inférieur ou égal au plus haut.'));
      return;
    }
    setState(() => _busy = true);
    try {
      await context.read<AdminRepository>().publishMarketPrice({
        'material_key': _material,
        'truck_size': _truck,
        'price_min': min,
        'price_avg': avg,
        'price_max': max,
        'week_start': _iso(_week),
      });
      _toast(tr('Prix publié : les clients le voient sur leur accueil'));
      setState(() {
        _current = context.read<AdminRepository>().marketPrices();
        _min.clear();
        _avg.clear();
        _max.clear();
      });
    } on ApiException catch (error) {
      _toast(error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Reprendre un prix publié pour le corriger
  void _edit(Map<String, dynamic> item) {
    final start = DateTime.tryParse('${item['week_start']}');
    setState(() {
      _material = '${item['material_key']}';
      _truck = '${item['truck_size']}';
      if (start != null && (start.difference(_thisMonday).inDays).abs() <= 7) _week = start;
      _min.text = '${parseNum(item['price_min']).round()}';
      _avg.text = '${parseNum(item['price_avg']).round()}';
      _max.text = '${parseNum(item['price_max']).round()}';
    });
  }

  String? _requiredPrice(String? value) {
    final number = int.tryParse((value ?? '').replaceAll(RegExp(r'[\s.,]'), ''));
    return (number == null || number <= 0) ? tr('Prix invalide') : null;
  }

  Widget _priceField(TextEditingController controller, String label) => TextFormField(
        controller: controller,
        keyboardType: TextInputType.number,
        decoration: InputDecoration(labelText: tr(label), suffixText: 'FCFA'),
        validator: _requiredPrice,
      );

  @override
  Widget build(BuildContext context) {
    final weeks = [-7, 0, 7].map((d) => _thisMonday.add(Duration(days: d))).toList();
    const weekLabels = ['Semaine dernière', 'Cette semaine', 'Semaine prochaine'];
    return Scaffold(
      appBar: AppBar(title: const Text('Prix du marché')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            "Publiez chaque semaine le prix d'un voyage selon le camion. Les clients le voient sur leur accueil et pendant la commande.",
            style: TextStyle(color: BnColors.text3, fontSize: 13),
          ),
          const SizedBox(height: 12),
          BnCard(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  DropdownButtonFormField<String>(
                    key: ValueKey('m$_material${_materials.length}'),
                    initialValue: _material,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: tr('Matériau')),
                    hint: const Text('Choisir un matériau'),
                    items: [
                      for (final m in _materials) DropdownMenuItem(value: '${m['key']}', child: Text('${m['name']}')),
                    ],
                    validator: (v) => v == null ? tr('Requis') : null,
                    onChanged: (value) => setState(() => _material = value),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: ValueKey('t$_truck${_trucks.length}'),
                    initialValue: _trucks.any((t) => t['key'] == _truck) ? _truck : null,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: tr('Camion')),
                    items: [for (final t in _trucks) DropdownMenuItem(value: '${t['key']}', child: Text('${t['name']}'))],
                    onChanged: (value) => setState(() => _truck = value ?? _truck),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<DateTime>(
                    key: ValueKey('w$_week'),
                    initialValue: _week,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: tr('Semaine')),
                    items: [
                      for (var i = 0; i < weeks.length; i++)
                        DropdownMenuItem(value: weeks[i], child: Text('${tr(weekLabels[i])} (${_period(weeks[i])})')),
                    ],
                    onChanged: (value) => setState(() => _week = value ?? _week),
                  ),
                  const SizedBox(height: 12),
                  _priceField(_min, 'Prix le plus bas (le voyage)'),
                  const SizedBox(height: 10),
                  _priceField(_avg, 'Prix courant (le voyage)'),
                  const SizedBox(height: 10),
                  _priceField(_max, 'Prix le plus haut (le voyage)'),
                  const SizedBox(height: 16),
                  BnPrimaryButton(label: tr('Publier le prix'), icon: Icons.publish, busy: _busy, onPressed: _publish),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const BnSectionHead(title: 'Derniers prix publiés'),
          const SizedBox(height: 8),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _current,
            builder: (context, snapshot) {
              final items = snapshot.data ?? const <Map<String, dynamic>>[];
              if (items.isEmpty) return BnCard(child: BnEmpty(message: tr("Aucun prix publié pour l'instant.")));
              return Column(
                children: [
                  for (final item in items)
                    BnCard(
                      onTap: () => _edit(item),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${item['material_name']}', style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
                                Text(
                                  '${tr('${item['truck_name']}')} · ${DateTime.tryParse('${item['week_start']}') == null ? '' : _period(DateTime.parse('${item['week_start']}'))}',
                                  style: const TextStyle(color: BnColors.text3, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            formatFcfa(parseNum(item['price_avg'])),
                            style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(width: 8),
                          _Trend(item: item),
                        ],
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

/// Tendance par rapport à la semaine précédente (hausse en rouge : mauvaise nouvelle pour l'acheteur).
class _Trend extends StatelessWidget {
  const _Trend({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final (icon, color, label) = switch (item['trend']) {
      'up' => (Icons.arrow_upward, BnColors.danger, 'Hausse'),
      'down' => (Icons.arrow_downward, BnColors.success, 'Baisse'),
      _ => (Icons.arrow_forward, BnColors.text3, 'Stable'),
    };
    final change = parseNumOrNull(item['change']);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color, semanticLabel: tr(label)),
        if (change != null)
          Text(
            '${change > 0 ? '+' : ''}${(change * 100).toStringAsFixed(0)} %',
            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
          ),
      ],
    );
  }
}
