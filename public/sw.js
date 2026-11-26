// Recebe os lembretes do Baluarte (prospects em Aquecendo), mesmo com o app fechado.
// Não guarda páginas em cache: o Baluarte continua sempre na versão mais nova.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let aviso = { titulo: 'Baluarte', corpo: 'Tem prospect esperando atenção.', url: '' };
  try { aviso = { ...aviso, ...e.data.json() }; } catch (_) { /* usa o texto padrão */ }
  e.waitUntil(self.registration.showNotification(aviso.titulo, {
    body: aviso.corpo,
    icon: 'icons/icone-192.png',
    badge: 'icons/icone-192.png',
    tag: 'aquecendo',
    data: { url: aviso.url || `${self.registration.scope}#/comercial` },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abertas) => {
    const janela = abertas.find((c) => c.url.startsWith(self.registration.scope) && 'focus' in c);
    if (janela) return janela.focus().then((j) => (j && 'navigate' in j ? j.navigate(url) : j));
    return self.clients.openWindow(url);
  }));
});
