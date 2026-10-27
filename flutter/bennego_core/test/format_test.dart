import 'package:bennego_core/bennego_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUpAll(initFrenchFormats);

  test('parseNum accepte les nombres et les décimaux envoyés en chaîne', () {
    expect(parseNum(12), 12);
    expect(parseNum('45000.00'), 45000);
    expect(parseNum(null), 0);
    expect(parseNumOrNull('abc'), isNull);
  });

  test('formatFcfa groupe les milliers et ajoute FCFA', () {
    final formatted = formatFcfa(45000);
    expect(formatted, endsWith('FCFA'));
    expect(formatted.replaceAll(RegExp('[^0-9]'), ''), '45000');
  });

  test('initialsOf prend les deux premières lettres', () {
    expect(initialsOf('Rodrigue Dossou'), 'RD');
    expect(initialsOf('   '), 'B');
  });
}
