// IPC handlers for scope checking

import type { IpcMain } from 'electron'
import { checkScope } from '@main/scope-checker'
import type { ScopeCheckRequest } from '@shared/types/ipc'

export function registerScopeHandlers(ipc: IpcMain): void {
  ipc.handle('scope:check', async (_event, data: ScopeCheckRequest) => {
    return checkScope(data.target)
  })

  ipc.handle('scope:set', () => {
    // Workspace scope enforcement is a future feature (Task 8.1: Project CRUD)
    // For now this is a no-op — scope ranges will be stored on the workspace
  })
}
