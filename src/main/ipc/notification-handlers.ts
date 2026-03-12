// IPC handlers for desktop notifications

import type { IpcMain } from 'electron'
import { Notification } from 'electron'

export function registerNotificationHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'notification:desktop',
    async (_event, data: { title: string; body: string }) => {
      if (!Notification.isSupported()) return
      const notif = new Notification({
        title: data.title,
        body: data.body,
        silent: false
      })
      notif.show()
    }
  )
}
