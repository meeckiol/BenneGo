const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { APPS } = require('./apps');
const { formatViolations, seedSession, mockEmptyApi } = require('./helpers');

// Chaque écran statique de chaque application, en session connectée et sans données.
for (const [name, app] of Object.entries(APPS)) {
  for (const route of app.routes) {
    test.describe(`${name} ${route}`, () => {
      test.beforeEach(async ({ page }) => {
        await seedSession(page, app);
        await mockEmptyApi(page);
      });

      test('s\'affiche sans écran d\'erreur et sans redirection vers la connexion', async ({ page }) => {
        // La frontière d'erreur journalise la cause : on la remonte dans le message d'échec.
        const renderErrors = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error' && msg.text().includes('Erreur d\'affichage')) renderErrors.push(msg.text());
        });

        await page.goto(`http://localhost:${app.port}${route}`);
        await page.waitForLoadState('networkidle');

        await expect(page).not.toHaveURL(/\/login$/);
        expect(renderErrors, renderErrors.join('\n')).toEqual([]);
        await expect(page.getByText('Une erreur est survenue')).toHaveCount(0);
      });

      test('ne déborde pas horizontalement', async ({ page }) => {
        await page.goto(`http://localhost:${app.port}${route}`);
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });

      test('respecte WCAG 2.1 AA', async ({ page }) => {
        await page.goto(`http://localhost:${app.port}${route}`);
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        const summary = formatViolations(results.violations);
        expect(summary, summary.join('\n')).toEqual([]);
      });
    });
  }
}
