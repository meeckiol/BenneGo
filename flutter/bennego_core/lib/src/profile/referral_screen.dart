import 'dart:async';

import 'package:flutter/material.dart' hide Text;
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../format/format.dart';
import '../theme/bn_theme.dart';
import '../i18n/text.dart';
import '../i18n/lang.dart';

/// Primes du parrain lues dans `GET /referrals/me` (`rewards`), avec les valeurs par défaut des règles.
({double same, double cross, double welcome}) referralRewards(Map<String, dynamic>? data) {
  final rewards = data?['rewards'] as Map<String, dynamic>?;
  final same = rewards?['same_type'] as Map<String, dynamic>?;
  final cross = rewards?['cross_type'] as Map<String, dynamic>?;
  return (
    same: parseNumOrNull(same?['referrer']) ?? 1500,
    cross: parseNumOrNull(cross?['referrer']) ?? 1000,
    welcome: parseNumOrNull(same?['referee']) ?? 1500,
  );
}

/// Phrase des primes pour la carte de parrainage du profil (client ou chauffeur).
String referralRewardLine(String role, Map<String, dynamic>? data) {
  final r = referralRewards(data);
  return role == 'driver'
      ? tr('Chaque camionneur qui livre sa 1re course vous rapporte ${formatFcfa(r.same)} (${formatFcfa(r.cross)} pour un client qui fait sa 1re commande). Votre filleul camionneur reçoit ${formatFcfa(r.welcome)} de bonus.')
      : tr('Chaque ami qui fait sa 1re commande vous rapporte ${formatFcfa(r.same)} (${formatFcfa(r.cross)} pour un camionneur qui livre sa 1re course). Votre ami client reçoit ${formatFcfa(r.welcome)} de réduction.');
}

/// Texte de partage du code : le filleul du même type reçoit sa prime de bienvenue.
String referralShareText(String role, String code, Map<String, dynamic>? data) {
  final welcome = formatFcfa(referralRewards(data).welcome);
  return role == 'driver'
      ? tr('Rejoins BenneGo comme camionneur avec mon code $code : des courses de sable et de gravier près de chez toi, payées sur Mobile Money, et $welcome de bonus à ta première course livrée.')
      : tr('Rejoins BenneGo pour tes livraisons de matériaux avec mon code $code et reçois $welcome de réduction sur ta première commande !');
}

const _roleLabels = {'client': 'Client', 'driver': 'Camionneur'};
const _payoutLabels = {'requested': 'En cours', 'paid': 'Versé', 'rejected': 'Refusé'};

String _day(Object? value) {
  final date = DateTime.tryParse(value?.toString() ?? '');
  return date == null ? '' : DateFormat('d MMM', 'fr_FR').format(date.toLocal());
}

String _firstStep(String? role) => role == 'driver' ? tr('sa 1re course livrée') : tr('sa 1re commande livrée');

