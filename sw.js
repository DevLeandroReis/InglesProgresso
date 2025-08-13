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
    icon: data.icon || './icons/favicon.svg',
    badge: data.badge || './icons/favicon.svg',
    image: data.image || './icons/notif-banner.png',
    vibrate: data.vibrate || [100,30,100],
    actions: data.actions || [
      { action: 'abrir', title: 'Abrir app' },
      { action: 'feito', title: 'Marcar feito' }
    ],
    data: data.data || { url: '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || { url: '/' };
  const action = event.action;
  event.notification.close();
  // Lida com ação de marcar feito
  if(action === 'feito' && data && data.type === 'activity' && data.key){
    event.waitUntil((async()=>{
      const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if(clientsArr.length){
        clientsArr[0].postMessage({ type: 'mark-today', key: data.key, date: data.date });
        clientsArr[0].focus && clientsArr[0].focus();
      } else if (self.clients.openWindow){
        await self.clients.openWindow(data.url || '/');
      }
    })());
    return;
  }
  // Ação padrão: abrir/focar app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const targetUrl = (data && data.url) ? data.url : '/';
      const hadWindow = clientsArr.some((client) => {
        if (client.url.includes(targetUrl) && 'focus' in client) { client.focus(); return true; }
        return false;
      });
      if (!hadWindow && self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
