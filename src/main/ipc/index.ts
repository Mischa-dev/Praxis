// IPC handler registration — central entry point for all main-process IPC handlers

import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { registerProfileHandlers } from './profile-handlers'
import { registerModuleHandlers } from './module-handlers'
import { registerWindowHandlers } from './window-handlers'
import { registerScopeHandlers } from './scope-handlers'
import { registerToolHandlers } from './tool-handlers'
import { registerScanHandlers } from './scan-handlers'
import { registerWorkflowHandlers } from './workflow-handlers'
import { registerPipelineHandlers } from './pipeline-handlers'
import { registerPipelineRunHandlers } from './pipeline-run-handlers'
import { registerWorkspaceHandlers } from './workspace-handlers'
import { registerHistoryHandlers } from './history-handlers'
import { registerSettingsHandlers } from './settings-handlers'
import { registerNotificationHandlers } from './notification-handlers'
import { registerReportHandlers } from './report-handlers'
import { registerEntityHandlers } from './entity-handlers'

/**
 * Register all IPC handlers.
 * Call this once during app startup, before creating the BrowserWindow.
 *
 * @param getWindow - A function that returns the current main BrowserWindow (or null).
 *   This is a getter rather than a direct reference because window handlers are
 *   registered before the window is created.
 */
export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  registerProfileHandlers(ipcMain)
  registerModuleHandlers(ipcMain)
  registerScopeHandlers(ipcMain)
  registerToolHandlers(ipcMain)
  registerScanHandlers(ipcMain)
  registerWorkflowHandlers(ipcMain)
  registerPipelineHandlers(ipcMain)
  registerPipelineRunHandlers(ipcMain)
  registerWorkspaceHandlers(ipcMain)
  registerHistoryHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerNotificationHandlers(ipcMain)
  registerReportHandlers(ipcMain)
  registerEntityHandlers(ipcMain)
  registerWindowHandlers(ipcMain, getWindow)
}
