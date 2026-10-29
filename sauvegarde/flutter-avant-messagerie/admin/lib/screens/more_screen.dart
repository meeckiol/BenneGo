import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';

import 'barometer_screen.dart';
import 'promos_screen.dart';
import 'reliefs_screen.dart';
import 'reviews_screen.dart';

/// Outils : pannes et relèves, baromètre BTP, codes promo et avis.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Outils', style: TextStyle(color: BnColors.textStrong, fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _Tile(
            icon: Icons.build_outlined,
            title: 'Pannes & relèves',
            subtitle: 'Reprendre une course après une panne',
            page: const ReliefsScreen(),
          ),
          _Tile(
            icon: Icons.trending_up,
            title: 'Baromètre BTP',
            subtitle: "Publier l'indice hebdomadaire",
            page: const BarometerScreen(),
          ),
          _Tile(
            icon: Icons.local_offer_outlined,
            title: 'Codes promo',
            subtitle: 'Créer et supprimer les codes',
            page: const PromosScreen(),
          ),
          _Tile(
            icon: Icons.star_outline,
            title: 'Avis',
            subtitle: 'Avis clients sur la plateforme et les chauffeurs',
            page: const ReviewsScreen(),
          ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.title, required this.subtitle, required this.page});

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget page;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: BnCard(
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page)),
        child: Row(
          children: [
            Icon(icon, color: BnColors.brand),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
                  Text(subtitle, style: const TextStyle(color: BnColors.text2, fontSize: 12)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: BnColors.text3),
          ],
        ),
      ),
    );
  }
}
