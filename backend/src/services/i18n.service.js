/**
 * Traduction des notifications push dans la langue choisie par l'utilisateur (réglages > langue).
 * Même dictionnaire et même moteur que les applications : shared/i18n/<langue>.json, clés = textes français,
 * parties variables {0}, {1}… Sans dictionnaire (conteneur sans dossier shared/), le français est gardé.
 */
const fs = require('fs');
const path = require('path');

const LANGUAGES = ['fr', 'en', 'es', 'pt', 'de', 'zh', 'ja', 'ko', 'hi', 'ms'];
const DIR = process.env.I18N_DIR || path.join(__dirname, '../../../shared/i18n');
const translators = new Map();

const escape = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

const build = (dict) => {
  const exact = new Map();
  const templates = [];
  for (const [key, value] of Object.entries(dict)) {
    if (!value) continue;
    if (/\{\d+\}/.test(key)) {
      const order = [];
      const source = key.split(/(\{\d+\})/).map((part) => {
        const m = part.match(/^\{(\d+)\}$/);
        if (m) { order.push(Number(m[1])); return '(.+?)'; }
        return escape(part);
      }).join('');
      const fixed = key.replace(/\{\d+\}/g, '');
      // Gabarit « faible » (peu de texte fixe, ex. « {0} sur {1} ») : il ne doit pas avaler une phrase entière
      const weak = (fixed.match(/\p{L}/gu) || []).length < 8;
      templates.push({ re: new RegExp(`^${source}$`, 's'), order, value, weight: fixed.length, weak });
    } else {
      exact.set(key, value);
    }
  }
  templates.sort((a, b) => b.weight - a.weight);
  const translate = (text) => {
    if (typeof text !== 'string') return text;
    const core = text.replace(/\s+/g, ' ').trim();
    if (exact.has(core)) return exact.get(core);
    for (const t of templates) {
      const m = core.match(t.re);
      if (!m) continue;
      if (t.weak && m.slice(1).some((v) => /\s/.test(v.trim()) && /\p{L}/u.test(v.replace(/FCFA|XOF|km|kg|m³|min|h\b/g, '')))) continue;
      const values = {};
      t.order.forEach((n, i) => { values[n] = m[i + 1]; });
      return t.value.replace(/\{(\d+)\}/g, (_, n) => translate(values[n] ?? ''));
    }
    // Texte composé « A · B » : chaque partie est traduite
    if (core.includes(' · ')) return core.split(' · ').map(translate).join(' · ');
    return text;
  };
  return translate;
};

const translatorFor = (lang) => {
  if (!lang || lang === 'fr' || !LANGUAGES.includes(lang)) return null;
  if (!translators.has(lang)) {
    let dict = {};
    try {
      dict = JSON.parse(fs.readFileSync(path.join(DIR, `${lang}.json`), 'utf8'));
    } catch { /* dictionnaire absent : français */ }
    translators.set(lang, build(dict));
  }
  return translators.get(lang);
};

/** Texte français → langue demandée (inchangé si inconnu). */
const translate = (text, lang) => {
  const tr = translatorFor(lang);
  return tr ? tr(text) : text;
};

module.exports = { LANGUAGES, translate };
