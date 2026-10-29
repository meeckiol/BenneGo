/*
 * Service worker de la console : seulement les notifications push (aucune mise en cache).
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

importScripts('/push-sw.js');