/// « Mes filleuls » (client et chauffeur) : crédit BenneGo (versement Mobile Money pour le chauffeur),
/// règles des primes, code à partager, avantage reçu, saisie d'un code et état de chaque filleul.
class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key, required this.api, required this.role, required this.onShare});

  final ApiClient api;

  /// `client` ou `driver`.
  final String role;

  /// Partage du texte (WhatsApp ou feuille de partage), géré par l'application.
  final void Function(String text) onShare;

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
  Map<String, dynamic>? _data;
  final _code = TextEditingController();
  bool _busy = false;

  bool get _driver => widget.role == 'driver';

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await widget.api.get('/referrals/me') as Map<String, dynamic>;
      if (mounted) setState(() => _data = data);
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _data ??= const {});
        _snack(error.message);
      }
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      await _load();
    } on ApiException catch (error) {
      _snack(error.message);
    }
    if (mounted) setState(() => _busy = false);
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _askPayout(double credit) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Versement du crédit'),
        content: Text('Demander le versement de ${formatFcfa(credit)} sur votre Mobile Money ?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Demander')),
        ],
      ),
    );
    if (ok != true) return;
    await _run(() async {
      final res = await widget.api.post('/referrals/credit/payout') as Map<String, dynamic>;
      _snack(res['message'] as String? ?? tr('Demande envoyée'));
    });
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Scaffold(
      appBar: AppBar(title: const Text('Mes filleuls')),
      body: data == null
          ? const Center(child: CircularProgressIndicator(color: BnColors.brand))
          : RefreshIndicator(
              color: BnColors.brand,
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: _sections(data),
              ),
            ),
    );
  }

  List<Widget> _sections(Map<String, dynamic> data) {
    final credit = parseNum(data['credit_balance']);
    final minPayout = parseNumOrNull(data['min_payout']) ?? 500;
    final payouts = (data['payouts'] as List? ?? const []).whereType<Map<String, dynamic>>().toList();
    final referees = (data['referees'] as List? ?? const []).whereType<Map<String, dynamic>>().toList();
    final welcome = data['welcome'] as Map<String, dynamic>?;
    final code = data['referral_code'] as String?;
    final r = referralRewards(data);
    final other = _driver ? 'client' : 'driver';

    return [
      // Crédit BenneGo
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: BnColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: BnColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                gradient: const LinearGradient(colors: [Color(0xFFE8C38A), BnColors.brand]),
              ),
              child: const Icon(Icons.account_balance_wallet_outlined, color: Color(0xFF0B0B10)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Votre crédit BenneGo', style: TextStyle(color: BnColors.text3, fontSize: 12)),
                  Text(formatFcfa(credit), style: const TextStyle(color: BnColors.textStrong, fontSize: 26, fontWeight: FontWeight.w800)),
                  Text(
                    _driver
                        ? tr('Versé sur votre Mobile Money à la demande (dès ${formatFcfa(minPayout)}).')
                        : tr('À utiliser quand vous voulez : activez « Utiliser mon crédit » au moment du prix.'),
                    style: const TextStyle(color: BnColors.text2, fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      if (_driver) ...[
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _busy || credit < minPayout || payouts.any((p) => p['status'] == 'requested') ? null : () => _askPayout(credit),
          style: FilledButton.styleFrom(
            backgroundColor: BnColors.brand,
            foregroundColor: const Color(0xFF0B0B10),
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            textStyle: const TextStyle(fontWeight: FontWeight.w800),
          ),
          child: const Text('Demander le versement'),
        ),
        for (final p in payouts)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text('${_day(p['requested_at'])} · ${formatFcfa(parseNum(p['amount']))}',
                      style: const TextStyle(color: BnColors.text2, fontSize: 13)),
                ),
                Text(
                  _payoutLabels[p['status']] ?? '${p['status']}',
                  style: TextStyle(
                    color: p['status'] == 'paid' ? BnColors.success : (p['status'] == 'rejected' ? BnColors.danger : BnColors.text2),
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
      ],
      const SizedBox(height: 16),

      // Code à partager
      Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: const Color(0xFF050508), borderRadius: BorderRadius.circular(22)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Votre code', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: code == null
                  ? null
                  : () {
                      Clipboard.setData(ClipboardData(text: code));
                      _snack('Code copié');
                    },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(color: const Color(0xFF1C1D24), borderRadius: BorderRadius.circular(14)),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(code ?? '—',
                          style: const TextStyle(color: Color(0xFFE8C38A), fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: 2)),
                    ),
                    const Icon(Icons.copy, color: Color(0xFFE8C38A), size: 18),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: code == null ? null : () => widget.onShare(referralShareText(widget.role, code, data)),
              icon: const Icon(Icons.share, size: 16),
              label: const Text('Partager mon code'),
              style: FilledButton.styleFrom(
                backgroundColor: BnColors.brand,
                foregroundColor: const Color(0xFF0B0B10),
                minimumSize: const Size.fromHeight(44),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                textStyle: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),

      // Règles
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: BnColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: BnColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Comment ça marche', style: TextStyle(color: BnColors.textStrong, fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            _Rule(
              '${_driver ? 'Un camionneur' : tr('Un client')} : ${formatFcfa(r.same)} pour vous quand il fait ${_firstStep(widget.role)}. '
              'Il reçoit aussi ${formatFcfa(r.welcome)} ${_driver ? 'de bonus' : tr('de réduction sur sa 1re commande')}.',
            ),
            _Rule('${_driver ? 'Un client' : tr('Un camionneur')} : ${formatFcfa(r.cross)} pour vous quand il fait ${_firstStep(other)}.'),
            const _Rule('Votre filleul saisit votre code à son inscription, avant sa 1re commande ou course.'),
          ],
        ),
      ),
      if (welcome != null) ...[
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: BnColors.success.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
          child: Text(
            'Parrainé par ${welcome['referrer']}'
            '${parseNum(welcome['amount']) > 0 ? (_driver ? ' : ${formatFcfa(parseNum(welcome['amount']))} de bonus à votre 1re course livrée${welcome['status'] == 'rewarded' ? ' (reçus)' : ''}.' : ' : ${formatFcfa(parseNum(welcome['amount']))} de réduction sur votre 1re commande${welcome['status'] == 'rewarded' ? ' (utilisés)' : ''}.') : '.'}',
            style: const TextStyle(color: BnColors.success, fontSize: 14),
          ),
        ),
      ],
      if (data['can_apply_code'] == true) ...[
        const SizedBox(height: 16),
        TextField(
          controller: _code,
          textCapitalization: TextCapitalization.characters,
          maxLength: 30,
          decoration: InputDecoration(labelText: tr('Vous avez un code parrain ?'), counterText: ''),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _busy
              ? null
              : () => _run(() async {
                    final code = _code.text.trim();
                    if (code.isEmpty) return;
                    final res = await widget.api.post('/referrals', body: {'referral_code': code}) as Map<String, dynamic>;
                    _code.clear();
                    _snack(res['message'] as String? ?? tr('Code parrain enregistré'));
                  }),
          child: const Text('Valider le code'),
        ),
      ],
      const SizedBox(height: 20),

      // Filleuls
      Text('${data['total_referrals'] ?? 0} filleul(s)',
          style: const TextStyle(color: BnColors.textStrong, fontSize: 16, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      if (referees.isEmpty)
        const Text('Partagez votre code : vos filleuls apparaîtront ici avec l\'avancement de votre prime.',
            style: TextStyle(color: BnColors.text2))
      else
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: BnColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: BnColors.border),
          ),
          child: Column(
            children: [
              for (var i = 0; i < referees.length; i++) ...[
                if (i > 0) const Divider(height: 1, color: BnColors.border),
                _RefereeRow(referee: referees[i]),
              ],
            ],
          ),
        ),
    ];
  }
}

