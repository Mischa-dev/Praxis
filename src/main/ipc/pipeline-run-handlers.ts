import type { IpcMain } from 'electron'
import { executePipeline, cancelPipeline, getPipelineRunStatus, resolvePrompt } from '../pipeline-engine'
import type {
  PipelineExecuteRequest,
  PipelineCancelRunRequest,
  PipelineRunStatusRequest,
  PipelinePromptResponse
} from '@shared/types/ipc'

export function registerPipelineRunHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('pipeline:execute', async (_e, data: PipelineExecuteRequest) => {
    return executePipeline(data.pipelineId, data.targetId)
  })

  ipcMain.handle('pipeline:cancel-run', (_e, data: PipelineCancelRunRequest) => {
    cancelPipeline(data.runId)
  })

  ipcMain.handle('pipeline:run-status', (_e, data: PipelineRunStatusRequest) => {
    return getPipelineRunStatus(data.runId)
  })

  ipcMain.handle('pipeline:prompt-response', (_e, data: PipelinePromptResponse) => {
    resolvePrompt(data.runId, data.nodeId, data.value)
  })
}
