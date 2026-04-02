export function usePushNotifications() {
  const requestPermission = async () => {
    if (!('Notification' in window)) return false
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  const showLocalNotification = (title, body) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        requireInteraction: true,
      })
    }
  }

  return { requestPermission, showLocalNotification }
}