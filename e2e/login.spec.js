const { test, expect } = require('@playwright/test');
const { APPS } = require('./apps');

// Une mauvaise combinaison doit être refusée avec un message clair, sans session créée.
test('client : un mauvais mot de passe affiche le message d\'erreur et ne connecte pas', async ({ page }) => {
  await page.route('**/api/auth/login', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Numéro ou mot de passe incorrect' }),
  }));

  await page.goto(`http://localhost:${APPS.client.port}/login`);
  await page.locator('input[type="tel"]').fill('+22997000000');
  await page.locator('input[type="password"]').fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page.getByText('Numéro ou mot de passe incorrect')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('admin : un compte non administrateur est refusé', async ({ page }) => {
  await page.route('**/api/auth/login', (route) => route.fulfill({
    status: 403,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Accès réservé aux administrateurs' }),
  }));

  await page.goto(`http://localhost:${APPS.admin.port}/login`);
  await page.locator('input[type="tel"]').fill('+22997000000');
  await page.locator('input[type="password"]').fill('motdepasse-valide');
  await page.getByRole('button', { name: /accéder au tableau de bord/i }).click();

  await expect(page.getByText(/réservé aux administrateurs/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
