import { create } from 'zustand'
import type { Pipeline, PipelineDefinition, PipelineRun } from '@shared/types/pipeline'

interface PipelineState {
  pipelines: Pipeline[]
  activePipeline: Pipeline | null
  loading: boolean
  error: string | null
  dirty: boolean // unsaved changes
  activeRun: PipelineRun | null
}

interface PipelineActions {
  loadPipelines: () => Promise<void>
  loadPipeline: (id: number) => Promise<void>
  savePipeline: (name: string, description: string, definition: PipelineDefinition) => Promise<Pipeline>
  updatePipeline: (id: number, updates: { name?: string; description?: string; definition?: string }) => Promise<void>
  removePipeline: (id: number) => Promise<void>
  setActivePipeline: (pipeline: Pipeline | null) => void
  setDirty: (dirty: boolean) => void
  executePipelineRun: (pipelineId: number, targetId?: number) => Promise<string>
  cancelRun: (runId: string) => Promise<void>
  clearRun: () => void
}

let unsubscribeNodeStatus: (() => void) | null = null

export const usePipelineStore = create<PipelineState & PipelineActions>((set, get) => ({
  pipelines: [],
  activePipeline: null,
  loading: false,
  error: null,
  dirty: false,
  activeRun: null,

  loadPipelines: async () => {
    set({ loading: true, error: null })
    try {
      const pipelines = await window.api.invoke('pipeline:list', {})
      set({ pipelines: pipelines as Pipeline[], loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  loadPipeline: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const pipeline = await window.api.invoke('pipeline:get', { pipelineId: id })
      set({ activePipeline: pipeline as Pipeline, loading: false, dirty: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  savePipeline: async (name: string, description: string, definition: PipelineDefinition) => {
    const pipeline = await window.api.invoke('pipeline:add', {
      name,
      description,
      definition: JSON.stringify(definition),
    }) as Pipeline
    const { pipelines } = get()
    set({ pipelines: [...pipelines, pipeline], activePipeline: pipeline, dirty: false })
    return pipeline
  },

  updatePipeline: async (id: number, updates: { name?: string; description?: string; definition?: string }) => {
    const pipeline = await window.api.invoke('pipeline:update', { pipelineId: id, updates }) as Pipeline
    const { pipelines } = get()
    set({
      pipelines: pipelines.map((p) => (p.id === id ? pipeline : p)),
      activePipeline: get().activePipeline?.id === id ? pipeline : get().activePipeline,
      dirty: false,
    })
  },

  removePipeline: async (id: number) => {
    await window.api.invoke('pipeline:remove', { pipelineId: id })
    const { pipelines, activePipeline } = get()
    set({
      pipelines: pipelines.filter((p) => p.id !== id),
      activePipeline: activePipeline?.id === id ? null : activePipeline,
    })
  },

  setActivePipeline: (pipeline) => set({ activePipeline: pipeline, dirty: false }),
  setDirty: (dirty) => set({ dirty }),

  executePipelineRun: async (pipelineId: number, targetId?: number) => {
    // Subscribe to progress events
    if (unsubscribeNodeStatus) {
      unsubscribeNodeStatus()
    }
    unsubscribeNodeStatus = window.api.on('pipeline:node-status', (run: unknown) => {
      set({ activeRun: run as PipelineRun })
    })

    const result = await window.api.invoke('pipeline:execute', { pipelineId, targetId }) as { runId: string }
    return result.runId
  },

  cancelRun: async (runId: string) => {
    await window.api.invoke('pipeline:cancel-run', { runId })
  },

  clearRun: () => {
    if (unsubscribeNodeStatus) {
      unsubscribeNodeStatus()
      unsubscribeNodeStatus = null
    }
    set({ activeRun: null })
  },
}))

export const selectPipelineCount = (s: PipelineState): number => s.pipelines.length
