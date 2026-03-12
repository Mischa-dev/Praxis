/**
 * Scan IPC handlers — handles scan:list, scan:get, and scan:results.
 */

import type { IpcMain } from 'electron'
import { getDatabase } from '../workspace-manager'
import { getScanParsedResults } from '../scan-result-store'
import type { ScanListRequest, ScanGetRequest, ScanResultsRequest } from '@shared/types/ipc'
import type { Scan } from '@shared/types/scan'
import type { ParsedResults } from '@shared/types/results'

export function registerScanHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('scan:list', async (_, req: ScanListRequest): Promise<Scan[]> => {
    return getDatabase().listScans({
      targetId: req.targetId,
      status: req.status,
      toolId: req.toolId,
      limit: req.limit,
      offset: req.offset
    })
  })

  ipcMain.handle('scan:get', async (_, req: ScanGetRequest): Promise<Scan> => {
    const scan = getDatabase().getScan(req.scanId)
    if (!scan) throw new Error(`Scan not found: ${req.scanId}`)
    return scan
  })

  ipcMain.handle('scan:results', async (_, req: ScanResultsRequest): Promise<ParsedResults> => {
    const results = await getScanParsedResults(req.scanId)
    if (!results) {
      return {
        entities: {
          hosts: [],
          services: [],
          vulnerabilities: [],
          credentials: [],
          webPaths: [],
          findings: []
        },
        raw: '',
        summary: 'No results available'
      }
    }
    return results
  })
}
