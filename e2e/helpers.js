// Met en forme un rapport axe : une ligne par nœud fautif, avec son sélecteur et le détail mesuré
// (couleurs et ratio pour le contraste). Le résumé est condensé pour rester lisible.
const SUMMARY_MAX_LENGTH = 260;
const formatViolations = (violations) => violations.flatMap((violation) => violation.nodes.map((node) => {
  const detail = (node.failureSummary ?? violation.help).replace(/\s+/g, ' ').replace(/Fix any of the following: ?/, '');
  return `${violation.id} — ${node.target.join(' ')} — ${detail}`.slice(0, SUMMARY_MAX_LENGTH);
}));

// Session simulée : le store Zustand persisté est lu au chargement, comme après une vraie connexion.
const seedSession = (page, app) => page.addInitScript(({ key, role, fullName }) => {
  const state = {
    user: { id: '00000000-0000-4000-8000-000000000001', full_name: fullName, phone: '+22997000000', role },
    token: 'test-token-e2e',
    isAuthenticated: true,
  };
  window.localStorage.setItem(key, JSON.stringify({ state, version: 0 }));
}, { key: app.storageKey, role: app.role, fullName: app.fullName });

// Réponses vides : l'écran doit rester utilisable sans données (cas réel d'un nouveau compte).
// Clés réelles des réponses du backend (admin.routes.js, client et chauffeur inclus).
const EMPTY_RESPONSE = JSON.stringify({
  orders: [], items: [], data: [], stats: {}, companies: [], drivers: [], clients: [],
  payouts: [], platform_reviews: [], driver_reviews: [], referrals: [], promos: [],
  pagination: { total: 0, page: 1, limit: 20, pages: 0 },
});

const mockEmptyApi = (page) => page.route('**/api/**', (route) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: EMPTY_RESPONSE,
}));

module.exports = { formatViolations, seedSession, mockEmptyApi, EMPTY_RESPONSE };
