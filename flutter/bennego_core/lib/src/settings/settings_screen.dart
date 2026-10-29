import 'dart:async';

import 'package:flutter/material.dart' hide Text;
import 'package:flutter/material.dart' as material show Text;

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../format/format.dart';
import '../theme/bn_theme.dart';
import 'account_prefs.dart';
import 'app_lock.dart';
import '../auth/session.dart';
import '../i18n/text.dart';
import '../i18n/lang.dart';

const _categoryText = {
  'order_updates': ('Suivi de mes commandes', 'Acceptée, en route, livrée'),
  'messages': ('Messages', 'Discussions de vos commandes'),
  'promotions': ('Promotions', 'Offres et codes promo'),
  'new_orders': ('Nouvelles courses', 'Courses disponibles quand vous êtes en ligne'),
  'earnings': ('Gains', 'Paiements validés et versements'),
  'disputes': ('Litiges', 'Nouveaux litiges à trancher'),
  'reliefs': ('Pannes & relèves', 'Camion en panne pendant une course'),
  'payouts': ('Versements', 'Demandes de versement du crédit'),
};

const _privacyText = {
  'client': {
    'show_photo': ('Photo visible du camionneur', 'Il vous reconnaît à la livraison'),
    'hide_phone': ('Masquer mon numéro', 'Le camionneur vous écrit par la messagerie'),
  },
  'driver': {
    'show_photo': ('Photo visible du client', 'Il vous reconnaît à votre arrivée'),
    'hide_phone': ('Masquer mon numéro', 'Le client vous écrit par la messagerie'),
  },
};

const _reasons = [
  "Je n'utilise plus BenneGo",
  "J'ai un autre compte",
  'Problème avec une commande',
  'Mes données personnelles',
  'Autre raison',
];

/// Réglages modifiés : chemins « notifications.messages », « notifications.quiet_hours.start »…
Map<String, Object?> _flatten(Map<String, dynamic> map, [String prefix = '']) => {
      for (final entry in map.entries)
        if (entry.value is Map)
          ..._flatten(Map<String, dynamic>.from(entry.value as Map), '$prefix${entry.key}.')
        else
          '$prefix${entry.key}': entry.value,
    };

/// Liste des réglages qui diffèrent entre [saved] et [draft].
List<MapEntry<String, Object?>> settingsDiff(Map<String, dynamic> saved, Map<String, dynamic> draft) {
  final before = _flatten(saved);
  return _flatten(draft).entries.where((e) => before[e.key] != e.value).toList();
}

/// Corps du PATCH à partir des réglages modifiés.
Map<String, dynamic> settingsPatch(List<MapEntry<String, Object?>> changes) {
  final patch = <String, dynamic>{};
  for (final change in changes) {
    final keys = change.key.split('.');
    var node = patch;
    for (final k in keys.take(keys.length - 1)) {
      node = node.putIfAbsent(k, () => <String, dynamic>{}) as Map<String, dynamic>;
    }
    node[keys.last] = change.value;
  }
  return patch;
}

Map<String, dynamic> _copy(Map<String, dynamic> map) => {
      for (final e in map.entries) e.key: e.value is Map ? _copy(Map<String, dynamic>.from(e.value as Map)) : e.value,
    };

/// Réglages du compte (client, camionneur, admin) : notifications, confidentialité, sécurité (code PIN et
/// empreinte compris) et suppression du compte. Les interrupteurs s'appliquent après « Valider ».
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.api,
    required this.role,
    required this.phone,
    required this.onPhoneChanged,
    required this.onDeleted,
    this.lockStore,
    this.biometrics = const Biometrics(),
  });

  final ApiClient api;
  final String role;
  final String phone;
  final void Function(String phone) onPhoneChanged;

  /// Compte supprimé : la session est déjà fermée par le serveur ; [restoreUntil] = date limite de reprise.
  final Future<void> Function(DateTime restoreUntil) onDeleted;
  final AppLockStore? lockStore;
  final Biometrics biometrics;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

enum _Page { home, language, notifications, privacy, security, delete }

