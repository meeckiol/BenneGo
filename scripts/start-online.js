#!/usr/bin/env node
/**
 * BenneGo — Lanceur d'accès en ligne (Cloudflare Tunnels)
 * Expose automatiquement le Backend, Client, Driver et Admin sur Internet avec HTTPS valide.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CLOUDFLARED = '/tmp/cloudflared';

// 1. Récupérer l'adresse IP locale Wi-Fi
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

console.clear();
console.log('='.repeat(72));
console.log('       [BENNEGO] — DEPLOIEMENT TEST LOCALHOST SUR INTERNET');
console.log('='.repeat(72));
console.log('\n[INFO] Demarrage des serveurs BenneGo et generation des tunnels HTTPS...\n');

// 2. Vérifier que cloudflared est prêt
if (!fs.existsSync(CLOUDFLARED)) {
  console.log('Téléchargement du binaire Cloudflare Tunnel...');
  const { execSync } = require('child_process');
  execSync('curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared && chmod +x /tmp/cloudflared');
}

// 3. Fonction pour ouvrir un tunnel Cloudflare et récupérer l'URL publique
function startTunnel(name, port) {
  return new Promise((resolve) => {
    const proc = spawn(CLOUDFLARED, ['tunnel', '--url', `http://localhost:${port}`]);
    let resolved = false;

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        resolve({ name, port, url: match[0], proc });
      }
    });

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        resolve({ name, port, url: match[0], proc });
      }
    });

    setTimeout(() => {
      if (!resolved) resolve({ name, port, url: `http://${localIP}:${port}`, proc });
    }, 15000);
  });
}

async function main() {
  // 4. Lancer les serveurs dev BenneGo (Backend + Client + Driver + Admin)
  const devProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore',
  });

  // Laisser 4 secondes aux serveurs pour démarrer
  await new Promise((r) => setTimeout(r, 4000));

  console.log('[INFO] Ouverture des tunnels publics chiffres SSL...\n');

  const tunnels = await Promise.all([
    startTunnel('Client Web (Clients & Chantiers)', 5173),
    startTunnel('Chauffeur Web (Conducteurs)', 5174),
    startTunnel('Console Admin (Direction & Flotte)', 5175),
    startTunnel('Backend API & Webhooks KKiaPay', 3000),
  ]);

  console.clear();
  console.log('='.repeat(72));
  console.log('       [OK] APPLICATION BENNEGO ACCESSIBLE EN LIGNE SUR INTERNET');
  console.log('='.repeat(72));
  console.log('\nAccedez a ces URLs securisees depuis n\'importe quel terminal mobile (4G/Wi-Fi) :\n');

  tunnels.forEach((t) => {
    console.log(`[ACCES] ${t.name} :`);
    console.log(`   * Public HTTPS : \x1b[32m\x1b[1m${t.url}\x1b[0m`);
    console.log(`   * Wi-Fi Local  : http://${localIP}:${t.port}\n`);
  });

  console.log('-'.repeat(72));
  console.log('NOTE DE DEPLOIEMENT :');
  console.log('   * Test smartphone : ouvrez le lien Client ou Chauffeur dans Chrome ou Safari.');
  console.log('   * La geolocalisation GPS et le WebSocket temps reel sont actifs via HTTPS.');
  console.log('   * Webhooks KKiaPay : utilisez l\'URL Backend API ci-dessus.');
  console.log('-'.repeat(72));
  console.log('\nAppuyez sur Ctrl + C pour arrêter le partage en ligne.\n');

  process.on('SIGINT', () => {
    console.log('\nFermeture des tunnels et arrêt des serveurs...');
    tunnels.forEach((t) => t.proc.kill());
    devProcess.kill();
    process.exit(0);
  });
}

main().catch(console.error);
