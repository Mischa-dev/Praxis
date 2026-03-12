import { create } from 'zustand'
import type { Workflow, WorkflowRun } from '@shared/types/pipeline'

interface WorkflowState {
  workflows: Workflow[]
  loading: boolean
  error: string | null
  activeRun: WorkflowRun | null
  runs: Map<string, WorkflowRun>
}

interface WorkflowActions {
  loadWorkflows: () => Promise<void>
  getWorkflow: (id: string) => Promise<Workflow>
  executeWorkflow: (
    workflowId: string,
    targetId: number,
    options?: { disabledSteps?: string[]; argOverrides?: Record<string, Record<string, unknown>> }
  ) => Promise<string>
  cancelWorkflow: (runId: string) => Promise<void>
  updateRun: (run: WorkflowRun) => void
  setActiveRun: (runId: string | null) => void
  clearRuns: () => void
}

export const useWorkflowStore = create<WorkflowState & WorkflowActions>((set, get) => ({
  workflows: [],
  loading: false,
  error: null,
  activeRun: null,
  runs: new Map(),

  loadWorkflows: async () => {
    set({ loading: true, error: null })
    try {
      const workflows = await window.api.invoke('workflow:list', {})
      set({ workflows, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  getWorkflow: async (id: string) => {
    return window.api.invoke('workflow:get', { workflowId: id })
  },

  executeWorkflow: async (workflowId, targetId, options) => {
    const { runId } = await window.api.invoke('workflow:execute', {
      workflowId,
      targetId,
      options,
    })
    return runId
  },

  cancelWorkflow: async (runId: string) => {
    await window.api.invoke('workflow:cancel', { runId })
  },

  updateRun: (run: WorkflowRun) => {
    const runs = new Map(get().runs)
    runs.set(run.runId, run)
    const activeRun = get().activeRun
    set({
      runs,
      activeRun: activeRun?.runId === run.runId ? run : activeRun,
    })
  },

  setActiveRun: (runId: string | null) => {
    if (!runId) {
      set({ activeRun: null })
      return
    }
    const run = get().runs.get(runId) ?? null
    set({ activeRun: run })
  },

  clearRuns: () => {
    set({ runs: new Map(), activeRun: null })
  },
}))

// Selectors
export const selectWorkflows = (s: WorkflowState) => s.workflows
export const selectActiveRun = (s: WorkflowState) => s.activeRun
export const selectWorkflowCount = (s: WorkflowState) => s.workflows.length