class _SettingsScreenState extends State<SettingsScreen> {
  late final AppLockStore _lock = widget.lockStore ?? AppLockStore();
  Map<String, dynamic>? _saved;
  Map<String, dynamic>? _draft;
  List<String> _categories = const [];
  String? _error;
  bool _saving = false;
  _Page _page = _Page.home;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final data = await widget.api.get('/account/settings') as Map<String, dynamic>;
      // La langue affichée est celle de ce téléphone
      final settings = Map<String, dynamic>.from(data['settings'] as Map)..['language'] = Lang.instance.code;
      setState(() {
        _saved = settings;
        _draft = _copy(settings);
        _categories = [for (final c in data['categories'] as List) '$c'];
      });
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    }
  }

  List<MapEntry<String, Object?>> get _changes =>
      _saved == null || _draft == null ? const [] : settingsDiff(_saved!, _draft!);

  void _set(List<String> path, Object value) {
    setState(() {
      var node = _draft!;
      for (final k in path.take(path.length - 1)) {
        node = node[k] as Map<String, dynamic>;
      }
      node[path.last] = value;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final data = await widget.api.patch('/account/settings', body: settingsPatch(_changes)) as Map<String, dynamic>;
      final settings = Map<String, dynamic>.from(data['settings'] as Map);
      AccountPrefs.instance.settings = settings;
      // Nouvelle langue : toute l'application est traduite tout de suite
      final language = settings['language'] as String?;
      if (language != null && language != Lang.instance.code) await Lang.instance.set(language);
      if (!mounted) return;
      setState(() {
        _saved = settings;
        _draft = _copy(settings);
      });
      _toast('Réglages enregistrés');
    } on ApiException catch (error) {
      _toast(error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _back() async {
    if (_page != _Page.home) {
      setState(() => _page = _Page.home);
      return;
    }
    if (_changes.isNotEmpty) {
      final leave = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          backgroundColor: BnColors.surface,
          content: const Text('Quitter sans valider vos modifications ?'),
          actions: [
            TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Rester')),
            TextButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Quitter')),
          ],
        ),
      );
      if (leave != true) return;
    }
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final changes = _changes;
    final draft = _draft;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_back());
      },
      child: Scaffold(
        appBar: AppBar(leading: BackButton(onPressed: _back)),
        body: draft == null
            ? Center(
                child: _error == null
                    ? const CircularProgressIndicator(color: BnColors.brand)
                    : Text(_error!, style: const TextStyle(color: BnColors.text2)),
              )
            : Stack(
                children: [
                  ListView(
                    padding: EdgeInsets.fromLTRB(16, 0, 16, changes.isEmpty ? 24 : 100),
                    children: switch (_page) {
                      _Page.home => _home(draft),
                      _Page.language => _language(draft),
                      _Page.notifications => _notifications(draft),
                      _Page.privacy => _privacy(draft),
                      _Page.security => [
                          _SecurityPage(
                            api: widget.api,
                            phone: widget.phone,
                            onPhoneChanged: widget.onPhoneChanged,
                            lock: _lock,
                            biometrics: widget.biometrics,
                            toast: _toast,
                          ),
                        ],
                      _Page.delete => [_DeletePage(api: widget.api, role: widget.role, onDeleted: widget.onDeleted)],
                    },
                  ),
                  if (changes.isNotEmpty)
                    Positioned(
                      left: 16,
                      right: 16,
                      bottom: 16 + MediaQuery.paddingOf(context).bottom,
                      child: _ChangeBar(
                        count: changes.length,
                        saving: _saving,
                        onDiscard: () => setState(() => _draft = _copy(_saved!)),
                        onSave: _save,
                      ),
                    ),
                ],
              ),
      ),
    );
  }

  List<Widget> _home(Map<String, dynamic> draft) {
    final n = draft['notifications'] as Map<String, dynamic>;
    final quiet = n['quiet_hours'] as Map<String, dynamic>;
    final on = _categories.where((c) => n[c] != false).length;
    final privacy = draft['privacy'] as Map<String, dynamic>;
    return [
      const _Title('Réglages', 'Comment BenneGo vous prévient et protège votre compte.'),
      _Group(title: 'Préférences', children: [
        _Row(
          icon: Icons.translate,
          title: 'Langue',
          subtitle: appLanguages
              .firstWhere((l) => l.code == draft['language'], orElse: () => appLanguages.first)
              .name,
          onTap: () => setState(() => _page = _Page.language),
        ),
      ]),
      _Group(title: 'Alertes', children: [
        _Row(
          icon: Icons.notifications_none,
          title: 'Notifications',
          subtitle: n['push'] == false
              ? tr('En pause')
              : [
                  '$on/${_categories.length} types',
                  if (quiet['enabled'] == true) 'calme ${quiet['start']}–${quiet['end']}',
                ].join(' · '),
          onTap: () => setState(() => _page = _Page.notifications),
        ),
      ]),
      _Group(title: 'Confidentialité & sécurité', children: [
        if (widget.role != 'admin')
          _Row(
            icon: Icons.visibility_outlined,
            title: 'Confidentialité',
            subtitle: '${privacy['show_photo'] == true ? tr('Photo visible') : tr('Photo masquée')} · '
                '${privacy['hide_phone'] == true ? tr('numéro masqué') : tr('numéro pendant la course')}',
            onTap: () => setState(() => _page = _Page.privacy),
          ),
        _Row(
          icon: Icons.shield_outlined,
          title: 'Sécurité',
          subtitle: 'Mot de passe, numéro, code PIN, appareils',
          onTap: () => setState(() => _page = _Page.security),
        ),
      ]),
      if (widget.role != 'admin')
        _Group(title: 'Compte', children: [
          _Row(
            icon: Icons.delete_outline,
            title: 'Supprimer mon compte',
            subtitle: 'Récupérable pendant 60 jours',
            danger: true,
            onTap: () => setState(() => _page = _Page.delete),
          ),
        ]),
    ];
  }

  /// Langue : aperçu « Bonjour / Hello » puis toutes les langues (nom dans la langue et en anglais).
  List<Widget> _language(Map<String, dynamic> draft) {
    final chosen = appLanguages.firstWhere((l) => l.code == draft['language'], orElse: () => appLanguages.first);
    return [
      const _Title('Langue', "Choisissez la langue de l'application."),
      Container(
        padding: const EdgeInsets.symmetric(vertical: 26),
        decoration: BoxDecoration(
          color: BnColors.surface2,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: BnColors.border),
        ),
        child: Column(
          children: [
            // Noms de langues : jamais traduits (widget Text de Flutter)
            material.Text(chosen.hello,
                style: const TextStyle(color: BnColors.brand, fontSize: 30, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            material.Text(chosen.name, style: const TextStyle(color: BnColors.text3, fontSize: 13)),
          ],
        ),
      ),
      const SizedBox(height: 18),
      _Group(title: 'Toutes les langues', children: [
        for (final l in appLanguages)
          InkWell(
            onTap: () => _set(['language'], l.code),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        material.Text(l.name,
                            style: TextStyle(
                                color: l.code == chosen.code ? BnColors.brand : BnColors.textStrong,
                                fontSize: 15,
                                fontWeight: FontWeight.w700)),
                        material.Text(l.english, style: const TextStyle(color: BnColors.text3, fontSize: 12.5)),
                      ],
                    ),
                  ),
                  if (l.code == chosen.code) const Icon(Icons.check, color: BnColors.brand),
                ],
              ),
            ),
          ),
      ]),
      const _Note("Les traductions autres que le français et l'anglais peuvent être approximatives."),
    ];
  }

  List<Widget> _notifications(Map<String, dynamic> draft) {
    final n = draft['notifications'] as Map<String, dynamic>;
    final quiet = n['quiet_hours'] as Map<String, dynamic>;
    final push = n['push'] != false;
    (String, String) label(String c) =>
        widget.role == 'admin' && c == 'messages' ? ('Messages des litiges', 'Nouveaux messages dans un litige ouvert') : _categoryText[c] ?? (c, '');
    Future<void> pickTime(String key) async {
      final parts = '${quiet[key]}'.split(':');
      final picked = await showTimePicker(
        context: context,
        initialTime: TimeOfDay(hour: int.tryParse(parts.first) ?? 22, minute: int.tryParse(parts.last) ?? 0),
        builder: (c, child) => MediaQuery(data: MediaQuery.of(c).copyWith(alwaysUse24HourFormat: true), child: child!),
      );
      if (picked != null) {
        _set(['notifications', 'quiet_hours', key],
            '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
      }
    }

    return [
      const _Title('Notifications', 'Choisissez ce qui mérite une alerte.'),
      _Preview(role: widget.role, notifications: n),
      const SizedBox(height: 16),
      _Group(children: [
        _Row(
          icon: Icons.notifications_active_outlined,
          title: 'Notifications push',
          subtitle: push ? tr('Activées pour votre compte') : tr('En pause : aucune alerte'),
          trailing: _Switch(value: push, onChanged: (v) => _set(['notifications', 'push'], v)),
        ),
      ]),
      _Group(title: 'Me prévenir pour', children: [
        for (final c in _categories)
          _Row(
            icon: Icons.notifications_none,
            muted: true,
            title: label(c).$1,
            subtitle: label(c).$2,
            trailing: _Switch(value: n[c] != false, onChanged: push ? (v) => _set(['notifications', c], v) : null),
          ),
      ]),
      _Group(title: 'Son & vibration', children: [
        _Row(
          icon: Icons.volume_up_outlined,
          muted: true,
          title: 'Son',
          subtitle: 'Un son court à chaque alerte',
          trailing: _Switch(value: n['sound'] != false, onChanged: (v) => _set(['notifications', 'sound'], v)),
        ),
        _Row(
          icon: Icons.vibration,
          muted: true,
          title: 'Vibration',
          subtitle: 'Le téléphone vibre à chaque alerte',
          trailing: _Switch(value: n['vibration'] != false, onChanged: (v) => _set(['notifications', 'vibration'], v)),
        ),
      ]),
      _Group(title: 'Heures calmes', children: [
        _Row(
          icon: Icons.bedtime_outlined,
          muted: true,
          title: 'Pas de son la nuit',
          subtitle: widget.role == 'admin'
              ? tr('Alertes silencieuses, sauf pannes en cours de course')
              : tr('Alertes silencieuses, sauf pendant une course en cours'),
          trailing: _Switch(
              value: quiet['enabled'] == true, onChanged: (v) => _set(['notifications', 'quiet_hours', 'enabled'], v)),
        ),
        if (quiet['enabled'] == true)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              children: [
                const Text('De', style: TextStyle(color: BnColors.text2)),
                const SizedBox(width: 8),
                OutlinedButton(onPressed: () => pickTime('start'), child: Text('${quiet['start']}')),
                const SizedBox(width: 14),
                const Text('à', style: TextStyle(color: BnColors.text2)),
                const SizedBox(width: 8),
                OutlinedButton(onPressed: () => pickTime('end'), child: Text('${quiet['end']}')),
              ],
            ),
          ),
      ]),
    ];
  }

  List<Widget> _privacy(Map<String, dynamic> draft) {
    final privacy = draft['privacy'] as Map<String, dynamic>;
    final texts = _privacyText[widget.role] ?? const {};
    return [
      const _Title('Confidentialité', "Ce que voit l'autre personne de la commande."),
      _Group(title: 'Profil', children: [
        _Row(
          icon: Icons.person_outline,
          muted: true,
          title: texts['show_photo']?.$1 ?? '',
          subtitle: texts['show_photo']?.$2,
          trailing: _Switch(value: privacy['show_photo'] == true, onChanged: (v) => _set(['privacy', 'show_photo'], v)),
        ),
        _Row(
          icon: Icons.phone_outlined,
          muted: true,
          title: texts['hide_phone']?.$1 ?? '',
          subtitle: privacy['hide_phone'] == true ? texts['hide_phone']?.$2 : tr('Numéro visible seulement pendant la course'),
          trailing: _Switch(value: privacy['hide_phone'] == true, onChanged: (v) => _set(['privacy', 'hide_phone'], v)),
        ),
      ]),
      if (widget.role == 'driver')
        const _Group(title: 'Position', children: [
          _Row(
            icon: Icons.location_on_outlined,
            title: 'Seulement en ligne',
            subtitle: "Votre position n'est enregistrée que lorsque vous êtes en ligne ou en course. "
                'Hors ligne, rien n\'est partagé.',
          ),
        ]),
      const _Note("L'équipe BenneGo garde accès à vos coordonnées pour l'assistance et les litiges."),
    ];
  }
}

