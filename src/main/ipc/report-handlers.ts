/**
 * Report IPC handlers — generates and exports reports.
 */

import type { IpcMain } from 'electron'
import type {
  ReportGenerateRequest,
  ReportGenerateResponse,
  ReportExportRequest,
  ReportExportResponse,
  ReportTemplate
} from '@shared/types/ipc'
import { generateReport, exportReport, getReportTemplates } from '../report-engine'

export function registerReportHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'report:generate',
    async (_event, req: ReportGenerateRequest): Promise<ReportGenerateResponse> => {
      return generateReport(req)
    }
  )

  ipcMain.handle(
    'report:export',
    async (_event, req: ReportExportRequest): Promise<ReportExportResponse> => {
      return exportReport(req)
    }
  )

  ipcMain.handle('report:templates', async (): Promise<ReportTemplate[]> => {
    return getReportTemplates()
  })
}
