self.addEventListener('install', (evt) => {
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  self.clients.claim();
});

// Exibe notificações push quando recebidas do servidor
self.addEventListener('push', (event) => {
  let data = {};
  try{ data = event.data ? event.data.json() : {}; }catch{}
  const title = data.title || 'Inglês Progresso';
  const options = {
    body: data.body || 'Hora do estudo! ✨',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const hadWindow = clientsArr.some((client) => {
        if (client.url.includes(url) && 'focus' in client) { client.focus(); return true; }
        return false;
      });
      if (!hadWindow && self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
