// IPC handlers for module loading and management

import type { IpcMain } from 'electron'
import { loadModules, getModule, checkModuleInstall, reloadModules } from '@main/module-loader'

export function registerModuleHandlers(ipc: IpcMain): void {
  ipc.handle('module:list', async () => {
    return loadModules()
  })

  ipc.handle('module:get', async (_event, data: { moduleId: string }) => {
    const mod = await getModule(data.moduleId)
    if (!mod) {
      throw new Error(`Module not found: ${data.moduleId}`)
    }
    return mod
  })

  ipc.handle('module:check-install', async (_event, data: { moduleId: string }) => {
    return checkModuleInstall(data.moduleId)
  })

  ipc.handle('module:reload', async () => {
    return reloadModules()
  })
}
