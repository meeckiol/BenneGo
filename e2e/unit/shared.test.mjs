// Tests unitaires de la logique partagée par les trois applications web (sans navigateur ni serveur).
// Lancement : npm run test:web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createTranslator, LANGUAGES } from '../../shared/i18n/engine.js';
import { quoteLines, money, km } from '../../shared/quoteLines.js';

const I18N = new URL('../../shared/i18n/', import.meta.url);
const dict = (lang) => JSON.parse(readFileSync(new URL(`${lang}.json`, I18N), 'utf8'));
const en = createTranslator(dict('en'));

test('traduction : textes exacts, gabarits, textes composés et espaces conservés', () => {
  assert.equal(en.translate('Annuler'), 'Cancel');
  assert.equal(en.translate('  Annuler '), '  Cancel ');
  assert.equal(en.translate('Statut : Livrée'), 'Status: Delivered');
  assert.equal(en.translate('2/3 types · calme 22:00–06:00'), '2/3 types · quiet 22:00–06:00');
  assert.equal(en.translate('Texte inconnu'), 'Texte inconnu');
  assert.equal(en.translate('45 000'), '45 000');
});

test('traduction : gabarit court, pluriel collé et texte connu dans un gabarit vague', () => {
  assert.equal(en.translate('Appeler Rodrigue Dossou'), 'Call Rodrigue Dossou');
  assert.equal(en.translate('1 étoile'), '1 star');
  assert.equal(en.translate('3 étoiles'), '3 stars');
  assert.equal(en.translate('Note du chauffeur : 4 sur 5'), 'Driver rating: 4 out of 5');
  // Un gabarit vague n'avale pas une phrase entière inconnue
  assert.equal(en.translate('Kofi sur la route du chantier'), 'Kofi sur la route du chantier');
});

test('traduction : chaque langue proposée a un dictionnaire et un format de date', () => {
  const files = readdirSync(I18N).filter((f) => /^[a-z]{2}\.json$/.test(f)).map((f) => f.slice(0, 2));
  for (const { code, locale } of LANGUAGES) {
    assert.ok(locale, `format de date manquant pour ${code}`);
    if (code !== 'fr') assert.ok(files.includes(code), `dictionnaire manquant : ${code}.json`);
  }
});

test('traduction : tout texte de l\'interface est traduit dans chaque langue', () => {
  const keys = JSON.parse(readFileSync(new URL('keys.json', I18N), 'utf8'));
  const english = dict('en');
  const missingEn = keys.filter((k) => !(k in english));
  assert.deepEqual(missingEn, [], `textes sans traduction anglaise (scripts/i18n-missing.py en) :\n${missingEn.join('\n')}`);
  for (const { code } of LANGUAGES.filter((l) => !['fr', 'en'].includes(l.code))) {
    const d = dict(code);
    // Un texte gardé tel quel en anglais (valeur vide) peut l'être aussi ailleurs
    const missing = keys.filter((k) => english[k] && !(k in d));
    assert.deepEqual(missing, [], `${code} : ${missing.length} texte(s) sans traduction, ex. ${missing.slice(0, 5).join(' | ')}`);
  }
});

test('traduction : aucune variable {n} inventée dans les dictionnaires', () => {
  for (const { code } of LANGUAGES.filter((l) => l.code !== 'fr')) {
    for (const [key, value] of Object.entries(dict(code))) {
      const allowed = new Set(key.match(/\{\d+\}/g) || []);
      for (const v of value.match(/\{\d+\}/g) || []) assert.ok(allowed.has(v), `${code} : ${v} inconnu dans « ${value} »`);
    }
  }
});

test('devis : lignes matériaux, arrondi et somme égale au prix', () => {
  const lines = quoteLines({
    truck_type: 'double_benne', base_fee: 5000, distance_cost: 14000, loading_fee: 3000,
    quantity: 10, material_unit_price: 8000, material_cost: 80000, rounding: 500, distance_km: 20,
  }, { pricePerKm: 700 });
  assert.deepEqual(lines.map((l) => l.amount), [5000, 14000, 3000, 80000, 500]);
  assert.equal(lines[1].label, `Transport : ${km(20)} × ${money(700)}/km`);
  assert.equal(lines[1].hint, 'Double benne · ×1,4');
  assert.equal(lines.at(-1).label, 'Arrondi au millier supérieur');
});

test('devis : évacuation comptée par rotation, complément au prix minimum, montants nuls omis', () => {
  const lines = quoteLines({
    order_type: 'EVACUATION', rotations: 3, base_pickup_fee: 10000, distance_cost: 30000, price_per_km: 500,
    distance_km: 60, rounding: 2000, minimum_applied: true, minimum_price: 50000, loading_fee: 0,
  });
  assert.equal(lines[0].label, `Forfait prise en charge : 3 × ${money(10000)}`);
  assert.equal(lines[0].amount, 30000);
  assert.equal(lines.at(-1).label, `Complément au prix minimum (${money(50000)})`);
  assert.equal(lines.length, 3);
  assert.deepEqual(quoteLines(null), []);
});

test('devis : location d\'engin', () => {
  const lines = quoteLines({ order_type: 'RENTAL', duration_hours: 8, hourly_rate: 25000, rental_subtotal: 200000, mobilization_fee: 15000 });
  assert.deepEqual(lines.map((l) => l.amount), [200000, 15000]);
  assert.equal(lines[0].label, `Location : 8 h × ${money(25000)}/h`);
});
