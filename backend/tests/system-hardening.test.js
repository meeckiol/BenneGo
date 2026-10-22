const request = require('supertest');
const { app } = require('../src/server');

describe('Système & Robustesse API BenneGo', () => {
  test('GET /health retourne un diagnostic complet et statut ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('BenneGo API');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.database).toBeDefined();
    expect(res.body.database.connected).toBe(true);
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(res.body.memory).toBeDefined();
  });

  test('Route inconnue renvoie une 404 standardisée JSON', async () => {
    const res = await request(app).get('/api/route-inexistante-pour-test-404');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route non trouvée');
  });

  test('Vérification des en-têtes de sécurité Helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-download-options']).toBeDefined();
  });
});
