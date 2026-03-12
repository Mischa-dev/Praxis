import { useState, useEffect } from 'react'
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import type { Notification, NotificationType } from '../../stores/notification-store'

const iconMap: Record<NotificationType, React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle
}

const colorMap: Record<NotificationType, { icon: string; border: string; bg: string }> = {
  info: {
    icon: 'text-accent-secondary',
    border: 'border-accent-secondary/30',
    bg: 'bg-accent-secondary/5'
  },
  success: {
    icon: 'text-success',
    border: 'border-success/30',
    bg: 'bg-success/5'
  },
  warning: {
    icon: 'text-warning',
    border: 'border-warning/30',
    bg: 'bg-warning/5'
  },
  error: {
    icon: 'text-error',
    border: 'border-error/30',
    bg: 'bg-error/5'
  }
}

interface ToastProps {
  notification: Notification
  onDismiss: (id: string) => void
}

export function Toast({ notification, onDismiss }: ToastProps): React.JSX.Element {
  const [exiting, setExiting] = useState(false)
  const Icon = iconMap[notification.type]
  const colors = colorMap[notification.type]

  // When duration is approaching, start exit animation
  useEffect(() => {
    if (!notification.duration || notification.duration <= 0) return
    const remaining = notification.duration - (Date.now() - notification.createdAt)
    if (remaining <= 200) return // Already past duration

    const timer = setTimeout(() => {
      setExiting(true)
    }, Math.max(0, remaining - 200))
    return () => clearTimeout(timer)
  }, [notification.duration, notification.createdAt])

  const handleDismiss = (): void => {
    setExiting(true)
    setTimeout(() => onDismiss(notification.id), 200)
  }

  return (
    <div
      className={`
        ${exiting ? 'toast-exit' : 'toast-enter'}
        ${colors.border} ${colors.bg}
        border rounded-lg p-3 pr-8
        bg-bg-elevated backdrop-blur-sm
        shadow-lg shadow-black/40
        max-w-sm w-80
        relative
        pointer-events-auto
      `}
      role="alert"
    >
      <div className="flex gap-2.5">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${colors.icon}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary leading-tight">
            {notification.title}
          </p>
          {notification.message && (
            <p className="text-xs text-text-secondary mt-0.5 leading-snug">
              {notification.message}
            </p>
          )}
        </div>
      </div>
      {notification.dismissible !== false && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded text-text-muted hover:text-text-secondary transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
