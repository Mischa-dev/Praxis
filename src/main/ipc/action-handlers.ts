/**
 * Action IPC handlers — evaluates action rules for a target.
 */

import type { IpcMain } from 'electron'
import { getDatabase } from '../workspace-manager'
import { getResolvedPaths } from '../profile-loader'
import { getActionsForTarget } from '../action-engine'
import type { TargetActionsRequest } from '@shared/types/ipc'
import type { EvaluatedAction } from '@shared/types/action'

export function registerActionHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'target:actions',
    async (_, req: TargetActionsRequest): Promise<EvaluatedAction[]> => {
      const db = getDatabase()
      const detail = db.getTargetDetail(req.targetId)
      if (!detail) {
        throw new Error(`Target not found: ${req.targetId}`)
      }

      const paths = getResolvedPaths()
      return getActionsForTarget(paths.actions, detail)
    }
  )
}
