const { test, expect } = require('@playwright/test');
const { APPS } = require('./apps');

// Une page protégée ne doit jamais s'afficher sans session : redirection vers la connexion.
for (const [name, app] of Object.entries(APPS)) {
  test(`${name} : la page d'accueil redirige vers /login sans session`, async ({ page }) => {
    await page.goto(`http://localhost:${app.port}/`);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[type="tel"]').first()).toBeVisible();
  });
}

test('le bouton « accès démo » n\'apparaît pas dans le build de production', async ({ page }) => {
  for (const app of [APPS.client, APPS.admin]) {
    await page.goto(`http://localhost:${app.port}/login`);
    await expect(page.getByRole('button', { name: /accès démo/i })).toHaveCount(0);
  }
});