class _Title extends StatelessWidget {
  const _Title(this.title, this.subtitle);

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: BnColors.textStrong, fontSize: 30, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(color: BnColors.text3, fontSize: 14)),
        ],
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({this.title, required this.children});

  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    LangScope.watch(context); // titre traduit puis mis en majuscules
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 8),
              child: Text(tr(title!).toUpperCase(),
                  style: const TextStyle(color: BnColors.text3, fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.9)),
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
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.trailing,
    this.danger = false,
    this.muted = false,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool danger;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final color = danger ? BnColors.danger : (muted ? BnColors.text2 : BnColors.brand);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          color: danger ? BnColors.danger : BnColors.textStrong, fontSize: 15, fontWeight: FontWeight.w700)),
                  if (subtitle != null)
                    Text(subtitle!, style: const TextStyle(color: BnColors.text3, fontSize: 12.5, height: 1.3)),
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 8), trailing!]
            else if (onTap != null)
              const Icon(Icons.chevron_right, color: BnColors.text3),
          ],
        ),
      ),
    );
  }
}

class _Switch extends StatelessWidget {
  const _Switch({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Switch(
      value: value,
      onChanged: onChanged,
      activeThumbColor: Colors.white,
      activeTrackColor: BnColors.brand,
      inactiveThumbColor: BnColors.text2,
      inactiveTrackColor: BnColors.border2,
    );
  }
}

class _Note extends StatelessWidget {
  const _Note(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(text, style: const TextStyle(color: BnColors.text3, fontSize: 12.5, height: 1.4)),
    );
  }
}

