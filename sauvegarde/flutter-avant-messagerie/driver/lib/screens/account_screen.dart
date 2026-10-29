import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../controllers/driver_controller.dart';

/// Profil du chauffeur, véhicule et déconnexion.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<Session>().user;
    final summary = context.watch<DriverController>().summary;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              BnAvatar(initials: user?.initials ?? 'B', size: 56),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user?.fullName ?? '', style: const TextStyle(color: BnColors.textStrong, fontSize: 18, fontWeight: FontWeight.w800)),
                    Text(user?.phone ?? '', style: const TextStyle(color: BnColors.text2)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          BnCard(
            child: Column(
              children: [
                _Line(label: 'Camion', value: summary?.truckPlate ?? 'Non renseigné'),
                _Line(label: 'Type de benne', value: summary?.truckType ?? 'Non renseigné'),
                _Line(label: 'Note', value: summary?.rating == null ? '—' : '${summary!.rating!.toStringAsFixed(1)} / 5'),
              ],
            ),
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () => context.read<Session>().logout(),
            icon: const Icon(Icons.logout),
            label: const Text('Se déconnecter'),
          ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: BnColors.text2))),
          Text(value, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
