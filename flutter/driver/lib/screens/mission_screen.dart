import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../controllers/driver_controller.dart';
import '../domain/mission_steps.dart';
import '../widgets/forms.dart';
import 'chat_route.dart';

/// Mission en cours : étape suivante, formulaires de chargement et de livraison, panne et itinéraire.
class MissionScreen extends StatelessWidget {
  const MissionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final driver = context.watch<DriverController>();
    final order = driver.activeOrder;
    if (order == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Mission')),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Cette mission est terminée.', style: TextStyle(color: BnColors.text2)),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Retour')),
            ],
          ),
        ),
      );
    }

    final step = nextMissionStep(order);
    final api = context.read<ApiClient>();
    final unread = context.watch<ChatCenter>().unreadFor(order.id);
    return Scaffold(
      appBar: AppBar(
        title: Text(order.orderNumber),
        actions: [
          // Discussion avec le client, en plein écran, avec ses messages non lus
          IconButton(
            tooltip: 'Messages',
            onPressed: () => openChat(context, order),
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text(unread > 9 ? '9+' : '$unread'),
              child: const Icon(Icons.chat_bubble_outline),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: driver.refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            BnCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      BnPill(label: _typeLabel(order.orderType), tone: BnTone.brand),
                      const SizedBox(width: 8),
                      StatusPill(status: order.status),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _Address(label: 'Chargement', address: order.pickupAddress, icon: Icons.trip_origin),
                  const SizedBox(height: 10),
                  _Address(label: 'Livraison', address: order.deliveryAddress, icon: Icons.place_outlined),
                  const Divider(height: 28, color: BnColors.border),
                  _Fact(label: 'Gain chauffeur', value: formatFcfa(order.driverAmount)),
                  _Fact(label: 'Volume commandé', value: '${order.quantityM3} m³'),
                  if (order.distanceKm != null) _Fact(label: 'Distance', value: '${order.distanceKm!.toStringAsFixed(1)} km'),
                  if (order.isLoadingRecorded)
                    _Fact(
                      label: 'Chargement déclaré',
                      value: '${order.loadingVolumeM3} m³${order.weighbridgeNetKg == null ? '' : ' · ${order.weighbridgeNetKg!.round()} kg'}',
                    ),
                ],
              ),
            ),
            if (order.isDisputeOpen) ...[
              const SizedBox(height: 12),
              BnBanner(
                message: 'Litige ouvert par le client${order.disputeReason == null ? '' : ' : ${order.disputeReason}'}. BenneGo examine la commande.',
                tone: BnTone.danger,
                icon: Icons.gavel_outlined,
              ),
            ],
            const SizedBox(height: 16),
            BnCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const BnSectionHead(title: 'Étape suivante'),
                  const SizedBox(height: 12),
                  if (step != null)
                    BnPrimaryButton(
                      label: step.label,
                      icon: Icons.arrow_forward,
                      busy: driver.busy,
                      onPressed: () => _runStep(context, driver, step),
                    )
                  else
                    const Text(
                      'Rien à faire pour le moment : en attente de la confirmation du client.',
                      style: TextStyle(color: BnColors.text2),
                    ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () => _openRoute(order),
                    icon: const Icon(Icons.navigation_outlined),
                    label: const Text('Itinéraire'),
                  ),
                  if (breakdownStatuses.contains(order.status)) ...[
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: driver.busy ? null : () => _pickBreakdown(context, driver),
                      icon: const Icon(Icons.build_outlined),
                      label: const Text('Signaler une panne'),
                    ),
                  ],
                ],
              ),
            ),
            if (order.photos.isNotEmpty || order.podPhotos.isNotEmpty) ...[
              const SizedBox(height: 16),
              BnCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const BnSectionHead(title: 'Photos'),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final path in order.photos.map((photo) => photo.path).followedBy(order.podPhotos))
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.network(
                              api.resolveUrl(path),
                              width: 84,
                              height: 84,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => Container(
                                width: 84,
                                height: 84,
                                color: BnColors.surface2,
                                child: const Icon(Icons.broken_image_outlined, color: BnColors.text3),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _runStep(BuildContext context, DriverController driver, MissionStep step) async {
    switch (step.kind) {
      case MissionStepKind.status:
        await driver.advance(step.nextStatus!);
      case MissionStepKind.loading:
        final submitted = await showLoadingSheet(context);
        if (submitted != null) {
          await driver.submitLoading(
            volumeM3: submitted.volumeM3,
            weighbridgeKg: submitted.weighbridgeKg,
            photos: submitted.photos,
            weighbridgeTicket: submitted.weighbridgeTicket,
          );
        }
      case MissionStepKind.pod:
        final photos = await showPodSheet(context);
        if (photos != null) await driver.submitPod(photos);
    }
  }

  Future<void> _pickBreakdown(BuildContext context, DriverController driver) async {
    const reasons = {
      'crevaison': 'Crevaison',
      'panne_moteur': 'Panne moteur',
      'accident': 'Accident',
      'autre': 'Autre problème',
    };
    final reason = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Quel est le problème ?', style: TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800)),
            ),
            for (final entry in reasons.entries)
              ListTile(
                title: Text(entry.value),
                onTap: () => Navigator.of(sheetContext).pop(entry.key),
              ),
          ],
        ),
      ),
    );
    if (reason != null) await driver.reportBreakdown(reason);
  }

  Future<void> _openRoute(Order order) async {
    final toPickup = order.status == 'accepted' || order.status == 'driver_en_route_pickup';
    final lat = toPickup ? order.pickupLat : order.deliveryLat;
    final lng = toPickup ? order.pickupLng : order.deliveryLng;
    final uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  String _typeLabel(String type) => switch (type) {
        'RENTAL' => 'Location d\'engin',
        'EVACUATION' => 'Évacuation',
        _ => 'Matériaux',
      };
}

class _Address extends StatelessWidget {
  const _Address({required this.label, required this.address, required this.icon});

  final String label;
  final String address;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: BnColors.brand),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: BnColors.text3, fontSize: 12)),
              Text(address, style: const TextStyle(color: BnColors.textStrong, fontSize: 15, height: 1.3)),
            ],
          ),
        ),
      ],
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: BnColors.text2))),
          Text(value, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
