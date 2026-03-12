/**
 * Workflow IPC handlers — handles workflow:list, workflow:get,
 * workflow:execute, and workflow:cancel.
 */

import type { IpcMain } from 'electron'
import { loadWorkflows, getWorkflow, executeWorkflow, cancelWorkflow } from '../workflow-engine'
import type { WorkflowExecuteRequest, WorkflowCancelRequest } from '@shared/types/ipc'
import type { Workflow } from '@shared/types/pipeline'

export function registerWorkflowHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'workflow:list',
    async (): Promise<Workflow[]> => {
      return loadWorkflows()
    }
  )

  ipcMain.handle(
    'workflow:get',
    async (_, req: { workflowId: string }): Promise<Workflow> => {
      const workflow = getWorkflow(req.workflowId)
      if (!workflow) {
        throw new Error(`Workflow not found: ${req.workflowId}`)
      }
      return workflow
    }
  )

  ipcMain.handle(
    'workflow:execute',
    async (_, req: WorkflowExecuteRequest): Promise<{ runId: string }> => {
      return executeWorkflow(req.workflowId, req.targetId, req.options)
    }
  )

  ipcMain.handle(
    'workflow:cancel',
    async (_, req: WorkflowCancelRequest): Promise<void> => {
      cancelWorkflow(req.runId)
    }
  )
}
