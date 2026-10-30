const { test, expect } = require('@playwright/test');
const { APPS } = require('./apps');

// Une page protégée ne doit jamais s'afficher sans session : redirection vers la connexion.
// Côté client, l'accueil est la vitrine publique : la page protégée testée est la liste des commandes.
for (const [name, app] of Object.entries(APPS)) {
  const protectedPath = name === 'client' ? '/orders' : '/';
  test(`${name} : ${protectedPath} redirige vers /login sans session`, async ({ page }) => {
    await page.goto(`http://localhost:${app.port}${protectedPath}`);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[type="tel"]').first()).toBeVisible();
  });
}

test('client : la vitrine publique s\'affiche aux visiteurs', async ({ page }) => {
  // La vitrine n'est plus l'accueil (qui mène à la connexion) : elle reste sur /vitrine
  await page.goto(`http://localhost:${APPS.client.port}/vitrine`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('livré sur le chantier');
  await expect(page.getByRole('link', { name: 'Obtenir un devis' }).first()).toBeVisible();
});

test('le bouton « accès démo » n\'apparaît pas dans le build de production', async ({ page }) => {
  for (const app of [APPS.client, APPS.admin]) {
    await page.goto(`http://localhost:${app.port}/login`);
    await expect(page.getByRole('button', { name: /accès démo/i })).toHaveCount(0);
  }
});
