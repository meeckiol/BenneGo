import 'dart:async';

import 'package:bennego_core/bennego_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/driver_config.dart';
import '../controllers/driver_controller.dart';

const _truckLabels = {
  'double_benne': 'Double benne',
  'simple_benne': 'Benne simple',
  'plateau': 'Plateau',
  'pickup': 'Pick-up léger',
};

/// Profil du chauffeur (même composition que le profil client web) : photo, parrainage,
/// informations personnelles, véhicule, chiffres, aide et déconnexion.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _me;
  Map<String, dynamic>? _referral;
  bool _uploading = false;

  ApiClient get _api => context.read<ApiClient>();

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait<dynamic>([_api.get('/auth/me'), _api.get('/referrals/me')]);
      if (!mounted) return;
      setState(() {
        _me = (results[0] as Map<String, dynamic>)['user'] as Map<String, dynamic>?;
        _referral = results[1] as Map<String, dynamic>;
      });
    } on ApiException catch (error) {
      _snack(error.message);
    }
  }

  Future<void> _changePhoto() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1024, imageQuality: 85);
    if (file == null) return;
    setState(() => _uploading = true);
    try {
      final form = FormData.fromMap({'photo': MultipartFile.fromBytes(await file.readAsBytes(), filename: file.name)});
      final data = await _api.postForm('/auth/me/photo', form) as Map<String, dynamic>;
      setState(() => _me = {...?_me, 'profile_photo_url': data['profile_photo_url']});
      _snack('Photo de profil mise à jour');
    } on ApiException catch (error) {
      _snack(error.message);
    }
    if (mounted) setState(() => _uploading = false);
  }

  void _shareText(String text) =>
      unawaited(launchUrl(Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}'), mode: LaunchMode.externalApplication));

  void _share() {
    final code = _referral?['referral_code'] as String?;
    if (code != null) _shareText(referralShareText('driver', code, _referral));
  }

  void _support([String? text]) {
    final query = text == null ? '' : '?text=${Uri.encodeComponent(text)}';
    unawaited(launchUrl(Uri.parse('https://wa.me/$supportWhatsApp$query'), mode: LaunchMode.externalApplication));
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<Session>().user;
    final summary = context.watch<DriverController>().summary;
    final truck = _truckLabels[summary?.truckType] ?? 'Camion';
    final photo = _me?['profile_photo_url'] as String?;
    final credit = parseNum(_referral?['credit_balance']);

    return SafeArea(
      child: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Center(
              child: Semantics(
                button: true,
                label: 'Changer la photo de profil',
                child: GestureDetector(
                  onTap: _uploading ? null : _changePhoto,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      // Photo toujours ronde et encadrée : liseré blanc et anneau sable
                      Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(shape: BoxShape.circle, color: BnColors.brand),
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
                          child: CircleAvatar(
                            radius: 44,
                            backgroundColor: const Color(0xFF7A4E14),
                            foregroundImage: photo == null ? null : NetworkImage(_api.resolveUrl(photo)),
                            child: Text(user?.initials ?? 'B',
                                style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)),
                          ),
                        ),
                      ),
                      Positioned(
                        right: -2,
                        bottom: -2,
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFF050508),
                            border: Border.all(color: Colors.white, width: 3),
                          ),
                          child: const Icon(Icons.photo_camera, size: 14, color: Color(0xFFE8C38A)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(user?.fullName ?? '',
                textAlign: TextAlign.center,
                style: const TextStyle(color: BnColors.textStrong, fontSize: 22, fontWeight: FontWeight.w800)),
            Text(user?.phone ?? '', textAlign: TextAlign.center, style: const TextStyle(color: BnColors.text3)),
            const SizedBox(height: 8),
            Center(child: BnPill(label: _uploading ? 'Envoi de la photo…' : 'Camionneur · $truck', tone: BnTone.brand)),
            const SizedBox(height: 18),
            ReferralCard(
              title: 'Parrainage',
              text: referralRewardLine('driver', _referral),
              code: _referral?['referral_code'] as String?,
              rewards: credit > 0 ? 'Crédit : ${formatFcfa(credit)}' : null,
              onShare: _share,
              secondary: OutlinedButton(
                onPressed: () async {
                  await Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => ReferralScreen(api: _api, role: 'driver', onShare: _shareText),
                  ));
                  unawaited(_load());
                },
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFF33343C)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: Text('Mes filleuls (${_referral?['total_referrals'] ?? 0})'),
              ),
            ),
            const SizedBox(height: 16),
            ProfileGroup(children: [
              ProfileRow(
                icon: Icons.person_outline,
                color: const Color(0xFF94A3B8),
                title: 'Informations personnelles',
                subtitle: 'Nom, adresse, e-mail',
                onTap: () async {
                  await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => PersonalInfoScreen(api: _api)));
                  unawaited(_load());
                },
              ),
              ProfileRow(
                icon: Icons.local_shipping_outlined,
                color: BnColors.brand,
                title: 'Véhicule',
                subtitle: summary?.truckPlate == null ? truck : '$truck · ${summary!.truckPlate}',
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) => _VehicleScreen(me: _me, summary: summary, onSupport: supportWhatsApp.isEmpty ? null : _support),
                )),
              ),
            ]),
            const SizedBox(height: 16),
            BnCard(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Row(
                children: [
                  _Stat(value: '${summary?.totalTrips ?? '…'}', label: 'Courses'),
                  _Stat(value: summary == null ? '…' : formatFcfa(summary.thisMonth).replaceAll(' FCFA', ''), label: 'FCFA ce mois'),
                  _Stat(
                    value: summary?.rating == null ? '—' : summary!.rating!.toStringAsFixed(1),
                    label: summary?.ratingCount == null || summary!.ratingCount == 0 ? 'Note' : 'Note · ${summary.ratingCount} avis',
                  ),
                ],
              ),
            ),
            if (supportWhatsApp.isNotEmpty) ...[
              const SizedBox(height: 16),
              ProfileGroup(title: 'Aide', children: [
                ProfileRow(
                  icon: Icons.chat_outlined,
                  color: BnColors.success,
                  title: 'Assistance WhatsApp',
                  subtitle: 'Un souci sur une course ou un paiement',
                  onTap: _support,
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
          Text(label, textAlign: TextAlign.center, style: const TextStyle(color: BnColors.text3, fontSize: 11)),
        ],
      ),
    );
  }
}

