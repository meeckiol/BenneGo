import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/admin_repository.dart';

const _trends = {'up': 'Hausse', 'stable': 'Stable', 'down': 'Baisse'};

/// Publication de l'indice hebdomadaire des prix BTP, affiché sur l'accueil client.
class BarometerScreen extends StatefulWidget {
  const BarometerScreen({super.key});

  @override
  State<BarometerScreen> createState() => _BarometerScreenState();
}

class _BarometerScreenState extends State<BarometerScreen> {
  final _formKey = GlobalKey<FormState>();
  final _material = TextEditingController();
  final _min = TextEditingController();
  final _avg = TextEditingController();
  final _max = TextEditingController();
  late final TextEditingController _week;
  late final TextEditingController _year;
  late Future<List<Map<String, dynamic>>> _current;
  String _trend = 'stable';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final now = isoWeekOf(DateTime.now());
    _week = TextEditingController(text: '${now.week}');
    _year = TextEditingController(text: '${now.year}');
    _current = context.read<AdminRepository>().barometer();
  }

  @override
  void dispose() {
    for (final controller in [_material, _min, _avg, _max, _week, _year]) {
      controller.dispose();
    }
    super.dispose();
  }

  double? _money(TextEditingController controller) => double.tryParse(controller.text.trim().replaceAll(',', '.'));

  void _toast(String message) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _publish() async {
    if (!_formKey.currentState!.validate()) return;
    final min = _money(_min)!;
    final avg = _money(_avg)!;
    final max = _money(_max)!;
    if (!(min <= avg && avg <= max)) {
      _toast('Le prix minimum doit être inférieur ou égal au moyen, lui-même inférieur ou égal au maximum.');
      return;
    }
    setState(() => _busy = true);
    try {
      await context.read<AdminRepository>().publishBarometer({
        'material_name': _material.text.trim(),
        'min_price_m3': min,
        'avg_price_m3': avg,
        'max_price_m3': max,
        'trend': _trend,
        'week_number': int.parse(_week.text.trim()),
        'year': int.parse(_year.text.trim()),
      });
      _toast('Indice publié sur la page d\'accueil client');
      setState(() {
        _current = context.read<AdminRepository>().barometer();
        _material.clear();
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

  String? _requiredNumber(String? value) {
    final number = double.tryParse((value ?? '').trim().replaceAll(',', '.'));
    return (number == null || number <= 0) ? 'Prix invalide' : null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Baromètre BTP')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          BnCard(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _material,
                    decoration: const InputDecoration(labelText: 'Matériau', hintText: 'ex. Gravier concassé 15/25'),
                    validator: (v) => (v == null || v.trim().length < 2) ? 'Requis' : null,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _min,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: 'Minimum (FCFA/m³)'),
                          validator: _requiredNumber,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _avg,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: 'Moyen'),
                          validator: _requiredNumber,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _max,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: 'Maximum'),
                          validator: _requiredNumber,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _trend,
                    decoration: const InputDecoration(labelText: 'Tendance'),
                    items: [for (final entry in _trends.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
                    onChanged: (value) => setState(() => _trend = value ?? _trend),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _week,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Semaine ISO'),
                          validator: (v) => (int.tryParse(v ?? '') == null) ? 'Invalide' : null,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _year,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Année'),
                          validator: (v) => (int.tryParse(v ?? '') == null) ? 'Invalide' : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  BnPrimaryButton(label: "Publier l'indice", icon: Icons.publish, busy: _busy, onPressed: _publish),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const BnSectionHead(title: 'Indices publiés'),
          const SizedBox(height: 8),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _current,
            builder: (context, snapshot) {
              final items = snapshot.data ?? const <Map<String, dynamic>>[];
              if (items.isEmpty) return const BnCard(child: BnEmpty(message: 'Aucun indice publié cette semaine.'));
              return Column(
                children: [
                  for (final item in items)
                    BnCard(
                      child: Row(
                        children: [
                          Expanded(
                            child: Text('${item['material_name']}', style: const TextStyle(color: BnColors.text)),
                          ),
                          Text(
                            '${formatFcfa(parseNum(item['avg_price_m3']))}/m³',
                            style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700),
                          ),
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
