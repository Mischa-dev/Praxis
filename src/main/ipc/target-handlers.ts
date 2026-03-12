// IPC handlers for target CRUD operations

import type { IpcMain } from 'electron'
import { getDatabase } from '@main/workspace-manager'
import type {
  TargetAddRequest,
  TargetRemoveRequest,
  TargetUpdateRequest,
  TargetGetRequest
} from '@shared/types/ipc'

export function registerTargetHandlers(ipc: IpcMain): void {
  ipc.handle('target:add', (_event, data: TargetAddRequest) => {
    const db = getDatabase()
    return db.addTarget(data.type, data.value, data.label)
  })

  ipc.handle('target:list', () => {
    const db = getDatabase()
    return db.listTargets()
  })

  ipc.handle('target:get', (_event, data: TargetGetRequest) => {
    const db = getDatabase()
    const detail = db.getTargetDetail(data.targetId)
    if (!detail) {
      throw new Error(`Target not found: ${data.targetId}`)
    }
    return detail
  })

  ipc.handle('target:update', (_event, data: TargetUpdateRequest) => {
    const db = getDatabase()
    const target = db.updateTarget(data.targetId, data.updates)
    if (!target) {
      throw new Error(`Target not found: ${data.targetId}`)
    }
    return target
  })

  ipc.handle('target:remove', (_event, data: TargetRemoveRequest) => {
    const db = getDatabase()
    db.removeTarget(data.targetId)
  })
}
