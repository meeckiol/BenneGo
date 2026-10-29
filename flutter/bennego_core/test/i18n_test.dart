import 'dart:convert';
import 'dart:io';

import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:flutter_test/flutter_test.dart';

Map<String, String> _dict(String lang) =>
    Map<String, String>.from(jsonDecode(File('../../shared/i18n/$lang.json').readAsStringSync()) as Map);

void main() {
  test('moteur identique au web : exact, gabarits, composés, gabarits vagues limités', () {
    final t = Translator(_dict('en'));
    expect(t.translate('Annuler'), 'Cancel');
    expect(t.translate('  Annuler '), '  Cancel ');
    expect(t.translate('Statut : Livrée'), 'Status: Delivered');
    expect(t.translate('Commande BG-1 en cours : attendez la livraison ou annulez-la.'),
        'Order BG-1 in progress: wait for delivery or cancel it.');
    expect(t.translate('2/3 types · calme 22:00–06:00'), '2/3 types · quiet 22:00–06:00');
    expect(t.translate('Kofi sur la route du chantier'), 'Kofi sur la route du chantier');
    expect(t.translate('Texte inconnu'), 'Texte inconnu');
  });

  test('les dictionnaires embarqués dans l\'application sont à jour', () {
    for (final file in Directory('../../shared/i18n').listSync().whereType<File>()) {
      final name = file.uri.pathSegments.last;
      if (!RegExp(r'^[a-z]{2}\.json$').hasMatch(name)) continue;
      final copy = File('assets/i18n/$name');
      expect(copy.existsSync(), isTrue, reason: '$name absent : lancez scripts/i18n-sync-flutter.sh');
      expect(copy.readAsStringSync(), file.readAsStringSync(), reason: '$name périmé : lancez scripts/i18n-sync-flutter.sh');
    }
  });

  testWidgets('le widget Text traduit et se redessine au changement de langue, même const', (tester) async {
    Lang.instance.useDictionary('fr', const {});
    await tester.pumpWidget(LangScope(
      child: const MaterialApp(home: Scaffold(body: Column(children: [Text('Annuler'), Text('Statut : Livrée')]))),
    ));
    expect(find.text('Annuler'), findsOneWidget);
    Lang.instance.useDictionary('en', _dict('en'));
    await tester.pump();
    expect(find.text('Cancel'), findsOneWidget);
    expect(find.text('Status: Delivered'), findsOneWidget);
    expect(tr('Valider'), 'Confirm');
    Lang.instance.useDictionary('fr', const {});
    await tester.pump();
    expect(find.text('Annuler'), findsOneWidget);
  });

  testWidgets('un texte calculé par un widget parent change aussi de langue', (tester) async {
    Lang.instance.useDictionary('fr', const {});
    await tester.pumpWidget(LangScope(
      child: MaterialApp(home: Builder(builder: (context) => Scaffold(body: Tooltip(message: tr('Annuler'), child: Text(tr('Valider')))))),
    ));
    expect(find.text('Valider'), findsOneWidget);
    Lang.instance.useDictionary('en', _dict('en'));
    await tester.pump();
    expect(find.text('Confirm'), findsOneWidget);
    Lang.instance.useDictionary('fr', const {});
    await tester.pump();
  });
}
