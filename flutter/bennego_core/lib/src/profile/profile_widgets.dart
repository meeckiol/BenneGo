import 'package:flutter/material.dart' hide Text;
import 'package:flutter/services.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../theme/bn_theme.dart';
import '../i18n/text.dart';
import '../i18n/lang.dart';

/// Ligne de profil avec une icône sur fond de couleur (vert, ardoise, sable, bleu, rouge), comme le profil web.
class ProfileRow extends StatelessWidget {
  const ProfileRow({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
    this.subtitle,
    this.onTap,
    this.trailing,
    this.danger = false,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: danger ? BnColors.danger : BnColors.textStrong,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (subtitle != null) Text(subtitle!, style: const TextStyle(color: BnColors.text3, fontSize: 12)),
                ],
              ),
            ),
            trailing ?? (danger || onTap == null ? const SizedBox.shrink() : const Icon(Icons.chevron_right, color: BnColors.text3)),
          ],
        ),
      ),
    );
  }
}

/// Groupe de lignes dans un cadre arrondi, avec un titre facultatif (« Aide », « Réglages »…).
class ProfileGroup extends StatelessWidget {
  const ProfileGroup({super.key, this.title, required this.children});

  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    LangScope.watch(context); // titre traduit puis mis en majuscules
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null)
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              tr(title!).toUpperCase(),
              style: const TextStyle(color: BnColors.text3, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.8),
            ),
          ),
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: BnColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: BnColors.border),
          ),
          child: Column(
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0) const Divider(height: 1, color: BnColors.border),
                children[i],
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Carte noire du code parrain : copier, partager, nombre de filleuls et gains.
class ReferralCard extends StatelessWidget {
  const ReferralCard({
    super.key,
    required this.title,
    required this.text,
    required this.code,
    required this.onShare,
    this.rewards,
    this.secondary,
  });

  final String title;
  final String text;
  final String? code;
  final VoidCallback onShare;

  /// Gains déjà obtenus, par exemple « 5 000 FCFA gagnés ».
  final String? rewards;

  /// Bouton de droite (« Mes filleuls », nombre de filleuls…).
  final Widget? secondary;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: const Color(0xFF050508), borderRadius: BorderRadius.circular(22)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
              ),
              if (rewards != null) Text(rewards!, style: const TextStyle(color: Color(0xFFC9C3B8), fontSize: 13)),
            ],
          ),
          const SizedBox(height: 8),
          Text(text, style: const TextStyle(color: Color(0xFFC9C3B8), fontSize: 13, height: 1.5)),
          const SizedBox(height: 12),
          Semantics(
            button: true,
            label: tr('Copier le code parrain'),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: code == null
                  ? null
                  : () {
                      Clipboard.setData(ClipboardData(text: code!));
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Code copié')));
                    },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(color: const Color(0xFF1C1D24), borderRadius: BorderRadius.circular(14)),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        code ?? '…',
                        style: const TextStyle(
                          color: Color(0xFFE8C38A),
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 2,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                    const Icon(Icons.copy, color: Color(0xFFE8C38A), size: 18),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: code == null ? null : onShare,
                  icon: const Icon(Icons.share, size: 16),
                  label: const Text('Partager'),
                  style: FilledButton.styleFrom(
                    backgroundColor: BnColors.brand,
                    foregroundColor: const Color(0xFF0B0B10),
                    minimumSize: const Size.fromHeight(44),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    textStyle: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              if (secondary != null) ...[const SizedBox(width: 10), Expanded(child: secondary!)],
            ],
          ),
        ],
      ),
    );
  }
}

/// Informations personnelles : modifiables sauf le téléphone, vérifié par SMS (`PATCH /auth/me`).
class PersonalInfoScreen extends StatefulWidget {
  const PersonalInfoScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PersonalInfoScreen> createState() => _PersonalInfoScreenState();
}

class _PersonalInfoScreenState extends State<PersonalInfoScreen> {
  static const _fields = ['prenom', 'nom', 'email', 'adresse', 'date_naissance'];
  final Map<String, TextEditingController> _c = {for (final f in _fields) f: TextEditingController()};
  final Map<String, String> _saved = {};
  final _form = GlobalKey<FormState>();
  String _phone = '';
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await widget.api.get('/auth/me') as Map<String, dynamic>;
      _apply(data['user'] as Map<String, dynamic>);
    } on ApiException catch (error) {
      _snack(error.message);
    }
    if (mounted) setState(() => _loading = false);
  }

  void _apply(Map<String, dynamic> user) {
    _phone = user['phone'] as String? ?? '';
    for (final f in _fields) {
      var value = user[f]?.toString() ?? '';
      if (f == 'date_naissance' && value.length >= 10) value = value.substring(0, 10);
      _c[f]!.text = value;
      _saved[f] = value;
    }
  }

  bool get _dirty => _fields.any((f) => _c[f]!.text != _saved[f]);

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final changes = {
      for (final f in _fields)
        if (_c[f]!.text != _saved[f]) f: _c[f]!.text.trim(),
    };
    if (changes.isEmpty) return;
    setState(() => _saving = true);
    try {
      final data = await widget.api.patch('/auth/me', body: changes) as Map<String, dynamic>;
      _apply(data['user'] as Map<String, dynamic>);
      _snack('Informations enregistrées');
    } on ApiException catch (error) {
      _snack(error.message);
    }
    if (mounted) setState(() => _saving = false);
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Informations personnelles')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: BnColors.brand))
          : Form(
              key: _form,
              onChanged: () => setState(() {}),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      Expanded(child: _field('prenom', 'Prénom', required: true)),
                      const SizedBox(width: 10),
                      Expanded(child: _field('nom', 'Nom', required: true)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  InputDecorator(
                    decoration: InputDecoration(labelText: tr('Téléphone'), prefixIcon: Icon(Icons.lock_outline)),
                    child: Text('$_phone · vérifié par SMS', style: const TextStyle(color: BnColors.text2)),
                  ),
                  const SizedBox(height: 12),
                  _field('email', 'E-mail (facultatif)', keyboard: TextInputType.emailAddress),
                  const SizedBox(height: 12),
                  _field('adresse', 'Adresse'),
                  const SizedBox(height: 12),
                  _field('date_naissance', 'Date de naissance (AAAA-MM-JJ)', keyboard: TextInputType.datetime),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _dirty && !_saving ? _save : null,
                    style: ElevatedButton.styleFrom(foregroundColor: const Color(0xFF0B0B10)),
                    child: Text(_saving ? tr('Enregistrement…') : tr('Enregistrer')),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _field(String name, String label, {bool required = false, TextInputType? keyboard}) {
    return TextFormField(
      controller: _c[name],
      keyboardType: keyboard,
      decoration: InputDecoration(labelText: label),
      validator: (value) {
        final text = (value ?? '').trim();
        if (required && text.isEmpty) return tr('Obligatoire');
        if (name == 'email' && text.isNotEmpty && !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(text)) {
          return tr('E-mail invalide');
        }
        if (name == 'date_naissance' && text.isNotEmpty && DateTime.tryParse(text) == null) return tr('Date invalide');
        return null;
      },
    );
  }
}
