const { test, expect } = require('@playwright/test');
const { APPS } = require('./apps');
const { seedSession, EMPTY_RESPONSE } = require('./helpers');
const dashboard = require('./fixtures/admin-dashboard.json');
const analytics = require('./fixtures/admin-analytics.json');
const badges = require('./fixtures/admin-badges.json');

// Console admin avec des données réalistes (réponses réelles du serveur, données de démo) :
// tableau de bord, thème, filtres, menu latéral, page Analyses et version téléphone.
const app = APPS.admin;
const BASE = `http://localhost:${app.port}`;
const NUM = new Intl.NumberFormat('fr-FR');

const mockAdminApi = async (page, calls = []) => {
  // Fond de carte : hors ligne pendant les tests
  await page.route(/cartocdn\.com/, (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    calls.push({ method: route.request().method(), path: url.pathname + url.search, body: route.request().postData() });
    const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/api/admin/dashboard') return json({ ...dashboard, period: { ...dashboard.period, days: Number(url.searchParams.get('days')) || 7 } });
    if (url.pathname === '/api/admin/analytics') return json({ ...analytics, period: { ...analytics.period, days: Number(url.searchParams.get('days')) || 30 } });
    if (url.pathname === '/api/admin/badges') return json(badges);
    if (url.pathname === '/api/admin/analytics/objective') return json({ amount: JSON.parse(route.request().postData()).amount });
    // Autres écrans : réponse vide, comme un nouveau compte
    return route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_RESPONSE });
  });
};

const desktopOnly = (testInfo) => test.skip(testInfo.project.name !== 'desktop-chrome', 'scénario ordinateur');
const mobileOnly = (testInfo) => test.skip(testInfo.project.name !== 'mobile-chrome', 'scénario téléphone');

