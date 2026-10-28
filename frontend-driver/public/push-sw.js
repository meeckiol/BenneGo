/*
 * Notifications push (messages) : affichées quand l'application n'est pas au premier plan.
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
      body: data.body || 'Nouveau message',
      tag: data.tag,
      renotify: true,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/messages' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/messages';
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