/// Aperçu d'une notification qui reflète son, vibration et heures calmes.
class _Preview extends StatelessWidget {
  const _Preview({required this.role, required this.notifications});

  final String role;
  final Map<String, dynamic> notifications;

  @override
  Widget build(BuildContext context) {
    final sample = switch (role) {
      'driver' => tr('Nouvelle course · Carrière de Tori → Akpakpa · 40 500 FCFA'),
      'admin' => tr('Nouveau litige · LT-2026-0412 : quantité contestée'),
      _ => tr('Livraison en route · Votre camion arrive dans 10 min.'),
    };
    final n = notifications;
    final quiet = n['quiet_hours'] as Map<String, dynamic>;
    final muted = n['push'] == false;
    Widget chip(IconData icon, String text) => Padding(
          padding: const EdgeInsets.only(right: 10),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 12, color: BnColors.text3),
            const SizedBox(width: 3),
            Text(text, style: const TextStyle(color: BnColors.text3, fontSize: 11.5)),
          ]),
        );
    return Opacity(
      opacity: muted ? 0.5 : 1,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: BnColors.surface2,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: BnColors.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: BnColors.brand, borderRadius: BorderRadius.circular(10)),
              child: const Text('B', style: TextStyle(color: BnColors.bg, fontWeight: FontWeight.w900, fontSize: 18)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("BenneGo  ·  à l'instant",
                      style: TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700, fontSize: 13.5)),
                  const SizedBox(height: 2),
                  Text(muted ? tr('Notifications en pause') : sample, style: const TextStyle(color: BnColors.text2, fontSize: 13)),
                  const SizedBox(height: 6),
                  Wrap(children: [
                    chip(n['sound'] == false ? Icons.notifications_off_outlined : Icons.volume_up_outlined,
                        n['sound'] == false ? tr('Silencieux') : tr('Son')),
                    chip(Icons.vibration, n['vibration'] == false ? tr('Sans vibration') : tr('Vibration')),
                    if (quiet['enabled'] == true) chip(Icons.bedtime_outlined, '${quiet['start']}–${quiet['end']}'),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Barre « N modifications · Annuler · Valider ».
class _ChangeBar extends StatelessWidget {
  const _ChangeBar({required this.count, required this.saving, required this.onDiscard, required this.onSave});

  final int count;
  final bool saving;
  final VoidCallback onDiscard;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 6, 6, 6),
        decoration: BoxDecoration(
          color: const Color(0xFF22222E),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: BnColors.border2),
          boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 24, offset: Offset(0, 8))],
        ),
        child: Row(
          children: [
            Container(width: 7, height: 7, decoration: const BoxDecoration(color: BnColors.brand, shape: BoxShape.circle)),
            const SizedBox(width: 8),
            Expanded(
              child: Text('$count modification${count > 1 ? 's' : ''}',
                  style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w600)),
            ),
            TextButton(onPressed: saving ? null : onDiscard, child: const Text('Annuler', style: TextStyle(color: BnColors.text2))),
            FilledButton(
              onPressed: saving ? null : onSave,
              style: FilledButton.styleFrom(backgroundColor: BnColors.brand, foregroundColor: BnColors.bg, shape: const StadiumBorder()),
              child: Text(saving ? '…' : 'Valider', style: const TextStyle(fontWeight: FontWeight.w800)),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sécurité : mot de passe, numéro (code SMS), code PIN et empreinte, appareils connectés.
class _SecurityPage extends StatefulWidget {
  const _SecurityPage({
    required this.api,
    required this.phone,
    required this.onPhoneChanged,
    required this.lock,
    required this.biometrics,
    required this.toast,
  });

  final ApiClient api;
  final String phone;
  final void Function(String phone) onPhoneChanged;
  final AppLockStore lock;
  final Biometrics biometrics;
  final void Function(String message) toast;

  @override
  State<_SecurityPage> createState() => _SecurityPageState();
}

class _SecurityPageState extends State<_SecurityPage> {
  List<Map<String, dynamic>>? _sessions;
  bool _hasPin = false;
  bool _bioAvailable = false;
  bool _bioEnabled = false;
  late String _phone = widget.phone;

  @override
  void initState() {
    super.initState();
    unawaited(_loadSessions());
    unawaited(_loadLock());
  }

  Future<void> _loadSessions() async {
    try {
      final data = await widget.api.get('/account/sessions') as Map<String, dynamic>;
      if (mounted) setState(() => _sessions = [for (final s in data['sessions'] as List) Map<String, dynamic>.from(s as Map)]);
    } on ApiException catch (error) {
      if (mounted) setState(() => _sessions = const []);
      widget.toast(error.message);
    }
  }

  Future<void> _loadLock() async {
    final hasPin = await widget.lock.hasPin();
    final available = await widget.biometrics.available();
    final enabled = await widget.lock.biometricEnabled();
    if (!mounted) return;
    setState(() {
      _hasPin = hasPin;
      _bioAvailable = available;
      _bioEnabled = enabled;
    });
  }

  Future<void> _togglePin(bool on) async {
    if (on) {
      if (await showPinSetup(context, widget.lock)) widget.toast('Code PIN activé');
    } else {
      await widget.lock.clear();
      widget.toast('Code PIN retiré');
    }
    await _loadLock();
  }

  Future<void> _toggleBiometric(bool on) async {
    if (on && !await widget.biometrics.authenticate('Activer le déverrouillage par empreinte')) return;
    await widget.lock.setBiometric(on);
    await _loadLock();
  }

  Future<void> _revoke(String id) async {
    try {
      await widget.api.delete('/account/sessions/$id');
      widget.toast('Appareil déconnecté');
      await _loadSessions();
    } on ApiException catch (error) {
      widget.toast(error.message);
    }
  }

  Future<void> _revokeOthers() async {
    try {
      final data = await widget.api.post('/account/sessions/revoke-others') as Map<String, dynamic>;
      widget.toast('${data['message']}');
      await _loadSessions();
    } on ApiException catch (error) {
      widget.toast(error.message);
    }
  }

  Future<void> _changePassword() async {
    final current = TextEditingController();
    final next = TextEditingController();
    final confirm = TextEditingController();
    final ok = await _formDialog('Mot de passe', [
      _field(current, 'Mot de passe actuel', obscure: true),
      _field(next, 'Nouveau (8 caractères minimum)', obscure: true),
      _field(confirm, 'Confirmer le nouveau', obscure: true),
    ], 'Changer');
    if (ok != true) return;
    if (next.text != confirm.text) return widget.toast('Les deux nouveaux mots de passe sont différents');
    try {
      final data = await widget.api.post('/account/password',
          body: {'current_password': current.text, 'new_password': next.text}) as Map<String, dynamic>;
      widget.toast('${data['message']}');
      await _loadSessions();
    } on ApiException catch (error) {
      widget.toast(error.message);
    }
  }

  Future<void> _changePhone() async {
    final phone = TextEditingController();
    if (await _formDialog('Nouveau numéro', [_field(phone, 'Nouveau numéro (+229…)', keyboard: TextInputType.phone)],
            'Recevoir un code') !=
        true) {
      return;
    }
    final number = phone.text.trim();
    try {
      await widget.api.post('/account/phone/request', body: {'phone': number});
    } on ApiException catch (error) {
      return widget.toast(error.message);
    }
    final code = TextEditingController();
    final password = TextEditingController();
    if (await _formDialog('Code reçu au $number', [
          _field(code, 'Code à 6 chiffres', keyboard: TextInputType.number),
          _field(password, 'Votre mot de passe', obscure: true),
        ], 'Changer de numéro') !=
        true) {
      return;
    }
    try {
      final data = await widget.api.post('/account/phone/confirm',
          body: {'phone': number, 'code': code.text.trim(), 'password': password.text}) as Map<String, dynamic>;
      final newPhone = '${data['phone']}';
      widget.onPhoneChanged(newPhone);
      if (mounted) setState(() => _phone = newPhone);
      widget.toast('${data['message']}');
    } on ApiException catch (error) {
      widget.toast(error.message);
    }
  }

  Widget _field(TextEditingController controller, String label, {bool obscure = false, TextInputType? keyboard}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboard,
          decoration: InputDecoration(labelText: label),
        ),
      );

  Future<bool?> _formDialog(String title, List<Widget> fields, String action) => showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          backgroundColor: BnColors.surface,
          title: Text(title),
          content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: fields)),
          actions: [
            TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Annuler')),
            FilledButton(onPressed: () => Navigator.of(c).pop(true), child: Text(action)),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final sessions = _sessions;
    final others = (sessions ?? const []).where((s) => s['current'] != true).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _Title('Sécurité', "Protégez l'accès à votre compte."),
        _Group(title: 'Connexion', children: [
          _Row(icon: Icons.key_outlined, title: 'Mot de passe', subtitle: 'Les autres appareils seront déconnectés', onTap: _changePassword),
          _Row(icon: Icons.smartphone, title: 'Numéro de téléphone', subtitle: _phone, onTap: _changePhone),
        ]),
        _Group(title: 'Verrouillage de l\'application', children: [
          _Row(
            icon: Icons.pin_outlined,
            title: 'Code PIN',
            subtitle: _hasPin ? tr('Demandé à l\'ouverture et après 30 s en arrière-plan') : tr('Protéger BenneGo avec un code à 4 chiffres'),
            trailing: _Switch(value: _hasPin, onChanged: _togglePin),
          ),
          if (_hasPin)
            _Row(
              icon: Icons.fingerprint,
              title: 'Empreinte ou visage',
              subtitle: _bioAvailable ? tr('Déverrouiller sans taper le code') : tr('Aucun capteur configuré sur ce téléphone'),
              trailing: _Switch(value: _bioEnabled && _bioAvailable, onChanged: _bioAvailable ? _toggleBiometric : null),
            ),
        ]),
        _Group(title: 'Appareils connectés', children: [
          if (sessions == null)
            const Padding(padding: EdgeInsets.all(16), child: Text('Chargement…', style: TextStyle(color: BnColors.text3))),
          for (final s in sessions ?? const <Map<String, dynamic>>[])
            _Row(
              icon: '${s['device_label']}'.contains(RegExp('Android|iPhone|Application')) ? Icons.smartphone : Icons.laptop,
              muted: s['current'] != true,
              title: '${s['device_label'] ?? tr('Appareil')}',
              subtitle: s['current'] == true
                  ? tr('Cet appareil')
                  : 'Actif le ${formatDateTime(DateTime.tryParse('${s['last_seen_at']}')?.toLocal())}',
              trailing: s['current'] == true
                  ? null
                  : TextButton(
                      onPressed: () => _revoke('${s['id']}'),
                      child: const Text('Déconnecter', style: TextStyle(color: BnColors.danger)),
                    ),
            ),
          if (others > 0)
            TextButton(
              onPressed: _revokeOthers,
              child: const Text('Déconnecter tous les autres appareils', style: TextStyle(color: BnColors.danger)),
            ),
        ]),
      ],
    );
  }
}

