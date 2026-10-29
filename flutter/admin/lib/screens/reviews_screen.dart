import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';

import '../data/admin_repository.dart';

/// Avis clients : sur la plateforme et sur les chauffeurs.
class ReviewsScreen extends StatefulWidget {
  const ReviewsScreen({super.key});

  @override
  State<ReviewsScreen> createState() => _ReviewsScreenState();
}

class _ReviewsScreenState extends State<ReviewsScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AdminRepository>().reviews();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<AdminRepository>().reviews());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Avis')),
      body: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: _reload,
        child: FutureBuilder<Map<String, dynamic>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator(color: BnColors.brand));
            }
            final platform = (snapshot.data?['platform_reviews'] as List? ?? const []).cast<Map<String, dynamic>>();
            final drivers = (snapshot.data?['driver_reviews'] as List? ?? const []).cast<Map<String, dynamic>>();
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                BnSectionHead(title: 'Avis sur la plateforme (${platform.length})'),
                const SizedBox(height: 8),
                if (platform.isEmpty) BnCard(child: BnEmpty(message: tr("Aucun avis pour l'instant."))),
                for (final review in platform) _ReviewCard(review: review, who: '${review['client_name'] ?? ''}'),
                const SizedBox(height: 16),
                BnSectionHead(title: 'Avis sur les chauffeurs (${drivers.length})'),
                const SizedBox(height: 8),
                if (drivers.isEmpty) BnCard(child: BnEmpty(message: tr("Aucun avis pour l'instant."))),
                for (final review in drivers)
                  _ReviewCard(
                    review: review,
                    who: '${review['client_name'] ?? ''} → ${review['driver_name'] ?? ''}',
                    sub: '${review['order_number'] ?? ''}',
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review, required this.who, this.sub});

  final Map<String, dynamic> review;
  final String who;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    final rating = (review['rating'] as num?)?.toInt() ?? 0;
    final comment = review['comment'] as String? ?? '';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: BnCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(who, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
                ),
                for (var star = 1; star <= 5; star++)
                  Icon(star <= rating ? Icons.star : Icons.star_outline, size: 16, color: BnColors.warning),
              ],
            ),
            if (comment.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(comment, style: const TextStyle(color: BnColors.text, height: 1.35)),
            ],
            const SizedBox(height: 6),
            Text(
              [if (sub != null && sub!.isNotEmpty) sub!, formatDateTime(DateTime.tryParse(review['created_at'] as String? ?? review['rated_at'] as String? ?? ''))].join(' · '),
              style: const TextStyle(color: BnColors.text3, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}
