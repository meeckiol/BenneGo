/*
 * Notifications push de la console (litiges, pannes, versements, messages) : affichées quand l'application n'est pas au premier plan.
 * Le serveur applique les réglages : `silent` pendant les heures calmes ou son coupé, `vibrate` selon le choix.
 * Un appui ouvre la discussion, dans la fenêtre déjà ouverte si elle existe.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Application ouverte et visible : le bandeau intégré suffit
    if (wins.some((w) => w.visibilityState === 'visible')) return;
    await self.registration.showNotification(data.title || 'BenneGo', {
      body: data.body || 'Nouvelle alerte',
      tag: data.tag,
      renotify: !data.silent,
      silent: !!data.silent,
      vibrate: data.vibrate ? [200, 100, 200] : undefined,
      icon: '/logo-icon.png',
      badge: '/logo-icon.png',
      data: { url: data.url || '/' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins[0];
    if (win) {
      await win.focus();
      win.postMessage({ type: 'open', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
