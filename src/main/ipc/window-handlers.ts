// IPC handlers for window controls (minimize, maximize, close, isMaximized)

import type { BrowserWindow, IpcMain } from 'electron'

export function registerWindowHandlers(ipc: IpcMain, getWindow: () => BrowserWindow | null): void {
  ipc.handle('window:minimize', () => {
    getWindow()?.minimize()
  })

  ipc.handle('window:maximize', () => {
    const win = getWindow()
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipc.handle('window:close', () => {
    getWindow()?.close()
  })

  ipc.handle('window:isMaximized', () => {
    return getWindow()?.isMaximized() ?? false
  })
}
