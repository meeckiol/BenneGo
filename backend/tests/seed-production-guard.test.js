const path = require('path');
const { spawnSync } = require('child_process');

const SEED_SCRIPT = path.join(__dirname, '../src/scripts/seed-demo-data.js');

describe('script de données de démo', () => {
  test('refuse de tourner en production (il réinitialiserait les mots de passe des comptes)', () => {
    const result = spawnSync(process.execPath, [SEED_SCRIPT], {
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8',
      timeout: 15000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/jamais.*production/i);
    expect(result.stdout).not.toMatch(/Démarrage de l'initialisation/);
  });
});