test.describe('console admin', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, app);
    // Le navigateur de test est en anglais : la console suivrait sa langue, on fixe le français
    await page.addInitScript(() => window.localStorage.setItem('bennego-langue', 'fr'));
  });

  test('tableau de bord : accueil, statistiques et listes avec les vraies données', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto(`${BASE}/`);
    await expect(page.getByRole('heading', { name: 'Bon retour, Superviseur 👋' })).toBeVisible();
    const hero = page.locator('.db-stat--hero');
    await expect(hero).toContainText("Chiffre d'affaires");
    await expect(hero).toContainText(NUM.format(Math.round(dashboard.revenue.total)));
    await expect(page.locator('.db-stat')).toHaveCount(5);
    await expect(page.getByRole('heading', { name: 'Commandes récentes' })).toBeVisible();
    await expect(page.getByText(dashboard.recent_orders[0].order_number).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'À traiter' })).toBeVisible();
  });

  test('tableau de bord : le thème suit l\'appareil, peut être forcé et reste choisi', async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await page.emulateMedia({ colorScheme: 'dark' });
    await mockAdminApi(page);
    await page.goto(`${BASE}/`);
    const board = page.locator('.db');
    await expect(board).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Thème clair' }).click();
    await expect(board).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('.db')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: "Comme l'appareil" }).click();
    await expect(page.locator('.db')).toHaveAttribute('data-theme', 'dark');
  });

  test('tableau de bord : changer de période recharge les données', async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const calls = [];
    await mockAdminApi(page, calls);
    await page.goto(`${BASE}/`);
    await expect(page.locator('.db-stat--hero')).toBeVisible();
    await page.getByRole('button', { name: 'Trimestre' }).click();
    await expect.poll(() => calls.some((c) => c.path === '/api/admin/dashboard?days=90')).toBe(true);
    await expect(page.locator('.db-stat--hero')).toContainText('vs trimestre précédent');
  });

  test('commandes récentes : filtre par statut et export CSV', async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await mockAdminApi(page);
    await page.goto(`${BASE}/`);
    const card = page.locator('.db-card', { has: page.getByRole('heading', { name: 'Commandes récentes' }) });
    await card.getByLabel('Filtrer par statut').selectOption('active');
    const pills = card.locator('tbody .db-pill');
    await expect(pills.first()).toBeVisible();
    for (const text of await pills.allTextContents()) expect(['Terminée', 'Validée', 'Annulée', 'À payer']).not.toContain(text);

    const [download] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: 'Exporter' }).click()]);
    expect(download.suggestedFilename()).toBe('bennego-commandes-recentes.csv');
    const csv = await (await download.createReadStream()).toArray();
    expect(Buffer.concat(csv).toString('utf8')).toContain('"Commande";"Client";"Service"');
  });

  test('menu latéral : compteurs, recherche (Entrée ouvre la rubrique) et cloche « À traiter »', async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await mockAdminApi(page);
    await page.goto(`${BASE}/`);
    const menu = page.getByRole('complementary', { name: 'Menu de la console' });
    await expect(menu.getByRole('link', { name: /Chauffeurs/ })).toContainText(String(badges.drivers));
    await expect(menu.getByRole('link', { name: /Paiements/ })).toContainText(String(badges.payments));

    const search = menu.getByRole('textbox', { name: 'Rechercher une rubrique' });
    await search.fill('paie');
    await expect(menu.getByRole('link')).toHaveCount(1);
    await search.press('Enter');
    await expect(page).toHaveURL(`${BASE}/payments`);

    await page.getByRole('button', { name: 'À traiter' }).click();
    const panel = page.getByRole('dialog', { name: 'À traiter' });
    await expect(panel.getByText('Chauffeurs à vérifier')).toBeVisible();
    await expect(panel).toContainText(String(badges.drivers));
  });

  test('menu latéral : réduit aux icônes, choix retenu', async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await mockAdminApi(page);
    await page.goto(`${BASE}/`);
    await page.getByRole('button', { name: 'Réduire le menu' }).click();
    await expect(page.locator('.adm')).toHaveClass(/adm--mini/);
    await page.reload();
    await expect(page.locator('.adm')).toHaveClass(/adm--mini/);
    await page.getByRole('button', { name: 'Agrandir le menu' }).click();
    await expect(page.locator('.adm')).not.toHaveClass(/adm--mini/);
  });

  test('Analyses : période, objectif mensuel modifiable', async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const calls = [];
    await mockAdminApi(page, calls);
    await page.goto(`${BASE}/analytics`);
    await expect(page.getByRole('heading', { name: 'Vue analytique' })).toBeVisible();
    await expect(page.getByText('Taux de livraison')).toBeVisible();
    await page.getByRole('button', { name: '7 jours' }).click();
    await expect.poll(() => calls.some((c) => c.path === '/api/admin/analytics?days=7')).toBe(true);

    await page.getByRole('button', { name: "Modifier l'objectif" }).click();
    await page.getByLabel('Objectif mensuel (FCFA)').fill('12 000 000');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => calls.find((c) => c.method === 'PUT')?.body).toBe(JSON.stringify({ amount: 12000000 }));
  });

  test('téléphone : le menu est un tiroir qui se referme après navigation, pages sans débordement', async ({ page }, testInfo) => {
    mobileOnly(testInfo);
    await mockAdminApi(page);
    await page.goto(`${BASE}/`);
    await expect(page.locator('.db-stat--hero')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await expect(page.locator('.adm')).toHaveClass(/adm--drawer/);
    await page.getByRole('complementary', { name: 'Menu de la console' }).getByRole('link', { name: 'Analyses' }).click();
    await expect(page).toHaveURL(`${BASE}/analytics`);
    await expect(page.locator('.adm')).not.toHaveClass(/adm--drawer/);
    await expect(page.getByRole('heading', { name: 'Vue analytique' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test('anglais : tableau de bord et menu traduits, dates des graphiques non retraduites', async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await page.addInitScript(() => window.localStorage.setItem('bennego-langue', 'en'));
    await mockAdminApi(page);
    await page.goto(`${BASE}/`);
    await expect(page.getByRole('heading', { name: 'Welcome back, Superviseur 👋' })).toBeVisible();
    await expect(page.locator('.db-stat--hero')).toContainText('Revenue');
    await expect(page.getByRole('complementary', { name: 'Console menu' }).getByRole('link', { name: 'Analytics' })).toBeVisible();
    // « Mar » (mars) ne doit pas devenir « Tue » (mardi) sur les axes des graphiques
    await expect(page.locator('.recharts-cartesian-axis-tick-value', { hasText: /^Tue$/ })).toHaveCount(0);
  });
});
