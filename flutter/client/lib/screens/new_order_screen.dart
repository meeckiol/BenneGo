import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../data/client_repository.dart';
import 'order_detail_screen.dart';
import 'payment_screen.dart';

const _cotonou = LatLng(6.3654, 2.4183);

const _typeLabels = {
  'MATERIAL': 'Matériaux',
  'RENTAL': "Location d'engin",
  'EVACUATION': 'Évacuation',
};

const _machinery = {
  'excavatrice': 'Excavatrice',
  'chargeuse': 'Chargeuse',
  'bulldozer': 'Bulldozer',
  'compacteur': 'Compacteur',
  'niveleuse': 'Niveleuse',
};

const _trucks = {
  'simple_benne': 'Benne 10 m³',
  'double_benne': 'Double benne',
};

/// Nouvelle commande en trois étapes : lieux, quantité, prix puis paiement séquestre.
class NewOrderScreen extends StatefulWidget {
  const NewOrderScreen({super.key, this.initialType = 'MATERIAL'});

  final String initialType;

  @override
  State<NewOrderScreen> createState() => _NewOrderScreenState();
}

class _NewOrderScreenState extends State<NewOrderScreen> {
  late String _type = widget.initialType;
  int _step = 0;
  bool _pickingPickup = true;
  LatLng? _pickup;
  LatLng? _delivery;
  final _pickupAddress = TextEditingController();
  final _deliveryAddress = TextEditingController();
  final _quantity = TextEditingController(text: '10');
  final _hours = TextEditingController(text: '4');
  String _truck = 'double_benne';
  String _machine = 'excavatrice';
  Estimate? _estimate;
  // Crédit BenneGo (primes de parrainage) : le client choisit de l'utiliser sur cette commande
  bool _useCredit = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final controller in [_pickupAddress, _deliveryAddress, _quantity, _hours]) {
      controller.dispose();
    }
    super.dispose();
  }

  bool get _isRental => _type == 'RENTAL';

  /// Charge utile commune à l'estimation et à la création de la commande.
  Map<String, dynamic> _payload() => {
        'order_type': _type,
        'pickup_address': _pickupAddress.text.trim(),
        'pickup_lat': _pickup!.latitude,
        'pickup_lng': _pickup!.longitude,
        'delivery_address': _deliveryAddress.text.trim(),
        'delivery_lat': _delivery!.latitude,
        'delivery_lng': _delivery!.longitude,
        'quantity_m3': _isRental ? null : _parse(_quantity.text),
        'duration_hours': _isRental ? _parse(_hours.text) : null,
        'machinery_type': _isRental ? _machine : null,
        'truck_type': _truck,
        'use_credit': _useCredit,
      };

  double _parse(String value) => double.parse(value.trim().replaceAll(',', '.'));

  String? _validateStep() {
    if (_pickup == null || _delivery == null) return 'Placez le chargement et la livraison sur la carte.';
    if (_pickupAddress.text.trim().length < 3 || _deliveryAddress.text.trim().length < 3) {
      return 'Renseignez les deux adresses.';
    }
    if (_step == 1) {
      try {
        final value = _isRental ? _parse(_hours.text) : _parse(_quantity.text);
        if (value <= 0) return 'Quantité invalide.';
      } on FormatException {
        return 'Quantité invalide.';
      }
    }
    return null;
  }

  Future<void> _next() async {
    final problem = _validateStep();
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    if (_step == 1) {
      await _estimate0();
      return;
    }
    setState(() {
      _error = null;
      _step += 1;
    });
  }

  Future<void> _estimate0() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final estimate = await context.read<ClientRepository>().estimate(_payload());
      if (mounted) {
        setState(() {
          _estimate = estimate;
          _step = 2;
        });
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirm() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final repo = context.read<ClientRepository>();
    try {
      final order = await repo.createOrder(_payload());
      if (!mounted) return;
      await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => PaymentScreen(orderId: order.id)));
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => OrderDetailScreen(orderId: order.id)),
      );
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _onMapTap(LatLng point) {
    setState(() {
      if (_pickingPickup) {
        _pickup = point;
        _pickingPickup = false;
      } else {
        _delivery = point;
      }
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvelle commande')),
      body: SafeArea(
        child: Column(
          children: [
            LinearProgressIndicator(value: (_step + 1) / 3, color: BnColors.brand, backgroundColor: BnColors.border),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: switch (_step) {
                  0 => _placeStep(),
                  1 => _quantityStep(),
                  _ => _priceStep(),
                },
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: BnBanner(message: _error!, tone: BnTone.danger, icon: Icons.error_outline),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  if (_step > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _busy ? null : () => setState(() => _step -= 1),
                        child: const Text('Retour'),
                      ),
                    ),
                  if (_step > 0) const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: BnPrimaryButton(
                      label: switch (_step) {
                        0 => 'Continuer',
                        1 => 'Voir le prix',
                        _ => 'Bloquer le paiement',
                      },
                      busy: _busy,
                      onPressed: _step == 2 ? _confirm : _next,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _placeStep() => [
        const Text('Où ?', style: TextStyle(color: BnColors.textStrong, fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          children: [
            for (final entry in _typeLabels.entries)
              ChoiceChip(
                label: Text(entry.value),
                selected: _type == entry.key,
                onSelected: (_) => setState(() => _type = entry.key),
              ),
          ],
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _pickupAddress,
          decoration: const InputDecoration(labelText: 'Adresse de chargement', hintText: 'ex. Carrière de Tori-Bossito'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _deliveryAddress,
          decoration: const InputDecoration(labelText: 'Adresse de livraison', hintText: 'ex. Chantier Akpakpa, Cotonou'),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          children: [
            ChoiceChip(
              avatar: const Icon(Icons.trip_origin, size: 16),
              label: const Text('Placer le chargement'),
              selected: _pickingPickup,
              onSelected: (_) => setState(() => _pickingPickup = true),
            ),
            ChoiceChip(
              avatar: const Icon(Icons.place_outlined, size: 16),
              label: const Text('Placer la livraison'),
              selected: !_pickingPickup,
              onSelected: (_) => setState(() => _pickingPickup = false),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: SizedBox(
            height: 300,
            child: FlutterMap(
              options: MapOptions(
                initialCenter: _pickup ?? _cotonou,
                initialZoom: 13,
                onTap: (_, point) => _onMapTap(point),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.bennego.client',
                ),
                MarkerLayer(
                  markers: [
                    if (_pickup != null)
                      Marker(point: _pickup!, width: 28, height: 28, child: const _Pin(color: BnColors.info)),
                    if (_delivery != null)
                      Marker(point: _delivery!, width: 28, height: 28, child: const _Pin(color: BnColors.success)),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Touchez la carte pour placer le point choisi.',
          style: TextStyle(color: BnColors.text3, fontSize: 12),
        ),
      ];

  List<Widget> _quantityStep() => [
        const Text('Quoi ?', style: TextStyle(color: BnColors.textStrong, fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        if (_isRental) ...[
          DropdownButtonFormField<String>(
            initialValue: _machine,
            decoration: const InputDecoration(labelText: "Type d'engin"),
            items: [
              for (final entry in _machinery.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value)),
            ],
            onChanged: (value) => setState(() => _machine = value ?? _machine),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _hours,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Durée (heures)'),
          ),
        ] else ...[
          TextField(
            controller: _quantity,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Volume (m³)'),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              for (final entry in _trucks.entries)
                ChoiceChip(
                  label: Text(entry.value),
                  selected: _truck == entry.key,
                  onSelected: (_) => setState(() => _truck = entry.key),
                ),
            ],
          ),
        ],
      ];

  List<Widget> _priceStep() {
    final estimate = _estimate;
    return [
      const Text('Votre prix', style: TextStyle(color: BnColors.textStrong, fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 16),
      BnCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_typeLabels[_type] ?? _type, style: const TextStyle(color: BnColors.text2)),
            const SizedBox(height: 6),
            Text(
              estimate == null ? '—' : formatFcfa(estimate.toPay),
              style: const TextStyle(color: BnColors.brand, fontSize: 28, fontWeight: FontWeight.w800),
            ),
            if (estimate?.distanceKm != null)
              Text('${estimate!.distanceKm!.toStringAsFixed(1)} km', style: const TextStyle(color: BnColors.text2)),
            // Réductions : bienvenue du filleul (d'office) et crédit BenneGo (au choix)
            if (estimate != null && (estimate.referralDiscount > 0 || estimate.creditBalance > 0)) ...[
              const Divider(height: 24, color: BnColors.border),
              _PriceLine(label: 'Prix de la course', value: formatFcfa(estimate.totalAmount)),
              if (estimate.referralDiscount > 0)
                _PriceLine(label: 'Réduction parrainage (1re commande)', value: '− ${formatFcfa(estimate.referralDiscount)}', good: true),
              if (estimate.creditUsed > 0)
                _PriceLine(label: 'Crédit utilisé', value: '− ${formatFcfa(estimate.creditUsed)}', good: true),
            ],
            if (estimate != null && estimate.creditBalance > 0)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _useCredit,
                activeTrackColor: BnColors.brand,
                title: Text('Utiliser mon crédit (${formatFcfa(estimate.creditBalance)})',
                    style: const TextStyle(color: BnColors.textStrong, fontSize: 14)),
                onChanged: _busy
                    ? null
                    : (value) async {
                        setState(() => _useCredit = value);
                        try {
                          final next = await context.read<ClientRepository>().estimate(_payload());
                          if (mounted) setState(() => _estimate = next);
                        } on ApiException catch (error) {
                          if (mounted) setState(() => _error = error.message);
                        }
                      },
              ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      const BnBanner(
        message: 'Le paiement est bloqué sur BenneGo et libéré au chauffeur seulement après votre confirmation de réception.',
        tone: BnTone.info,
        icon: Icons.lock_outline,
      ),
    ];
  }
}

class _PriceLine extends StatelessWidget {
  const _PriceLine({required this.label, required this.value, this.good = false});

  final String label;
  final String value;
  final bool good;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: BnColors.text2, fontSize: 13))),
          Text(value, style: TextStyle(color: good ? BnColors.success : BnColors.textStrong, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _Pin extends StatelessWidget {
  const _Pin({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: color, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
    );
  }
}
