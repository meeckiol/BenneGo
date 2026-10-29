import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../data/client_repository.dart';

/// Parrainage : code personnel à partager et saisie du code d'un parrain.
class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key});

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
  late Future<Map<String, dynamic>> _future;
  final _friendCode = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _future = context.read<ClientRepository>().referral();
  }

  @override
  void dispose() {
    _friendCode.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<ClientRepository>().referral());
    await _future;
  }

  Future<void> _apply() async {
    final code = _friendCode.text.trim();
    if (code.isEmpty) return;
    setState(() => _busy = true);
    try {
      await context.read<ClientRepository>().applyReferralCode(code);
      _friendCode.clear();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Code parrain validé')));
      await _reload();
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: _reload,
        child: FutureBuilder<Map<String, dynamic>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator(color: BnColors.brand));
            }
            final data = snapshot.data ?? const <String, dynamic>{};
            final code = data['referral_code'] as String? ?? '';
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                const Text('Parrainage', style: TextStyle(color: BnColors.textStrong, fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                BnCard(
                  color: BnColors.brand.withValues(alpha: 0.12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Votre code', style: TextStyle(color: BnColors.text2)),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              code.isEmpty ? '—' : code,
                              style: const TextStyle(color: BnColors.brand, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 2),
                            ),
                          ),
                          IconButton(
                            tooltip: 'Copier',
                            onPressed: code.isEmpty
                                ? null
                                : () {
                                    Clipboard.setData(ClipboardData(text: code));
                                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Code copié')));
                                  },
                            icon: const Icon(Icons.copy, color: BnColors.brand),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${data['total_referrals'] ?? 0} filleul(s) · ${formatFcfa(parseNum(data['total_rewards']))} gagnés',
                        style: const TextStyle(color: BnColors.text2, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                BnCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const BnSectionHead(title: 'Vous avez un code parrain ?'),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _friendCode,
                        textCapitalization: TextCapitalization.characters,
                        decoration: const InputDecoration(labelText: 'Code parrain'),
                      ),
                      const SizedBox(height: 12),
                      BnPrimaryButton(label: 'Valider le code', busy: _busy, onPressed: _apply),
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
