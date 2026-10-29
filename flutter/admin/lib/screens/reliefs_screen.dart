import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';

import '../data/admin_repository.dart';

typedef _Reliefs = ({List<ReliefRequest> requests, List<ReliefCandidate> candidates});

/// Pannes signalées : choisir un chauffeur de relève parmi les disponibles.
class ReliefsScreen extends StatefulWidget {
  const ReliefsScreen({super.key});

  @override
  State<ReliefsScreen> createState() => _ReliefsScreenState();
}

class _ReliefsScreenState extends State<ReliefsScreen> {
  late Future<_Reliefs> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AdminRepository>().reliefs();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<AdminRepository>().reliefs());
    await _future;
  }

  Future<void> _assign(ReliefRequest request, List<ReliefCandidate> candidates) async {
    final candidate = await showModalBottomSheet<ReliefCandidate>(
      context: context,
      backgroundColor: BnColors.surface,
      builder: (sheetContext) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Relève de ${request.orderNumber}',
              style: const TextStyle(color: BnColors.textStrong, fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            for (final candidate in candidates)
              ListTile(
                title: Text(candidate.fullName),
                subtitle: Text('${candidate.truckPlate} · ${candidate.truckType}'),
                onTap: () => Navigator.of(sheetContext).pop(candidate),
              ),
          ],
        ),
      ),
    );
    if (candidate == null || !mounted) return;
    try {
      await context.read<AdminRepository>().assignRelief(request.id, candidate.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${candidate.fullName} assigné à la relève')));
      }
      await _reload();
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pannes & relèves')),
      body: RefreshIndicator(
        color: BnColors.brand,
        onRefresh: _reload,
        child: FutureBuilder<_Reliefs>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator(color: BnColors.brand));
            }
            final data = snapshot.data;
            final requests = data?.requests ?? const <ReliefRequest>[];
            final candidates = data?.candidates ?? const <ReliefCandidate>[];
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                BnBanner(
                  message: tr('${candidates.length} chauffeur(s) disponible(s) avec Mobile Money, sans course en cours.'),
                  tone: BnTone.info,
                  icon: Icons.groups_outlined,
                ),
                const SizedBox(height: 12),
                if (requests.isEmpty) BnCard(child: BnEmpty(message: tr('Aucune panne à reprendre.'))),
                for (final request in requests) ...[
                  BnCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(request.orderNumber, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800)),
                            const Spacer(),
                            BnPill(label: request.breakdownReason, tone: BnTone.danger),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text('Chauffeur en panne : ${request.originalDriverName}', style: const TextStyle(color: BnColors.text2, fontSize: 12)),
                        const SizedBox(height: 6),
                        Text('Trajet : ${request.pickupAddress} → ${request.deliveryAddress}', style: const TextStyle(color: BnColors.text, fontSize: 13)),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: candidates.isEmpty ? null : () => _assign(request, candidates),
                          child: const Text('Choisir un chauffeur de relève'),
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
