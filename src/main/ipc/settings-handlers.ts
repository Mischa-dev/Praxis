// IPC handlers for application settings

import type { IpcMain } from 'electron'
import { getSettings, setSettings } from '../settings-manager'
import type { SettingsSetRequest } from '@shared/types/ipc'

export function registerSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:set', (_event, data: SettingsSetRequest) => {
    return setSettings(data.settings)
  })
}
