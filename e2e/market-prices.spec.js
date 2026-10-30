const { test, expect } = require('@playwright/test');
const { APPS } = require('./apps');
const { seedSession, EMPTY_RESPONSE } = require('./helpers');

// Prix du marché au voyage : publiés par l'équipe (console admin), vus par le client sur l'accueil et pendant la commande.
const CATALOG = {
  materials: [
    { key: 'sable_lagunaire', name: 'Sable lagunaire', voyage: true },
    { key: 'gravier_15_25', name: 'Gravier 15/25', voyage: true },
    { key: 'laterite', name: 'Latérite (terre rouge)', voyage: true },
    { key: 'ciment', name: 'Ciment (sac de 50 kg)', voyage: false },
  ],
  trucks: [
    { key: '6_roues', name: 'Camion 6 roues', truck_types: ['simple_benne', 'pickup'] },
    { key: '10_roues', name: 'Camion 10 roues', truck_types: ['double_benne', 'plateau'] },
    { key: '12_roues', name: 'Camion 12 roues', truck_types: ['semi_remorque', 'grue'] },
  ],
};
const row = (id, material, truck, avg, trend) => ({
  id, material_key: material.key, material_name: material.name, truck_size: truck.key, truck_name: truck.name,
  week_start: '2026-10-26', week_end: '2026-11-01', price_min: avg - 5000, price_avg: avg, price_max: avg + 5000,
  trend, change: trend === 'up' ? 0.04 : null,
});
const [sable, gravier] = CATALOG.materials;
const [t6, t10] = CATALOG.trucks;
const ITEMS = [row(1, sable, t6, 45000, 'up'), row(2, sable, t10, 85000, 'up'), row(3, gravier, t10, 120000, 'stable')];

const mockApi = async (page, calls = []) => {
  await page.route(/cartocdn\.com|maps\.googleapis/, (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const { pathname } = new URL(route.request().url());
    calls.push({ method: route.request().method(), path: pathname, body: route.request().postData() });
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (pathname === '/api/barometer/catalog') return json(CATALOG);
    if (pathname === '/api/barometer') return json({ items: ITEMS });
    if (pathname === '/api/admin/barometer') return json({ message: 'Prix publié', barometer: ITEMS[0] }, 201);
    return route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_RESPONSE });
  });
};

test.describe('prix du marché', () => {
  test('client : l\'accueil montre le prix du voyage en camion 10 roues, avec des dates claires', async ({ page }) => {
    const app = APPS.client;
    await seedSession(page, app);
    await mockApi(page);
    await page.goto(`http://localhost:${app.port}/`);
    const card = page.getByRole('region', { name: 'Prix du marché' });
    await expect(card).toContainText('du 26 oct. au 1 nov.');
    await expect(card.getByRole('link', { name: /Sable lagunaire/ })).toContainText('85 000 FCFA');
    await expect(card.getByRole('link', { name: /Gravier 15\/25/ })).toContainText('120 000 FCFA');
    await expect(card.getByLabel('En hausse')).toHaveCount(1);
    await card.getByRole('link', { name: /Sable lagunaire/ }).click();
    await expect(page.getByRole('combobox', { name: 'Matériau commandé' })).toHaveValue('Sable lagunaire');
  });

  test('client : menu des matériaux d\'ici, prix du marché selon le camion, « Autre » pour écrire', async ({ page }) => {
    const app = APPS.client;
    await seedSession(page, app);
    await mockApi(page);
    // Tuile « Sable » d'un ancien lien : le menu choisit le sable lagunaire
    await page.goto(`http://localhost:${app.port}/orders/new?type=MATERIAL&matiere=Sable`);
    const picker = page.getByRole('combobox', { name: 'Matériau commandé' });
    await expect(picker).toHaveValue('Sable lagunaire');
    const hint = page.getByRole('note');
    await expect(hint).toContainText('Camion 10 roues : 85 000 FCFA le voyage');
    await expect(hint).toContainText('du 26 oct. au 1 nov.');

    await page.locator('select[name="truck_type"]').selectOption('simple_benne');
    await expect(hint).toContainText('Camion 6 roues : 45 000 FCFA le voyage');

    await picker.selectOption({ label: 'Autre (préciser)' });
    await expect(hint).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Préciser le matériau' }).fill('Briques pleines');
    await expect(page.getByRole('textbox', { name: 'Préciser le matériau' })).toHaveValue('Briques pleines');
  });

  test('admin : publier le prix d\'un voyage pour une semaine', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'scénario ordinateur');
    const app = APPS.admin;
    await seedSession(page, app);
    await page.addInitScript(() => window.localStorage.setItem('bennego-langue', 'fr'));
    const calls = [];
    await mockApi(page, calls);
    await page.goto(`http://localhost:${app.port}/barometer`);
    await expect(page.getByRole('heading', { name: 'Prix du marché', level: 2 })).toBeVisible();
    await page.getByLabel('Matériau').selectOption({ label: 'Gravier 15/25' });
    await page.getByLabel('Prix le plus bas (FCFA le voyage)').fill('110000');
    await page.getByLabel('Prix courant (FCFA le voyage)').fill('120000');
    await page.getByLabel('Prix le plus haut (FCFA le voyage)').fill('130000');
    await expect(page.getByText('Les clients verront : Gravier 15/25, camion 10 roues')).toBeVisible();
    await page.getByRole('button', { name: 'Publier le prix' }).click();
    await expect.poll(() => calls.find((c) => c.method === 'POST')?.body && JSON.parse(calls.find((c) => c.method === 'POST').body))
      .toMatchObject({ material_key: 'gravier_15_25', truck_size: '10_roues', price_min: 110000, price_avg: 120000, price_max: 130000 });
  });
});
