// Zustand store for toast notifications

import { create } from 'zustand'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number // ms, 0 = persistent
  dismissible?: boolean
  createdAt: number
}

interface NotificationState {
  notifications: Notification[]
}

interface NotificationActions {
  addNotification: (n: Omit<Notification, 'id' | 'createdAt'>) => string
  removeNotification: (id: string) => void
  clearAll: () => void
  // Convenience methods
  info: (title: string, message?: string) => string
  success: (title: string, message?: string) => string
  warn: (title: string, message?: string) => string
  error: (title: string, message?: string) => string
}

let nextId = 0
function generateId(): string {
  return `notif-${Date.now()}-${nextId++}`
}

const DEFAULT_DURATION = 5000 // 5s per PRD

export const useNotificationStore = create<NotificationState & NotificationActions>(
  (set, get) => ({
    notifications: [],

    addNotification: (n) => {
      const id = generateId()
      const notification: Notification = {
        ...n,
        id,
        createdAt: Date.now(),
        duration: n.duration ?? DEFAULT_DURATION,
        dismissible: n.dismissible ?? true
      }
      set((s) => ({ notifications: [...s.notifications, notification] }))

      // Auto-dismiss after duration (unless persistent)
      if (notification.duration && notification.duration > 0) {
        setTimeout(() => {
          get().removeNotification(id)
        }, notification.duration)
      }

      return id
    },

    removeNotification: (id) => {
      set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }))
    },

    clearAll: () => {
      set({ notifications: [] })
    },

    info: (title, message) => get().addNotification({ type: 'info', title, message }),
    success: (title, message) => get().addNotification({ type: 'success', title, message }),
    warn: (title, message) => get().addNotification({ type: 'warning', title, message }),
    error: (title, message) => get().addNotification({ type: 'error', title, message })
  })
)

// Desktop notification helper — uses Electron Notification API via main process
export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  try {
    await window.api.invoke('notification:desktop', { title, body })
  } catch {
    // Silently fail — desktop notifications are optional
  }
}
