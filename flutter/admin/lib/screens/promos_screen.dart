import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';

import '../data/admin_repository.dart';

/// Codes promo : création et suppression. Une remise est en pourcentage ou en montant fixe.
class PromosScreen extends StatefulWidget {
  const PromosScreen({super.key});

  @override
  State<PromosScreen> createState() => _PromosScreenState();
}

class _PromosScreenState extends State<PromosScreen> {
  late Future<List<Promo>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AdminRepository>().promos();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<AdminRepository>().promos());
    await _future;
  }

  void _toast(String message) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _create() async {
    final repo = context.read<AdminRepository>();
    final body = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: BnColors.surface,
      builder: (_) => const _PromoSheet(),
    );
    if (body == null) return;
    try {
      await repo.savePromo(body);
      _toast('Code promo créé');
      await _reload();
    } on ApiException catch (error) {
      _toast(error.message);
    }
  }

  Future<void> _delete(Promo promo) async {
    final repo = context.read<AdminRepository>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: BnColors.surface,
        content: Text('Supprimer le code ${promo.code} ?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuler')),
          ElevatedButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Supprimer')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await repo.deletePromo(promo.id);
      _toast('Code promo supprimé');
      await _reload();
    } on ApiException catch (error) {
      _toast(error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Codes promo')),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: BnColors.brand,
        foregroundColor: Colors.white,
        onPressed: _create,
        icon: const Icon(Icons.add),
        label: const Text('Nouveau code'),
      ),
      body: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: _reload,
        child: FutureBuilder<List<Promo>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator(color: BnColors.brand));
            }
            final promos = snapshot.data ?? const <Promo>[];
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              children: [
                if (promos.isEmpty) BnCard(child: BnEmpty(message: tr('Aucun code promo pour le moment.'))),
                for (final promo in promos) ...[
                  BnCard(
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(promo.code, style: const TextStyle(color: BnColors.textStrong, fontSize: 18, fontWeight: FontWeight.w800)),
                              const SizedBox(height: 4),
                              Text(
                                '${promo.discountLabel} · ${promo.usedCount} / ${promo.usageLimit} utilisations',
                                style: const TextStyle(color: BnColors.text2, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        BnPill(label: promo.isActive ? tr('Actif') : tr('Inactif'), tone: promo.isActive ? BnTone.success : BnTone.neutral),
                        IconButton(
                          tooltip: tr('Supprimer'),
                          onPressed: () => _delete(promo),
                          icon: const Icon(Icons.delete_outline, color: BnColors.danger),
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

/// Formulaire de création d'un code promo ; renvoie le corps de la requête.
class _PromoSheet extends StatefulWidget {
  const _PromoSheet();

  @override
  State<_PromoSheet> createState() => _PromoSheetState();
}

class _PromoSheetState extends State<_PromoSheet> {
  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController();
  final _value = TextEditingController();
  final _usage = TextEditingController(text: '100');
  String _type = 'percentage';

  @override
  void dispose() {
    _code.dispose();
    _value.dispose();
    _usage.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop({
      'code': _code.text.trim().toUpperCase(),
      'discount_type': _type,
      'discount_value': double.parse(_value.text.trim().replaceAll(',', '.')),
      'min_order_amount': null,
      'max_discount': null,
      'usage_limit': int.parse(_usage.text.trim()),
      'expires_at': null,
      'is_active': true,
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Nouveau code promo', style: TextStyle(color: BnColors.textStrong, fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            TextFormField(
              controller: _code,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(labelText: tr('Code'), hintText: tr('ex. BTP2026')),
              validator: (v) => (v == null || v.trim().length < 3) ? tr('3 caractères minimum') : null,
            ),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'percentage', label: Text('Pourcentage')),
                ButtonSegment(value: 'fixed', label: Text('Montant fixe')),
              ],
              selected: {_type},
              onSelectionChanged: (selection) => setState(() => _type = selection.first),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _value,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(labelText: _type == 'percentage' ? tr('Remise (%)') : tr('Remise (FCFA)')),
              validator: (v) {
                final value = double.tryParse((v ?? '').trim().replaceAll(',', '.'));
                if (value == null || value <= 0) return tr('Valeur invalide');
                if (_type == 'percentage' && value > 100) return tr('Au maximum 100 %');
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _usage,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: tr("Nombre d'utilisations")),
              validator: (v) => ((int.tryParse(v ?? '') ?? 0) < 1) ? tr('Au moins 1') : null,
            ),
            const SizedBox(height: 20),
            BnPrimaryButton(label: tr('Créer le code'), icon: Icons.check, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}
