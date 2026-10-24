/**
 * Lecture d'une commande écrite envoyée par WhatsApp (ex. « 16 m3 de sable lavé »).
 * Analyse par mots-clés, sans IA ni transcription : une quantité ou un matériau manquant
 * déclenche une question, jamais une commande devinée.
 */
const QUANTITIES = [
  { pattern: /\b(semi|25)\b/, m3: 25 },
  { pattern: /\b(double|8 roues|16)\b/, m3: 16 },
  { pattern: /\b(6 roues|simple|10)\b/, m3: 10 },
];

const MATERIALS = [
  { pattern: /sable.*lav|lav.*sable/, label: 'sable lavé' },
  { pattern: /sable/, label: 'sable de rivière' },
  { pattern: /gravier|kpe/, label: 'gravier concassé' },
  { pattern: /lat[ée]rite|vovo|rouge/, label: 'latérite' },
];

/** @returns {{quantity_m3: number|null, material: string|null}} */
const parseTextOrder = (text) => {
  const normalized = (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const quantity = QUANTITIES.find((q) => q.pattern.test(normalized));
  const explicit = normalized.match(/(\d+(?:[.,]\d+)?)\s*(m3|m³|m\b)/);
  const quantity_m3 = explicit
    ? Number(explicit[1].replace(',', '.'))
    : (quantity ? quantity.m3 : null);
  const material = MATERIALS.find((m) => m.pattern.test(normalized));
  return { quantity_m3, material: material ? material.label : null };
};

module.exports = { parseTextOrder };
