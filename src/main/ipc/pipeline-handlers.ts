import type { IpcMain } from 'electron'
import { getDatabase } from '../workspace-manager'

export function registerPipelineHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('pipeline:add', (_e, data: { name: string; description?: string; definition: string }) => {
    return getDatabase().addPipeline({
      name: data.name,
      description: data.description,
      definition: data.definition,
    })
  })

  ipcMain.handle('pipeline:get', (_e, data: { pipelineId: number }) => {
    const pipeline = getDatabase().getPipeline(data.pipelineId)
    if (!pipeline) throw new Error(`Pipeline not found: ${data.pipelineId}`)
    return pipeline
  })

  ipcMain.handle('pipeline:list', () => {
    return getDatabase().listPipelines()
  })

  ipcMain.handle('pipeline:update', (_e, data: { pipelineId: number; updates: Record<string, unknown> }) => {
    const pipeline = getDatabase().updatePipeline(data.pipelineId, data.updates)
    if (!pipeline) throw new Error(`Pipeline not found: ${data.pipelineId}`)
    return pipeline
  })

  ipcMain.handle('pipeline:remove', (_e, data: { pipelineId: number }) => {
    getDatabase().removePipeline(data.pipelineId)
  })
}