/// Véhicule et compte de paiement, en lecture seule : vérifiés par BenneGo.
/// Un changement passe par l'assistance, pour qu'un téléphone volé ne puisse pas détourner les versements.
class _VehicleScreen extends StatelessWidget {
  const _VehicleScreen({required this.me, required this.summary, required this.onSupport});

  final Map<String, dynamic>? me;
  final DriverSummary? summary;
  final void Function([String? text])? onSupport;

  @override
  Widget build(BuildContext context) {
    final momo = me?['momo_number'] as String?;
    final provider = me?['momo_provider'] ?? summary?.momoProvider;
    final masked = momo == null || momo.length < 6 ? '—' : '${momo.substring(0, 4)} •• •• ${momo.substring(momo.length - 2)}';
    final capacity = parseNumOrNull(me?['truck_capacity_m3']) ?? summary?.truckCapacityM3;
    final rows = [
      ('Type de camion', _truckLabels[me?['truck_type'] ?? summary?.truckType] ?? '—'),
      ('Capacité', capacity == null ? '—' : '${capacity.toStringAsFixed(capacity % 1 == 0 ? 0 : 1)} m³'),
      ('Immatriculation', (me?['truck_plate'] ?? summary?.truckPlate ?? '—').toString()),
      ('Paiement des courses', provider == null ? '—' : '${provider == 'mtn' ? 'MTN MoMo' : provider == 'moov' ? 'Moov Money' : provider} · $masked'),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Véhicule')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final (label, value) in rows) ...[
            Text(label, style: const TextStyle(color: BnColors.text2, fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(color: BnColors.surface2, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  const Icon(Icons.lock_outline, size: 16, color: BnColors.text3),
                  const SizedBox(width: 8),
                  Expanded(child: Text(value, style: const TextStyle(color: BnColors.textStrong))),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],
          const Text(
            "Ces informations sont vérifiées par BenneGo. Pour les changer, écrivez à l'assistance.",
            style: TextStyle(color: BnColors.text2),
          ),
          if (onSupport != null) ...[
            const SizedBox(height: 16),
            BnPrimaryButton(
              label: 'Demander une modification',
              icon: Icons.chat_outlined,
              onPressed: () => onSupport!('Bonjour BenneGo, je souhaite modifier les informations de mon véhicule.'),
            ),
          ],
        ],
      ),
    );
  }
}