class _Rule extends StatelessWidget {
  const _Rule(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('•  ', style: TextStyle(color: BnColors.brand)),
          Expanded(child: Text(text, style: const TextStyle(color: BnColors.text2, fontSize: 14, height: 1.4))),
        ],
      ),
    );
  }
}

class _RefereeRow extends StatelessWidget {
  const _RefereeRow({required this.referee});

  final Map<String, dynamic> referee;

  @override
  Widget build(BuildContext context) {
    final won = referee['status'] == 'rewarded';
    final name = referee['name'] as String? ?? tr('Filleul');
    final role = referee['role'] as String?;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          CircleAvatar(
            radius: 19,
            backgroundColor: const Color(0xFF050508),
            child: Text(name.isEmpty ? '?' : name[0], style: const TextStyle(color: Color(0xFFE8C38A), fontWeight: FontWeight.w800)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(TextSpan(children: [
                  TextSpan(text: name, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
                  TextSpan(text: '  ${_roleLabels[role] ?? ''}', style: const TextStyle(color: BnColors.brand, fontSize: 11, fontWeight: FontWeight.w700)),
                ])),
                Text(
                  won ? 'Prime gagnée le ${_day(referee['rewarded_at'])}' : 'Inscrit le ${_day(referee['created_at'])} · en attente de ${_firstStep(role)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: BnColors.text3, fontSize: 12),
                ),
              ],
            ),
          ),
          Text(
            '${won ? '+' : ''}${formatFcfa(parseNum(referee['reward']))}',
            style: TextStyle(color: won ? BnColors.success : BnColors.text3, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
