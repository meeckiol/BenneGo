import 'dart:async';

import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../data/client_repository.dart';
import '../domain/order_flow.dart';
import 'chat_route.dart';
import 'payment_screen.dart';
import 'tracking_map.dart';

const _stageLabels = ['Paiement', 'Recherche', 'Assignée', 'En route', 'Chargement', 'En livraison', 'Livrée', 'Validée'];

/// Détail d'une commande : frise, suivi GPS, paiement, réception, litige, avis et annulation.
class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  late final RealtimeClient _realtime;
  late final ClientRepository _repo;
  Order? _order;
  String? _loadError;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _repo = context.read<ClientRepository>();
    _realtime = context.read<RealtimeClient>();
    _realtime.on('order_status', _onStatus);
    unawaited(_load());
  }

  @override
  void dispose() {
    _realtime.off('order_status', _onStatus);
    super.dispose();
  }

  void _onStatus(dynamic data) {
    if (data is Map && data['order_id'] == widget.orderId) unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final order = await _repo.order(widget.orderId);
      if (mounted) {
        setState(() {
          _order = order;
          _loadError = null;
        });
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => _loadError = error.message);
    }
  }

  Future<void> _act(Future<void> Function() action, {required String success}) async {
    setState(() => _busy = true);
    try {
      await action();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(success)));
      await _load();
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pay() async {
    final paid = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => PaymentScreen(orderId: widget.orderId)),
    );
    if (paid == true) await _load();
  }

  Future<bool> _confirm(String question) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: BnColors.surface,
        content: Text(question),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuler')),
          ElevatedButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Confirmer')),
        ],
      ),
    );
    return ok ?? false;
  }

  Future<void> _confirmReception(Order order) async {
    final question = switch (order.orderType) {
      'RENTAL' => tr("Valider que l'engin a bien travaillé pour la durée convenue ? Le paiement sera libéré au chauffeur."),
      'EVACUATION' => tr('Valider que votre chantier est propre et les gravats évacués ? Le paiement sera libéré au chauffeur.'),
      _ => tr('Confirmer la réception des matériaux ? Le paiement sera libéré au chauffeur.'),
    };
    if (!await _confirm(question)) return;
    await _act(() => _repo.confirmReception(order), success: 'Réception confirmée');
  }

  Future<void> _cancel(Order order) async {
    if (!await _confirm('Annuler cette commande ?')) return;
    await _act(() => _repo.cancel(order.id), success: 'Commande annulée');
  }

  Future<void> _dispute(Order order) async {
    final input = await showModalBottomSheet<_DisputeInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: BnColors.surface,
      builder: (_) => const _DisputeSheet(),
    );
    if (input == null) return;
    await _act(() => _repo.dispute(order.id, input.reason, input.photos), success: 'Litige envoyé à BenneGo');
  }

  Future<void> _review(Order order) async {
    final input = await showModalBottomSheet<_ReviewInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: BnColors.surface,
      builder: (_) => const _ReviewSheet(),
    );
    if (input == null) return;
    await _act(() => _repo.reviewDriver(order.id, input.rating, input.comment), success: 'Merci pour votre avis');
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    final unread = order == null ? 0 : context.watch<ChatCenter>().unreadFor(order.id);
    return Scaffold(
      appBar: AppBar(
        title: Text(order?.orderNumber ?? tr('Commande')),
        actions: [
          // Discussion avec le chauffeur, tant que la commande est en cours
          if (order != null && order.hasChat)
            IconButton(
              tooltip: tr('Écrire au chauffeur'),
              onPressed: () => openChat(context, order),
              icon: Badge(
                isLabelVisible: unread > 0,
                label: Text(unread > 9 ? '9+' : '$unread'),
                child: const Icon(Icons.chat_bubble_outline),
              ),
            ),
        ],
      ),
      body: order == null
          ? Center(
              child: _loadError == null
                  ? const CircularProgressIndicator(color: BnColors.brand)
                  : Padding(
                      padding: const EdgeInsets.all(24),
                      child: BnBanner(message: _loadError!, tone: BnTone.danger),
                    ),
            )
          : RefreshIndicator(
              color: BnColors.brand,
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: _sections(order),
              ),
            ),
    );
  }

  List<Widget> _sections(Order order) {
    final actions = OrderActions(order);
    final widgets = <Widget>[
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
            _Address(label: tr('Chargement'), address: order.pickupAddress, icon: Icons.trip_origin),
            const SizedBox(height: 10),
            _Address(label: tr('Livraison'), address: order.deliveryAddress, icon: Icons.place_outlined),
            const Divider(height: 28, color: BnColors.border),
            Text(formatFcfa(order.amountDue), style: const TextStyle(color: BnColors.brand, fontSize: 24, fontWeight: FontWeight.w800)),
            if (order.discountAmount > 0)
              Text('Réductions (parrainage, crédit) : − ${formatFcfa(order.discountAmount)}',
                  style: const TextStyle(color: BnColors.success, fontSize: 12)),
            const SizedBox(height: 4),
            Text(
              '${order.quantityM3} m³${order.distanceKm == null ? '' : ' · ${order.distanceKm!.toStringAsFixed(1)} km'} · ${formatDateTime(order.createdAt)}',
              style: const TextStyle(color: BnColors.text2, fontSize: 12),
            ),
          ],
        ),
      ),
    ];

    if (order.isDisputeOpen) {
      widgets
        ..add(const SizedBox(height: 12))
        ..add(BnBanner(message: tr('Litige ouvert : BenneGo examine la commande.'), tone: BnTone.danger, icon: Icons.gavel_outlined));
    }

    if (actions.showTracking) {
      widgets
        ..add(const SizedBox(height: 16))
        ..add(
          TrackingMap(
            orderId: order.id,
            pickup: LatLng(order.pickupLat, order.pickupLng),
            delivery: LatLng(order.deliveryLat, order.deliveryLng),
          ),
        );
    }

    widgets
      ..add(const SizedBox(height: 16))
      ..add(_TimelineCard(order: order));

    if (actions.hasAny) {
      widgets
        ..add(const SizedBox(height: 16))
        ..add(
          BnCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const BnSectionHead(title: 'Actions'),
                const SizedBox(height: 12),
                if (actions.canPay)
                  BnPrimaryButton(label: tr('Payer en séquestre'), icon: Icons.lock_outline, busy: _busy, onPressed: _pay),
                if (actions.canConfirmReception) ...[
                  const SizedBox(height: 10),
                  BnPrimaryButton(
                    label: tr('Confirmer la réception'),
                    icon: Icons.check_circle_outline,
                    busy: _busy,
                    onPressed: () => _confirmReception(order),
                  ),
                ],
                if (actions.canDispute) ...[
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _dispute(order),
                    icon: const Icon(Icons.report_problem_outlined),
                    label: const Text('Un problème avec la livraison ? Refuser avec photos'),
                  ),
                ],
                if (actions.canReview) ...[
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _review(order),
                    icon: const Icon(Icons.star_outline),
                    label: const Text('Noter le chauffeur'),
                  ),
                ],
                if (actions.canCancel) ...[
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: _busy ? null : () => _cancel(order),
                    child: const Text('Annuler la commande', style: TextStyle(color: BnColors.danger)),
                  ),
                ],
              ],
            ),
          ),
        );
    }

    if (order.photos.isNotEmpty) {
      widgets
        ..add(const SizedBox(height: 16))
        ..add(_PhotosCard(order: order));
    }
    return widgets;
  }

  String _typeLabel(String type) => switch (type) {
        'RENTAL' => tr("Location d'engin"),
        'EVACUATION' => tr('Évacuation'),
        _ => tr('Matériaux'),
      };
}

