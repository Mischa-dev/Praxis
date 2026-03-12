/**
 * IPC handlers for workspace (project) CRUD operations.
 */

import type { IpcMain } from 'electron'
import {
  createWorkspace,
  loadWorkspace,
  listWorkspaces,
  deleteWorkspace,
  updateWorkspace,
  exportWorkspace,
  getCurrentWorkspace
} from '../workspace-manager'
import type {
  WorkspaceCreateRequest,
  WorkspaceLoadRequest,
  WorkspaceDeleteRequest,
  WorkspaceUpdateRequest,
  WorkspaceExportRequest
} from '@shared/types/ipc'
import type { WorkspaceType, WorkspaceScope } from '@shared/types/workspace'

export function registerWorkspaceHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('workspace:create', (_event, data: WorkspaceCreateRequest) => {
    return createWorkspace(
      data.name,
      data.description,
      (data.type as WorkspaceType) ?? 'custom',
      data.scope as WorkspaceScope | undefined
    )
  })

  ipcMain.handle('workspace:load', (_event, data: WorkspaceLoadRequest) => {
    return loadWorkspace(data.workspaceId)
  })

  ipcMain.handle('workspace:list', () => {
    return listWorkspaces()
  })

  ipcMain.handle('workspace:delete', (_event, data: WorkspaceDeleteRequest) => {
    deleteWorkspace(data.workspaceId)
  })

  ipcMain.handle('workspace:update', (_event, data: WorkspaceUpdateRequest) => {
    return updateWorkspace(data.workspaceId, {
      name: data.updates.name,
      description: data.updates.description,
      type: data.updates.type as WorkspaceType | undefined,
      scope: data.updates.scope as WorkspaceScope | undefined
    })
  })

  ipcMain.handle('workspace:export', async (_event, data: WorkspaceExportRequest) => {
    return exportWorkspace(data.workspaceId)
  })

  ipcMain.handle('workspace:current', () => {
    return getCurrentWorkspace()
  })
}
