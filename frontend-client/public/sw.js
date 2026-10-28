/*
 * Service worker minimal : il rend BenneGo installable sur Android (écran d'accueil, sans barre du navigateur).
 * Aucune mise en cache : chaque requête part directement vers le réseau, l'application reste toujours à jour.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => event.respondWith(fetch(event.request)));
