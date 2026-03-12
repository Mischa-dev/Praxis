/**
 * Database IPC handlers — handles db:stats and db:search.
 */

import type { IpcMain } from 'electron'
import { getDatabase } from '../workspace-manager'
import type { DbStatsResponse, DbSearchRequest, SearchResults } from '@shared/types/ipc'

export function registerDbHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('db:stats', async (): Promise<DbStatsResponse> => {
    return getDatabase().stats()
  })

  ipcMain.handle(
    'db:search',
    async (_event, data: DbSearchRequest): Promise<SearchResults> => {
      if (!data.query || data.query.trim().length === 0) {
        return {
          targets: [],
          services: [],
          vulnerabilities: [],
          credentials: [],
          findings: [],
          scans: [],
          notes: [],
          webPaths: []
        }
      }
      return getDatabase().search(data.query.trim())
    }
  )
}
