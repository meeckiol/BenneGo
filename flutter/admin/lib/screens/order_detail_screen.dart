import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';

import '../data/admin_repository.dart';
import 'messages_screen.dart';

const _typeLabels = {
  'MATERIAL': 'Transport de matériaux',
  'RENTAL': "Location d'engin",
  'EVACUATION': 'Évacuation de gravats',
};

const _paymentLabels = {
  'unpaid': ('Non payé', BnTone.warning),
  'escrow_held': ('Séquestre', BnTone.info),
  'released': ('Libéré', BnTone.success),
  'refunded': ('Remboursé', BnTone.danger),
};

/// Fiche commande de l'administration : intervenants, trajet, détail du prix, répartition, preuves de livraison.
class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.order});

  final Map<String, dynamic> order;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  late Map<String, dynamic> _order = widget.order;
  bool _busy = false;

  Future<void> _release() async {
    final repo = context.read<AdminRepository>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: BnColors.surface,
        content: Text('Libérer ${formatFcfa(parseNum(_order['driver_amount']))} au chauffeur pour ${_order['order_number']} ?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuler')),
          ElevatedButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Libérer')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await repo.releaseEscrow('${_order['id']}');
      if (!mounted) return;
      setState(() => _order = {..._order, 'payment_status': 'released'});
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Paiement libéré au chauffeur')));
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    final api = context.read<AdminRepository>().api;
    final payment = _paymentLabels[order['payment_status']];
    final photos = (order['pod_photos'] is List ? order['pod_photos'] as List : const []).map((p) => '$p').toList();
    final canRelease = order['status'] == 'validated' && order['payment_status'] == 'escrow_held';

    return Scaffold(
      appBar: AppBar(title: Text('${order['order_number'] ?? tr('Commande')}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(_typeLabels[order['order_type']] ?? '${order['order_type'] ?? ''}',
              style: const TextStyle(color: BnColors.text2)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              StatusPill(status: '${order['status'] ?? ''}'),
              if (payment != null) BnPill(label: payment.$1, tone: payment.$2),
            ],
          ),
          const SizedBox(height: 6),
          Text(formatDateTime(DateTime.tryParse('${order['created_at'] ?? ''}')),
              style: const TextStyle(color: BnColors.text3, fontSize: 12)),
          const SizedBox(height: 14),
          BnCard(
            child: Column(
              children: [
                _InfoRow(icon: Icons.person_outline, label: tr('Client'), value: '${order['client_name'] ?? '—'}'),
                _InfoRow(
                    icon: Icons.local_shipping_outlined,
                    label: tr('Chauffeur'),
                    value: '${order['driver_name'] ?? tr('Non assigné')}'),
                _InfoRow(icon: Icons.trip_origin, label: tr('Départ'), value: '${order['pickup_address'] ?? '—'}'),
                _InfoRow(icon: Icons.place_outlined, label: tr('Arrivée'), value: '${order['delivery_address'] ?? '—'}'),
                if (order['material_description'] != null)
                  _InfoRow(
                      icon: Icons.inventory_2_outlined,
                      label: tr('Chargement'),
                      value: '${order['material_description']} · ${formatKm(parseNum(order['quantity_m3'])).replaceAll(' km', ' m³')}'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _PriceCard(order: order),
          const SizedBox(height: 12),
          BnCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Preuves de livraison',
                    style: TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                if (order['pod_notes'] != null && '${order['pod_notes']}'.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text('Note du chauffeur : ${order['pod_notes']}', style: const TextStyle(color: BnColors.text)),
                  ),
                if (photos.isEmpty)
                  const Text('Aucune photo fournie.', style: TextStyle(color: BnColors.text3))
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final photo in photos)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(api.resolveUrl(photo),
                              width: 96,
                              height: 96,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => Container(
                                    width: 96,
                                    height: 96,
                                    color: BnColors.border,
                                    child: const Icon(Icons.broken_image_outlined, color: BnColors.text3),
                                  )),
                        ),
                    ],
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => MessagesScreen(initialScope: 'all', openOrderId: '${order['id']}'),
            )),
            icon: const Icon(Icons.chat_bubble_outline, size: 18),
            label: const Text('Voir la discussion'),
          ),
          if (canRelease) ...[
            const SizedBox(height: 8),
            ElevatedButton(onPressed: _busy ? null : _release, child: const Text('Libérer le paiement au chauffeur')),
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: BnColors.brand),
          const SizedBox(width: 10),
          SizedBox(width: 82, child: Text(label, style: const TextStyle(color: BnColors.text3, fontSize: 13))),
          Expanded(child: Text(value, style: const TextStyle(color: BnColors.textStrong, fontSize: 13))),
        ],
      ),
    );
  }
}