class _TimelineCard extends StatelessWidget {
  const _TimelineCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final current = timelineIndex(order.status);
    final cancelled = order.status == 'cancelled';
    return BnCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const BnSectionHead(title: 'Suivi'),
          const SizedBox(height: 12),
          if (cancelled)
            BnPill(label: tr('Commande annulée'), tone: BnTone.danger)
          else
            for (var i = 0; i < _stageLabels.length; i++)
              _StageRow(label: _stageLabels[i], done: i < current, current: i == current),
        ],
      ),
    );
  }
}

class _StageRow extends StatelessWidget {
  const _StageRow({required this.label, required this.done, required this.current});

  final String label;
  final bool done;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final color = done ? BnColors.success : (current ? BnColors.brand : BnColors.border2);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Icon(done ? Icons.check_circle : Icons.radio_button_checked, size: 18, color: color),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
              color: current ? BnColors.textStrong : (done ? BnColors.text : BnColors.text3),
              fontWeight: current ? FontWeight.w800 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _PhotosCard extends StatelessWidget {
  const _PhotosCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final api = context.read<ApiClient>();
    return BnCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const BnSectionHead(title: 'Photos'),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final photo in order.photos)
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    api.resolveUrl(photo.path),
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
    );
  }
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

class _DisputeInput {
  const _DisputeInput(this.reason, this.photos);