/// Suppression du compte : règles des 60 jours et 6 mois, blocages expliqués, raison et mot de passe.
class _DeletePage extends StatefulWidget {
  const _DeletePage({required this.api, required this.role, required this.onDeleted});

  final ApiClient api;
  final String role;
  final Future<void> Function(DateTime restoreUntil) onDeleted;

  @override
  State<_DeletePage> createState() => _DeletePageState();
}

class _DeletePageState extends State<_DeletePage> {
  Map<String, dynamic>? _check;
  String? _reason;
  final _password = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    unawaited(widget.api.get('/account/deletion').then((data) {
      if (mounted) setState(() => _check = Map<String, dynamic>.from(data as Map));
    }, onError: (_) {
      if (mounted) setState(() => _check = {'can_delete': false, 'blockers': const []});
    }));
  }

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: BnColors.surface,
        content: const Text('Supprimer votre compte BenneGo ? Vous pourrez le reprendre pendant 60 jours.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.of(c).pop(true),
            child: const Text('Supprimer', style: TextStyle(color: BnColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final data = await widget.api.post('/account/deletion', body: {'password': _password.text, 'reason': _reason})
          as Map<String, dynamic>;
      await widget.onDeleted(DateTime.parse('${data['restore_until']}').toLocal());
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final check = _check;
    final blockers = [for (final b in (check?['blockers'] as List?) ?? const []) '${(b as Map)['message']}'];
    final credit = parseNum(check?['credit_balance']);
    const rules = [
      ('Tout de suite', 'votre compte est fermé, vous êtes déconnecté partout et ne recevez plus rien.'),
      ('Pendant 60 jours', 'reconnectez-vous avec votre numéro et votre mot de passe pour reprendre votre compte.'),
      ('Après 60 jours', 'le compte ne peut plus être repris et votre numéro est libéré.'),
      ('Après 6 mois', 'vos données personnelles sont effacées. Les commandes passées restent pour la comptabilité, sans votre nom.'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _Title('Supprimer mon compte', "Vous avez 60 jours pour changer d'avis."),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: BnColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: BnColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Ce qui se passe', style: TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              for (final (moment, what) in rules)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text.rich(TextSpan(children: [
                    TextSpan(text: '$moment : ', style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
                    TextSpan(text: what, style: const TextStyle(color: BnColors.text2)),
                  ])),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (check == null)
          const Center(child: CircularProgressIndicator(color: BnColors.brand))
        else if (check['can_delete'] != true)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: BnColors.warning.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: BnColors.warning),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Pas tout de suite', style: TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                for (final b in blockers) Text('• $b', style: const TextStyle(color: BnColors.text)),
              ],
            ),
          )
        else ...[
          if (credit > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'Votre crédit de ${formatFcfa(credit)} sera perdu'
                '${widget.role == 'driver' ? tr(' : demandez son versement avant de supprimer votre compte.') : '.'}',
                style: const TextStyle(color: BnColors.warning),
              ),
            ),
          DropdownButtonFormField<String>(
            initialValue: _reason,
            dropdownColor: BnColors.surface,
            decoration: InputDecoration(labelText: tr('Pourquoi partez-vous ? (facultatif)')),
            items: [for (final r in _reasons) DropdownMenuItem(value: r, child: Text(r))],
            onChanged: (v) => setState(() => _reason = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            obscureText: true,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(labelText: tr('Votre mot de passe pour confirmer')),
          ),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: _busy || _password.text.isEmpty ? null : _delete,
            style: FilledButton.styleFrom(backgroundColor: BnColors.danger, foregroundColor: Colors.white),
            child: Text(_busy ? '…' : 'Supprimer mon compte'),
          ),
        ],
      ],
    );
  }
}