/// Devis ligne par ligne puis répartition : payé par le client, part du chauffeur, commission et net BenneGo.
class _PriceCard extends StatelessWidget {
  const _PriceCard({required this.order});

  final Map<String, dynamic> order;

  @override
  Widget build(BuildContext context) {
    final total = parseNum(order['total_amount']);
    final referral = parseNum(order['referral_discount']);
    final credit = parseNum(order['credit_used']);
    final discount = parseNum(order['discount_amount']) > 0 ? parseNum(order['discount_amount']) : referral + credit;
    final commission = parseNum(order['commission_amount']);
    final distance = parseNum(order['distance_km']);
    final breakdown = order['price_breakdown'] is Map ? Map<String, dynamic>.from(order['price_breakdown'] as Map) : null;
    final lines = breakdown == null
        ? const <QuoteLine>[]
        : quoteLines(breakdown, distanceKm: distance > 0 ? distance : null, pricePerKm: parseNumOrNull(order['price_per_km']));
    final rate = breakdown?['commission_rate'];

    return BnCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Détail du prix', style: TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (distance > 0) _Line(label: tr("Distance de l'itinéraire"), value: formatKm(distance), muted: true),
          if (lines.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 4),
              child: Text('Détail non enregistré pour cette commande (créée avant la mise à jour).',
                  style: TextStyle(color: BnColors.text3, fontSize: 12.5)),
            )
          else
            for (final line in lines) _Line(label: line.label, hint: line.hint, value: formatFcfa(line.amount)),
          const Divider(height: 18, color: BnColors.border),
          _Line(label: tr('Prix de la course'), value: formatFcfa(total), strong: true),
          if (referral > 0) _Line(label: tr('Réduction parrainage (1re commande)'), value: '− ${formatFcfa(referral)}', good: true),
          if (credit > 0) _Line(label: tr('Crédit BenneGo utilisé'), value: '− ${formatFcfa(credit)}', good: true),
          if (discount > 0) _Line(label: tr('Payé par le client'), value: formatFcfa(total - discount < 0 ? 0 : total - discount), strong: true),
          const Divider(height: 18, color: BnColors.border),
          _Line(label: tr('Part du chauffeur'), value: formatFcfa(parseNum(order['driver_amount']))),
          _Line(
            label: 'Commission BenneGo${rate != null ? ' ($rate${breakdown?['is_b2b'] == true ? tr(' · B2B') : ''})' : ''}',
            value: formatFcfa(commission),
          ),
          if (discount > 0) _Line(label: tr('Net BenneGo après réductions'), value: formatFcfa(commission - discount), strong: true),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value, this.hint, this.strong = false, this.good = false, this.muted = false});

  final String label;
  final String value;
  final String? hint;
  final bool strong;
  final bool good;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final color = good ? BnColors.success : (muted ? BnColors.text2 : BnColors.textStrong);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        color: strong ? BnColors.textStrong : BnColors.text2,
                        fontSize: 13,
                        fontWeight: strong ? FontWeight.w700 : FontWeight.w400)),
                if (hint != null) Text(hint!, style: const TextStyle(color: BnColors.text3, fontSize: 11.5)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(value, style: TextStyle(color: color, fontWeight: strong ? FontWeight.w800 : FontWeight.w600)),
        ],
      ),
    );
  }
}