  final String reason;
  final List<XFile> photos;
}

/// Saisie du motif de refus et des photos de la livraison.
class _DisputeSheet extends StatefulWidget {
  const _DisputeSheet();

  @override
  State<_DisputeSheet> createState() => _DisputeSheetState();
}

class _DisputeSheetState extends State<_DisputeSheet> {
  final _reason = TextEditingController();
  List<XFile> _photos = const [];
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final picked = await ImagePicker().pickMultiImage(imageQuality: 70, maxWidth: 1600, limit: 5);
    if (picked.isNotEmpty) setState(() => _photos = picked.take(5).toList());
  }

  void _submit() {
    final reason = _reason.text.trim();
    if (reason.length < 10) {
      setState(() => _error = 'Décrivez le problème (10 caractères minimum).');
      return;
    }
    Navigator.of(context).pop(_DisputeInput(reason, _photos));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Refuser la livraison', style: TextStyle(color: BnColors.textStrong, fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text(
            'Le paiement reste bloqué pendant l\'examen du litige par BenneGo.',
            style: TextStyle(color: BnColors.text2),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _reason,
            maxLines: 4,
            maxLength: 1000,
            decoration: InputDecoration(labelText: tr('Motif'), alignLabelWithHint: true),
          ),
          OutlinedButton.icon(
            onPressed: _pick,
            icon: const Icon(Icons.photo_camera_outlined),
            label: Text(_photos.isEmpty ? tr('Ajouter des photos') : tr('${_photos.length} photo(s)')),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!, style: const TextStyle(color: BnColors.danger, fontSize: 12)),
            ),
          const SizedBox(height: 16),
          BnPrimaryButton(label: tr('Envoyer le litige'), icon: Icons.send_outlined, onPressed: _submit),
        ],
      ),
    );
  }
}

class _ReviewInput {
  const _ReviewInput(this.rating, this.comment);

  final int rating;
  final String comment;
}

/// Note du chauffeur de 1 à 5 étoiles, avec un avis facultatif.
class _ReviewSheet extends StatefulWidget {
  const _ReviewSheet();

  @override
  State<_ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends State<_ReviewSheet> {
  final _comment = TextEditingController();
  int _rating = 0;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Votre avis compte', style: TextStyle(color: BnColors.textStrong, fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var star = 1; star <= 5; star++)
                IconButton(
                  onPressed: () => setState(() => _rating = star),
                  icon: Icon(
                    star <= _rating ? Icons.star : Icons.star_outline,
                    color: BnColors.warning,
                    size: 36,
                  ),
                ),
            ],
          ),
          TextField(
            controller: _comment,
            maxLines: 3,
            maxLength: 1000,
            decoration: InputDecoration(labelText: tr('Commentaire (facultatif)'), alignLabelWithHint: true),
          ),
          const SizedBox(height: 12),
          BnPrimaryButton(
            label: tr('Envoyer ma note'),
            onPressed: _rating == 0 ? null : () => Navigator.of(context).pop(_ReviewInput(_rating, _comment.text.trim())),
          ),
        ],
      ),
    );
  }
}
