import type { IpcMain } from 'electron'
import { getDatabase } from '../workspace-manager'
import type { HistoryListRequest } from '@shared/types/ipc'
import type { CommandHistoryEntry } from '@shared/types/scan'

export function registerHistoryHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('history:list', async (_, req: HistoryListRequest): Promise<CommandHistoryEntry[]> => {
    return getDatabase().listCommandHistory({
      toolId: req.toolId,
      targetId: req.targetId,
      exitCode: req.exitCode,
      fromDate: req.fromDate,
      toDate: req.toDate,
      search: req.search,
      limit: req.limit,
      offset: req.offset
    })
  })
}
