// Recebe as notificações do Axé Plantas (carregado pelo service worker do app).
self.addEventListener('push', (evento) => {
  let dados = {}
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = { corpo: evento.data ? evento.data.text() : '' }
  }
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || 'Axé Plantas', {
      body: dados.corpo || '',
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      data: { url: dados.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const alvo = new URL(evento.notification.data?.url || './', self.registration.scope).href
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.navigate?.(alvo)
          return janela.focus()
        }
      }
      return self.clients.openWindow(alvo)
    }),
  )
})
