/// Moteur de traduction BenneGo, portage exact de shared/i18n/engine.js (web) et du service du serveur.
/// Clés = textes français affichés ; parties variables {0}, {1}… recopiées (et traduites si connues).
class Translator {
  Translator(Map<String, String> dict) {
    for (final entry in dict.entries) {
      final key = entry.key;
      final value = entry.value;
      if (value.isEmpty) continue;
      if (_var.hasMatch(key)) {
        final order = <int>[];
        final source = key.splitMapJoin(
          _var,
          onMatch: (m) {
            order.add(int.parse(m.group(1)!));
            return '(.+?)';
          },
          onNonMatch: RegExp.escape,
        );
        final fixed = key.replaceAll(_var, '');
        // Gabarit « faible » (peu de texte fixe, ex. « {0} sur {1} ») : il ne doit pas avaler une phrase entière
        final weak = RegExp(r'\p{L}', unicode: true).allMatches(fixed).length < 8;
        _templates.add(_Template(RegExp('^$source\$', dotAll: true), order, value, fixed.length, weak));
      } else {
        _exact[key] = value;
      }
    }
    _templates.sort((a, b) => b.weight.compareTo(a.weight));
  }

  static final _var = RegExp(r'\{(\d+)\}');
  static final _space = RegExp(r'\s+');
  static final _letter = RegExp(r'\p{L}', unicode: true);
  static final _units = RegExp(r'FCFA|XOF|km|kg|m³|min|h\b');

  final Map<String, String> _exact = {};
  final List<_Template> _templates = [];
  final Map<String, String?> _cache = {};

  int get size => _exact.length + _templates.length;

  /// Traduction d'un texte affiché ; inchangé s'il est inconnu. Espaces de bord conservés.
  String translate(String text) {
    final core = text.replaceAll(_space, ' ').trim();
    if (core.isEmpty || !_letter.hasMatch(core)) return text;
    String? out;
    if (_cache.containsKey(core)) {
      out = _cache[core];
    } else {
      out = _exact[core];
      if (out == null) {
        for (final t in _templates) {
          final m = t.re.firstMatch(core);
          if (m == null) continue;
          final values = [for (var i = 1; i <= m.groupCount; i++) m.group(i) ?? ''];
          if (t.weak && values.any((v) => v.trim().contains(' ') && _letter.hasMatch(v.replaceAll(_units, '')))) continue;
          final byIndex = {for (var i = 0; i < t.order.length; i++) t.order[i]: values[i]};
          out = t.value.replaceAllMapped(_var, (v) => translate(byIndex[int.parse(v.group(1)!)] ?? ''));
          break;
        }
      }
      // Texte composé « A · B » sans traduction d'ensemble : chaque partie est traduite
      if (out == null && core.contains(' · ')) {
        final parts = core.split(' · ');
        final done = parts.map(translate).toList();
        var changed = false;
        for (var i = 0; i < parts.length; i++) {
          if (done[i] != parts[i]) changed = true;
        }
        if (changed) out = done.join(' · ');
      }
      if (_cache.length > 5000) _cache.clear();
      _cache[core] = out;
    }
    if (out == null) return text;
    final lead = RegExp(r'^\s*').stringMatch(text) ?? '';
    final trail = RegExp(r'\s*$').stringMatch(text) ?? '';
    return '$lead$out$trail';
  }
}

class _Template {
  _Template(this.re, this.order, this.value, this.weight, this.weak);

  final RegExp re;
  final List<int> order;
  final String value;
  final int weight;
  final bool weak;
}
