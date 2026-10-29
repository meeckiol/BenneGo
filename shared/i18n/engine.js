/*
 * Moteur de traduction BenneGo, commun au web (et repris à l'identique côté serveur et Flutter).
 * Les clés du dictionnaire sont les textes français affichés ; les parties variables s'écrivent {0}, {1}…
 * « Commande {0} en cours » → « Order {0} in progress » : la valeur trouvée dans le texte est recopiée.
 */

export const LANGUAGES = [
  { code: 'fr', locale: 'fr-FR', name: 'Français', english: 'French', hello: 'Bonjour' },
  { code: 'en', locale: 'en-GB', name: 'English', english: 'English', hello: 'Hello' },
  { code: 'es', locale: 'es-ES', name: 'Español', english: 'Spanish', hello: 'Hola' },
  { code: 'pt', locale: 'pt-BR', name: 'Português', english: 'Portuguese', hello: 'Olá' },
  { code: 'de', locale: 'de-DE', name: 'Deutsch', english: 'German', hello: 'Hallo' },
  { code: 'zh', locale: 'zh-CN', name: '简体中文', english: 'Chinese, Simplified', hello: '你好' },
  { code: 'ja', locale: 'ja-JP', name: '日本語', english: 'Japanese', hello: 'こんにちは' },
  { code: 'ko', locale: 'ko-KR', name: '한국어', english: 'Korean', hello: '안녕하세요' },
  { code: 'hi', locale: 'hi-IN', name: 'हिन्दी', english: 'Hindi', hello: 'नमस्ते' },
  { code: 'ms', locale: 'ms-MY', name: 'Bahasa Melayu', english: 'Malay', hello: 'Helo' },
];

const escape = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

/** Prépare un dictionnaire { français: traduction } pour des recherches rapides. */
export function createTranslator(dict = {}) {
  const exact = new Map();
  const templates = [];
  for (const [key, value] of Object.entries(dict)) {
    if (!value) continue;
    if (/\{\d+\}/.test(key)) {
      const order = [];
      const parts = key.split(/(\{\d+\})/);
      const source = parts.map((part, i) => {
        const m = part.match(/^\{(\d+)\}$/);
        if (!m) return escape(part);
        order.push(Number(m[1]));
        // Variable collée à la fin d'un mot, en fin de texte (« étoile{1} » : marque du pluriel) : elle peut être vide
        const suffix = i === parts.length - 2 && parts[i + 1] === '' && /\p{L}$/u.test(parts[i - 1] || '');
        return suffix ? '(.*?)' : '(.+?)';
      }).join('');
      // Le gabarit le plus précis (le plus de texte fixe) est essayé en premier
      const fixed = key.replace(/\{\d+\}/g, '');
      // Gabarit « faible » (peu de texte fixe, ex. « {0} sur {1} ») : il ne doit pas avaler une phrase entière
      // sauf s'il commence par un mot et ne garde qu'une variable finale (« Appeler {0} », « Statut : {0} »)
      const prefixed = /^\p{L}{4,}[^{]*\{\d+\}$/u.test(key) && order.length === 1;
      const weak = (fixed.match(/\p{L}/gu) || []).length < 8 && !prefixed;
      templates.push({ re: new RegExp(`^${source}$`, 's'), order, value, weight: fixed.length, weak });
    } else {
      exact.set(key, value);
    }
  }
  templates.sort((a, b) => b.weight - a.weight);
  const cache = new Map();

  /** Traduction d'un texte affiché ; inchangé s'il n'est pas dans le dictionnaire. Espaces de bord conservés. */
  const translate = (text) => {
    if (typeof text !== 'string' || !text) return text;
    const core = text.replace(/\s+/g, ' ').trim();
    if (!core || !/\p{L}/u.test(core)) return text;
    let out = cache.get(core);
    if (out === undefined) {
      out = exact.get(core) ?? null;
      if (out === null) {
        for (const t of templates) {
          const m = core.match(t.re);
          if (!m) continue;
          // … sauf quand ce texte figure tel quel dans le dictionnaire (« Note du chauffeur : 4 sur 5 »)
          if (t.weak && m.slice(1).some((v) => /\s/.test(v.trim()) && /\p{L}/u.test(v.replace(/FCFA|XOF|km|kg|m³|min|h\b/g, ''))
            && !exact.has(v.replace(/\s+/g, ' ').trim()))) continue;
          const values = {};
          t.order.forEach((n, i) => { values[n] = m[i + 1]; });
          // Les valeurs recopiées sont elles-mêmes traduites quand ce sont des textes connus
          out = t.value.replace(/\{(\d+)\}/g, (_, n) => translate(values[n] ?? ''));
          break;
        }
      }
      // Texte composé « A · B » sans traduction d'ensemble : chaque partie est traduite
      if (out === null && core.includes(' · ')) {
        const parts = core.split(' · ');
        const done = parts.map((part) => translate(part));
        if (done.some((d, i) => d !== parts[i])) out = done.join(' · ');
      }
      if (cache.size > 5000) cache.clear();
      cache.set(core, out);
    }
    if (out === null) return text;
    const lead = text.match(/^\s*/)[0];
    const trail = text.match(/\s*$/)[0];
    return lead + out + trail;
  };
  return { translate, size: exact.size + templates.length };
}
