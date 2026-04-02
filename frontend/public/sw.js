self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
  const title = data.title || '¡Nueva cita!'
  const options = {
    body: data.body || 'Tienes una nueva reserva',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    requireInteraction: true,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})