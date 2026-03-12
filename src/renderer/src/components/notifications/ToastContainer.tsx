import { useNotificationStore } from '../../stores/notification-store'
import { Toast } from './Toast'

export function ToastContainer(): React.JSX.Element | null {
  const notifications = useNotificationStore((s) => s.notifications)
  const removeNotification = useNotificationStore((s) => s.removeNotification)

  if (notifications.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[70] flex flex-col-reverse gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {notifications.slice(-5).map((n) => (
        <Toast key={n.id} notification={n} onDismiss={removeNotification} />
      ))}
    </div>
  )
}
