// IPC handlers for profile and glossary data

import type { IpcMain } from 'electron'
import { getManifest, loadGlossary } from '@main/profile-loader'

export function registerProfileHandlers(ipc: IpcMain): void {
  ipc.handle('profile:get', () => {
    return getManifest()
  })

  ipc.handle('glossary:list', () => {
    return loadGlossary()
  })
}
