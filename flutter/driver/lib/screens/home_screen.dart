import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../controllers/driver_controller.dart';
import 'mission_screen.dart';

/// Accueil du chauffeur : disponibilité, nouvelle commande, mission en cours et indicateurs.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final driver = context.watch<DriverController>();
    final user = context.watch<Session>().user;
    final summary = driver.summary;

    return SafeArea(
      child: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: driver.refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                BnAvatar(initials: user?.initials ?? 'B'),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Bonjour, ${user?.firstName ?? 'chauffeur'}',
                        style: const TextStyle(color: BnColors.textStrong, fontSize: 20, fontWeight: FontWeight.w800),
                      ),
                      Text(
                        summary?.truckPlate == null ? 'Espace chauffeur' : 'Camion ${summary!.truckPlate}',
                        style: const TextStyle(color: BnColors.text2),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _AvailabilityCard(
              available: driver.isAvailable,
              onChanged: driver.setAvailable,
            ),
            if (!driver.isConnected) ...[
              const SizedBox(height: 12),
              const BnBanner(message: 'Connexion temps réel interrompue : reconnexion en cours.'),
            ],
            if (driver.locationDenied) ...[
              const SizedBox(height: 12),
              const BnBanner(
                message: "Localisation refusée : BenneGo ne peut pas suivre votre position. Autorisez-la dans les réglages du téléphone.",
                tone: BnTone.danger,
                icon: Icons.location_off_outlined,
              ),
            ],
            const SizedBox(height: 16),
            if (driver.offer != null)
              _OfferCard(offer: driver.offer!, busy: driver.busy, driver: driver)
            else if (driver.activeOrder != null)
              _ActiveMissionCard(order: driver.activeOrder!)
            else if (!driver.loading)
              const BnCard(
                child: BnEmpty(message: 'Aucune mission en cours. Passez en ligne pour recevoir des courses.'),
              ),
            const SizedBox(height: 16),
            if (summary != null)
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.5,
                children: [
                  BnKpi(label: 'Gains encaissés', value: formatFcfa(summary.paid), icon: Icons.account_balance_wallet_outlined),
                  BnKpi(label: 'Reversement en cours', value: formatFcfa(summary.pendingPayout), icon: Icons.sync, color: BnColors.info),
                  BnKpi(label: 'En attente de confirmation', value: formatFcfa(summary.awaitingConfirmation), icon: Icons.hourglass_empty, color: BnColors.warning),
                  BnKpi(
                    label: 'Note',
                    value: summary.rating == null ? '—' : '${summary.rating!.toStringAsFixed(1)} / 5',
                    sub: '${summary.totalTrips} courses · ${summary.ratingCount} avis',
                    icon: Icons.star_outline,
                    color: BnColors.violet,
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _AvailabilityCard extends StatelessWidget {
  const _AvailabilityCard({required this.available, required this.onChanged});

  final bool available;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return BnCard(
      color: available ? BnColors.success.withValues(alpha: 0.10) : null,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  available ? 'En ligne' : 'Hors ligne',
                  style: TextStyle(
                    color: available ? BnColors.success : BnColors.textStrong,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  available ? 'Vous recevez les nouvelles commandes.' : 'Passez en ligne pour recevoir des courses.',
                  style: const TextStyle(color: BnColors.text2, fontSize: 13),
                ),
              ],
            ),
          ),
          Switch(value: available, activeTrackColor: BnColors.success, onChanged: onChanged),
        ],
      ),
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.offer, required this.busy, required this.driver});

  final IncomingOffer offer;
  final bool busy;
  final DriverController driver;

  @override
  Widget build(BuildContext context) {
    return BnCard(
      color: BnColors.brand.withValues(alpha: 0.10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const BnPill(label: 'Nouvelle commande', tone: BnTone.brand, icon: Icons.notifications_active_outlined),
              const Spacer(),
              Text(offer.orderNumber, style: const TextStyle(color: BnColors.text2, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            formatFcfa(offer.driverAmount),
            style: const TextStyle(color: BnColors.textStrong, fontSize: 26, fontWeight: FontWeight.w800),
          ),
          if (offer.distanceKm != null)
            Text('${offer.distanceKm!.toStringAsFixed(1)} km', style: const TextStyle(color: BnColors.text2)),
          const SizedBox(height: 12),
          _RouteLine(label: 'Chargement', address: offer.pickupAddress),
          const SizedBox(height: 8),
          _RouteLine(label: 'Livraison', address: offer.deliveryAddress),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(onPressed: busy ? null : driver.dismissOffer, child: const Text('Refuser')),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: BnPrimaryButton(label: 'Accepter', icon: Icons.check, busy: busy, onPressed: driver.acceptOffer),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActiveMissionCard extends StatelessWidget {
  const _ActiveMissionCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return BnCard(
      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const MissionScreen())),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusPill(status: order.status),
              const Spacer(),
              Text(order.orderNumber, style: const TextStyle(color: BnColors.text2, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 12),
          _RouteLine(label: 'Chargement', address: order.pickupAddress),
          const SizedBox(height: 8),
          _RouteLine(label: 'Livraison', address: order.deliveryAddress),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                formatFcfa(order.driverAmount),
                style: const TextStyle(color: BnColors.brand, fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const Spacer(),
              const Text('Gérer la mission →', style: TextStyle(color: BnColors.brand, fontWeight: FontWeight.w700)),
            ],
          ),
        ],
      ),
    );
  }
}

class _RouteLine extends StatelessWidget {
  const _RouteLine({required this.label, required this.address});

  final String label;
  final String address;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(label == 'Chargement' ? Icons.trip_origin : Icons.place_outlined, size: 16, color: BnColors.text2),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            '$label : $address',
            style: const TextStyle(color: BnColors.text, fontSize: 13, height: 1.3),
          ),
        ),
      ],
    );
  }
}
