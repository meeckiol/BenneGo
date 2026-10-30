const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { APPS } = require('./apps');

// Les trois frontends sont testés en build de production (ce que les utilisateurs reçoivent).
// Le backend n'est pas démarré : les appels /api sont interceptés dans chaque test.

const browser = process.env.PW_CHROMIUM
  ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } }
  : { channel: 'chrome' };

const previewServer = ({ dir, port }) => ({
  command: `npx vite preview --port ${port} --strictPort`,
  cwd: path.join(__dirname, '..', dir),
  url: `http://localhost:${port}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120000,
});

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.js/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    // Les applications suivent la langue du navigateur : les tests sont écrits pour le français
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Google Chrome déjà installé sur la machine : pas de téléchargement de navigateur nécessaire.
    // Sans Chrome (CI, conteneur) : PW_CHROMIUM=/chemin/vers/chromium utilise ce navigateur à la place.
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'], ...browser } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], ...browser } },
  ],
  webServer: Object.values(APPS).map(previewServer),
});
