import 'dart:async';

import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/client_config.dart';
import '../data/client_repository.dart';

/// Profil du client (comme le profil web) : en-tête, carte du code parrain, informations personnelles,
/// chiffres, aide et déconnexion. Le parrainage n'a plus d'onglet : il est ici.
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  Map<String, dynamic>? _referral;
  List<Order>? _orders;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final repo = context.read<ClientRepository>();
    try {
      final results = await Future.wait<dynamic>([repo.referral(), repo.orders(limit: 100)]);
      if (!mounted) return;
      setState(() {
        _referral = results[0] as Map<String, dynamic>;
        _orders = results[1] as List<Order>;
      });
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  void _shareText(String text) =>
      unawaited(launchUrl(Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}'), mode: LaunchMode.externalApplication));

  void _share() {
    final code = _referral?['referral_code'] as String?;
    if (code != null) _shareText(referralShareText('client', code, _referral));
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<Session>().user;
    final orders = _orders;
    final delivered = orders?.where((o) => o.status == 'validated' || o.status == 'completed').length;
    final credit = parseNum(_referral?['credit_balance']);
    return SafeArea(
      child: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Center(child: BnAvatar(initials: user?.initials ?? 'B', size: 88)),
            const SizedBox(height: 12),
            Text(user?.fullName ?? '',
                textAlign: TextAlign.center,
                style: const TextStyle(color: BnColors.textStrong, fontSize: 22, fontWeight: FontWeight.w800)),
            Text(user?.phone ?? '', textAlign: TextAlign.center, style: const TextStyle(color: BnColors.text3)),
            const SizedBox(height: 8),
            Center(child: BnPill(label: tr('Compte client'), tone: BnTone.brand)),
            const SizedBox(height: 18),
            ReferralCard(
              title: 'Affiliation',
              text: referralRewardLine('client', _referral),
              code: _referral?['referral_code'] as String?,
              rewards: credit > 0 ? tr('Crédit : ${formatFcfa(credit)}') : null,
              onShare: _share,
              secondary: OutlinedButton(
                onPressed: () async {
                  await Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => ReferralScreen(api: context.read<ApiClient>(), role: 'client', onShare: _shareText),
                  ));
                  unawaited(_load());
                },
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFF33343C)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('Mes filleuls'),
              ),
            ),
            const SizedBox(height: 16),
            ProfileGroup(children: [
              ProfileRow(
                icon: Icons.person_outline,
                color: const Color(0xFF94A3B8),
                title: 'Informations personnelles',
                subtitle: 'Nom, adresse, e-mail',
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) => PersonalInfoScreen(api: context.read<ApiClient>()),
                )),
              ),
            ]),
            const SizedBox(height: 16),
            BnCard(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Row(
                children: [
                  _Stat(value: orders == null ? '…' : '${orders.length}', label: tr('Commandes')),
                  _Stat(value: delivered == null ? '…' : '$delivered', label: tr('Livrées')),
                  _Stat(value: '${_referral?['total_referrals'] ?? '…'}', label: 'Filleuls'),
                ],
              ),
            ),
            const SizedBox(height: 16),
            ProfileGroup(title: 'Réglages', children: [
              ProfileRow(
                icon: Icons.settings_outlined,
                color: const Color(0xFF94A3B8),
                title: 'Réglages',
                subtitle: 'Notifications, confidentialité, sécurité, suppression',
                onTap: () => openAccountSettings(context, context.read<Session>()),
              ),
            ]),
            if (supportWhatsApp.isNotEmpty) ...[
              const SizedBox(height: 16),
              ProfileGroup(title: 'Aide', children: [
                ProfileRow(
                  icon: Icons.chat_outlined,
                  color: BnColors.success,
                  title: 'Assistance WhatsApp',
                  subtitle: 'Une question sur une commande',
                  onTap: () => launchUrl(Uri.parse('https://wa.me/$supportWhatsApp'), mode: LaunchMode.externalApplication),
                ),
              ]),
            ],
            const SizedBox(height: 16),
            ProfileGroup(children: [
              ProfileRow(
                icon: Icons.logout,
                color: BnColors.danger,
                title: 'Se déconnecter',
                danger: true,
                onTap: () => context.read<Session>().logout(),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: const TextStyle(color: BnColors.textStrong, fontSize: 18, fontWeight: FontWeight.w800)),
          Text(label, style: const TextStyle(color: BnColors.text3, fontSize: 11)),
        ],
      ),
    );
  }
}
