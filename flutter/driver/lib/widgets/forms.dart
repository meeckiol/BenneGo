import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

/// Saisie du chargement : volume, poids de pesée et photos.
class LoadingInput {
  const LoadingInput({
    required this.volumeM3,
    required this.weighbridgeKg,
    required this.photos,
    required this.weighbridgeTicket,
  });

  final double volumeM3;
  final int? weighbridgeKg;
  final List<XFile> photos;
  final XFile? weighbridgeTicket;
}

/// Ouvre le formulaire de chargement. Renvoie `null` si le chauffeur annule.
Future<LoadingInput?> showLoadingSheet(BuildContext context) => showModalBottomSheet<LoadingInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: BnColors.surface,
      builder: (_) => const _LoadingSheet(),
    );

/// Ouvre l'envoi des photos de livraison. Renvoie `null` si le chauffeur annule.
Future<List<XFile>?> showPodSheet(BuildContext context) => showModalBottomSheet<List<XFile>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: BnColors.surface,
      builder: (_) => const _PodSheet(),
    );

/// Choix de photos compressées (pour rester sous la limite de 2 Mo par photo côté serveur).
Future<List<XFile>> _pickPhotos(int max) async {
  final picker = ImagePicker();
  return picker.pickMultiImage(imageQuality: 70, maxWidth: 1600, limit: max);
}

class _LoadingSheet extends StatefulWidget {
  const _LoadingSheet();

  @override
  State<_LoadingSheet> createState() => _LoadingSheetState();
}

class _LoadingSheetState extends State<_LoadingSheet> {
  final _formKey = GlobalKey<FormState>();
  final _volume = TextEditingController();
  final _weighbridge = TextEditingController();
  List<XFile> _photos = const [];
  XFile? _ticket;
  String? _photoError;

  @override
  void dispose() {
    _volume.dispose();
    _weighbridge.dispose();
    super.dispose();
  }

  Future<void> _addPhotos() async {
    final picked = await _pickPhotos(5);
    if (picked.isNotEmpty) setState(() => _photos = picked.take(5).toList());
  }

  Future<void> _addTicket() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 70, maxWidth: 1600);
    if (picked != null) setState(() => _ticket = picked);
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    if (_photos.isEmpty) {
      setState(() => _photoError = 'Ajoutez au moins une photo du chargement.');
      return;
    }
    final kg = int.tryParse(_weighbridge.text.trim());
    Navigator.of(context).pop(
      LoadingInput(
        volumeM3: double.parse(_volume.text.trim().replaceAll(',', '.')),
        weighbridgeKg: kg,
        photos: _photos,
        weighbridgeTicket: _ticket,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Chargement', style: TextStyle(color: BnColors.textStrong, fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              const Text('Déclarez le volume chargé et ajoutez les photos avant de partir.', style: TextStyle(color: BnColors.text2)),
              const SizedBox(height: 16),
              TextFormField(
                controller: _volume,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Volume chargé (m³)', hintText: 'ex. 10'),
                validator: (value) {
                  final volume = double.tryParse((value ?? '').trim().replaceAll(',', '.'));
                  if (volume == null || volume < 0.5 || volume > 100) return 'Volume entre 0,5 et 100 m³';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _weighbridge,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Poids net à la pesée (kg, facultatif)'),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) return null;
                  final kg = int.tryParse(value.trim());
                  return (kg == null || kg < 1 || kg > 100000) ? 'Poids invalide' : null;
                },
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: _addPhotos,
                icon: const Icon(Icons.photo_camera_outlined),
                label: Text(_photos.isEmpty ? 'Photos du chargement' : '${_photos.length} photo(s) sélectionnée(s)'),
              ),
              if (_photoError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(_photoError!, style: const TextStyle(color: BnColors.danger, fontSize: 12)),
                ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _addTicket,
                icon: const Icon(Icons.receipt_long_outlined),
                label: Text(_ticket == null ? 'Ticket de pesée (facultatif)' : 'Ticket de pesée ajouté'),
              ),
              const SizedBox(height: 20),
              BnPrimaryButton(label: 'Enregistrer le chargement', icon: Icons.check, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}

class _PodSheet extends StatefulWidget {
  const _PodSheet();

  @override
  State<_PodSheet> createState() => _PodSheetState();
}

class _PodSheetState extends State<_PodSheet> {
  List<XFile> _photos = const [];

  Future<void> _addPhotos() async {
    final picked = await _pickPhotos(5);
    if (picked.isNotEmpty) setState(() => _photos = picked.take(5).toList());
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Preuve de livraison', style: TextStyle(color: BnColors.textStrong, fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text('Photographiez la livraison (1 à 5 photos).', style: TextStyle(color: BnColors.text2)),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _addPhotos,
            icon: const Icon(Icons.photo_camera_outlined),
            label: Text(_photos.isEmpty ? 'Ajouter des photos' : '${_photos.length} photo(s) sélectionnée(s)'),
          ),
          const SizedBox(height: 20),
          BnPrimaryButton(
            label: 'Envoyer les photos',
            icon: Icons.cloud_upload_outlined,
            onPressed: _photos.isEmpty ? null : () => Navigator.of(context).pop(_photos),
          ),
        ],
      ),
    );
  }
}