/// À la connexion : compte supprimé il y a moins de 60 jours → proposer de le reprendre. Vrai si l'utilisateur accepte.
Future<bool> confirmAccountRestore(BuildContext context, ApiException error) async {
  final until = DateTime.tryParse('${error.details['restore_until']}')?.toLocal();
  final answer = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      backgroundColor: BnColors.surface,
      title: const Text('Compte en cours de suppression'),
      content: Text(until == null
          ? tr('Vous pouvez encore reprendre votre compte.')
          : 'Vous pouvez reprendre votre compte jusqu\'au ${formatDateTime(until).split(' ').first}.'),
      actions: [
        TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Non')),
        FilledButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Reprendre mon compte')),
      ],
    ),
  );
  return answer == true;
}

/// Ouvre les réglages du compte connecté. Compte supprimé : retour à la connexion avec la date limite de reprise.
Future<void> openAccountSettings(BuildContext context, Session session) {
  final user = session.user;
  if (user == null) return Future.value();
  final messenger = ScaffoldMessenger.of(context);
  final navigator = Navigator.of(context);
  return navigator.push(MaterialPageRoute<void>(
    builder: (_) => SettingsScreen(
      api: session.api,
      role: user.role,
      phone: user.phone,
      onPhoneChanged: session.updatePhone,
      onDeleted: (restoreUntil) async {
        navigator.popUntil((route) => route.isFirst);
        await session.logoutLocal();
        messenger.showSnackBar(SnackBar(
          duration: const Duration(seconds: 8),
          content: Text('Compte supprimé. Vous pouvez le reprendre jusqu\'au '
              '${formatDateTime(restoreUntil).split(' ').first} en vous reconnectant.'),
        ));
      },
    ),
  ));
}
