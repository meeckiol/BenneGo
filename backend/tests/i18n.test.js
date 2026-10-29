/** Traductions : moteur commun (textes exacts, gabarits {0}, textes composés « A · B ») et dictionnaires cohérents. */
const fs = require('fs');
const path = require('path');
const { translate, LANGUAGES } = require('../src/services/i18n.service');
const settings = require('../src/services/settings.service');

const DIR = path.join(__dirname, '../../shared/i18n');

test('textes exacts, gabarits et textes composés', () => {
  expect(translate('Annuler', 'en')).toBe('Cancel');
  expect(translate('Statut : Livrée', 'en')).toBe('Status: Delivered');
  expect(translate('Commande BG-1 en cours : attendez la livraison ou annulez-la.', 'en'))
    .toBe('Order BG-1 in progress: wait for delivery or cancel it.');
  expect(translate('2/3 types · calme 22:00–06:00', 'en')).toBe('2/3 types · quiet 22:00–06:00');
  // Gabarit trop vague : ne doit pas avaler une phrase entière
  expect(translate('Kofi sur la route du chantier', 'en')).toBe('Kofi sur la route du chantier');
  expect(translate('Texte inconnu', 'en')).toBe('Texte inconnu');
  expect(translate('Annuler', 'fr')).toBe('Annuler');
});

test('chaque dictionnaire est du JSON valide et n\'invente pas de variable', () => {
  const files = fs.readdirSync(DIR).filter((f) => /^[a-z]{2}\.json$/.test(f));
  expect(files).toContain('en.json');
  for (const file of files) {
    expect(LANGUAGES).toContain(file.slice(0, 2));
    const dict = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
    for (const [fr, tr] of Object.entries(dict)) {
      const vars = new Set(fr.match(/\{\d+\}/g) || []);
      for (const v of tr.match(/\{\d+\}/g) || []) {
        if (!vars.has(v)) throw new Error(`${file} : ${v} inventé dans « ${tr} » (clé « ${fr} »)`);
      }
    }
  }
});

test('la langue fait partie des réglages, avec validation', () => {
  expect(settings.merge('client', {}).language).toBe('fr');
  expect(settings.merge('client', { language: 'en' }).language).toBe('en');
  expect(settings.merge('client', { language: 'xx' }).language).toBe('fr');
  expect(settings.validatePatch('driver', { language: 'ja' })).toEqual({ language: 'ja' });
  expect(() => settings.validatePatch('driver', { language: 'klingon' })).toThrow('Langue non prise en charge');
});
