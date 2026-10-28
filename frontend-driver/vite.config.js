import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service worker aussi en développement : sans lui, Chrome Android n'installe pas l'app depuis le tunnel HTTPS
      devOptions: { enabled: true },
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-launch-512.png'],
      manifest: {
        name: 'BenneGo Driver',
        short_name: 'BenneGo',
        description: 'Application chauffeur - Livraison de matériaux & BTP au Bénin',
        theme_color: '#D9A55B',
        // Même fond que le splash animé : l'écran de lancement Android enchaîne sans flash
        background_color: '#0b0b10',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // Écran de lancement Android : image transparente (icon-launch-512), il ne reste que le fond sombre,
        // puis le splash animé. Icône de l'écran d'accueil : logo sur fond blanc (« maskable »).
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-launch-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
      },
      workbox: {
        // Mise en cache pour fonctionnement offline partiel
        globPatterns: ['**/*.{js,css,html,svg}'],
        // Notifications push des messages (public/push-sw.js)
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    allowedHosts: true,
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
