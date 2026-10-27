const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { APPS } = require('./apps');
const { formatViolations } = require('./helpers');

// Session simulée : le store Zustand persisté est lu au chargement, comme après une vraie connexion.
const SESSIONS = {
  client: { key: 'bennego-auth', role: 'client', name: 'Ing. Koffi (Entreprise BTP)' },
  admin: { key: 'bennego-admin-auth', role: 'admin', name: 'Superviseur BenneGo' },
  driver: { key: 'bennego-driver-auth', role: 'driver', name: 'Chauffeur Test' },
};

// Réponses vides : l'écran doit rester utilisable sans données (cas réel d'un nouveau compte).
const EMPTY_RESPONSE = JSON.stringify({
  orders: [], items: [], data: [], stats: {}, reviews: [], drivers: [], clients: [], companies: [],
  pagination: { total: 0, page: 1, limit: 20, pages: 0 },
});

for (const [name, app] of Object.entries(APPS)) {
  const session = SESSIONS[name];

  test.describe(`${name} connecté`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(({ key, role, fullName }) => {
        const state = {
          user: { id: '00000000-0000-4000-8000-000000000001', full_name: fullName, phone: '+22997000000', role },
          token: 'test-token-e2e',
          isAuthenticated: true,
        };
        window.localStorage.setItem(key, JSON.stringify({ state, version: 0 }));
      }, { key: session.key, role: session.role, fullName: session.name });

      await page.route('**/api/**', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: EMPTY_RESPONSE,
      }));
    });

    test('l\'accueil s\'affiche sans écran d\'erreur, même sans données', async ({ page }) => {
      await page.goto(`http://localhost:${app.port}/`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(new RegExp(`localhost:${app.port}/?$`));
      await expect(page.getByText('Une erreur est survenue')).toHaveCount(0);
    });

    test('l\'accueil connecté n\'a pas de violation WCAG 2.1 AA', async ({ page }) => {
      await page.goto(`http://localhost:${app.port}/`);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const summary = formatViolations(results.violations);
      expect(summary, summary.join('\n')).toEqual([]);
    });

    test('l\'accueil connecté tient dans la largeur de l\'écran', async ({ page }) => {
      await page.goto(`http://localhost:${app.port}/`);
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
