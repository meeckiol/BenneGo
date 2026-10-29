import { createTranslator, LANGUAGES } from './engine';

/*
 * Traduction des pages web sans toucher au code des écrans : les textes affichés (nœuds de texte,
 * placeholder, title, aria-label, alt) sont remplacés à la volée par leur traduction, et retrouvent
 * leur version française si l'on revient au français. Les éléments marqués translate="no" ou
 * .notranslate (messages des utilisateurs, noms de langues) ne sont jamais traduits.
 */

const STORAGE_KEY = 'bennego-langue';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);

// Dictionnaires chargés à la demande (un fichier par langue, hors français)
const loaders = import.meta.glob('./*.json');

let current = 'fr';
let translator = null;
let observer = null;
const textSource = new WeakMap(); // nœud → { fr, shown }
const attrSource = new WeakMap(); // élément → { attr: { fr, shown } }
const listeners = new Set();

const supported = (code) => LANGUAGES.some((l) => l.code === code);

export const savedLanguage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && supported(stored)) return stored;
  } catch { /* stockage indisponible */ }
  const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  return supported(nav) ? nav : 'fr';
};

/** Vrai si une langue a déjà été choisie sur cet appareil. */
export const hasSavedLanguage = () => {
  try { return Boolean(localStorage.getItem(STORAGE_KEY)); } catch { return false; }
};

export const currentLanguage = () => current;
export const onLanguageChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Paramètre régional des dates (noms des jours et des mois) dans la langue choisie. */
export const dateLocale = () => LANGUAGES.find((l) => l.code === current)?.locale || 'fr-FR';

/** Traduction d'un texte dans la langue choisie (pour window.confirm, titres de page…). */
export const t = (text) => (translator ? translator.translate(text) : text);

const skipped = (el) => {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName) || e.isContentEditable) return true;
    if (e.getAttribute('translate') === 'no' || e.classList.contains('notranslate')) return true;
  }
  return false;
};

const translateText = (node) => {
  const value = node.nodeValue;
  let src = textSource.get(node);
  // Texte changé par React depuis notre traduction : c'est un nouveau texte français
  if (!src || value !== src.shown) src = { fr: value, shown: value };
  const next = translator && !skipped(node.parentElement) ? translator.translate(src.fr) : src.fr;
  src.shown = next;
  textSource.set(node, src);
  if (next !== value) node.nodeValue = next;
};

// Le contenu d'une zone de saisie n'est jamais traduit, mais son indication (placeholder) l'est
const attrsSkipped = (el) => (el.tagName === 'TEXTAREA'
  ? el.getAttribute('translate') === 'no' || el.classList.contains('notranslate') || skipped(el.parentElement)
  : skipped(el));

const translateAttrs = (el) => {
  if (attrsSkipped(el)) return;
  let map = attrSource.get(el);
  for (const attr of ATTRS) {
    if (!el.hasAttribute(attr)) continue;
    const value = el.getAttribute(attr);
    if (!map) { map = {}; attrSource.set(el, map); }
    let src = map[attr];
    if (!src || value !== src.shown) src = { fr: value, shown: value };
    const next = translator ? translator.translate(src.fr) : src.fr;
    src.shown = next;
    map[attr] = src;
    if (next !== value) el.setAttribute(attr, next);
  }
};

const walk = (root) => {
  if (root.nodeType === 3) { translateText(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1) translateAttrs(root);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    if (n.nodeType === 3) translateText(n); else translateAttrs(n);
  }
};

const start = () => {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    observer.disconnect();
    for (const m of mutations) {
      if (m.type === 'characterData') translateText(m.target);
      else if (m.type === 'attributes') translateAttrs(m.target);
      else m.addedNodes.forEach(walk);
    }
    observe();
  });
  observe();
};
const observe = () => observer.observe(document.body, {
  subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS,
});

// Boîtes de dialogue du navigateur : traduites aussi
let dialogsPatched = false;
const patchDialogs = () => {
  if (dialogsPatched) return;
  dialogsPatched = true;
  for (const name of ['alert', 'confirm', 'prompt']) {
    const original = window[name].bind(window);
    window[name] = (message, ...rest) => original(t(message), ...rest);
  }
};

/** Choisit la langue : charge son dictionnaire puis traduit toute la page (le français rétablit les textes). */
export async function setLanguage(code, { persist = true } = {}) {
  const lang = supported(code) ? code : 'fr';
  if (lang === 'fr') {
    translator = null;
  } else {
    const load = loaders[`./${lang}.json`];
    const dict = load ? (await load()).default : {};
    translator = createTranslator(dict);
  }
  current = lang;
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* stockage indisponible */ }
  }
  document.documentElement.lang = lang;
  patchDialogs();
  if (document.body) {
    start();
    observer.disconnect();
    walk(document.body);
    observe();
  }
  listeners.forEach((fn) => fn(lang));
  return lang;
}

/** À appeler avant le premier affichage : langue enregistrée sur l'appareil (ou celle du navigateur). */
export const initLanguage = () => setLanguage(savedLanguage(), { persist: hasSavedLanguage() });
