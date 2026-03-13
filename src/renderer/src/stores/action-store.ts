import { create } from 'zustand'
import type { EvaluatedAction } from '@shared/types'

interface ActionState {
  /** Evaluated actions for the current target */
  actions: EvaluatedAction[]
  /** Target ID the actions are loaded for */
  targetId: number | null
  loading: boolean
  error: string | null
}

interface ActionActions {
  /** Load evaluated actions for a target */
  loadActions: (targetId: number) => Promise<void>
  /** Clear loaded actions */
  clearActions: () => void
}

export const useActionStore = create<ActionState & ActionActions>((set) => ({
  actions: [],
  targetId: null,
  loading: false,
  error: null,

  loadActions: async (targetId: number) => {
    try {
      set({ loading: true, error: null, targetId })
      const actions = (await window.api.invoke('entity:actions', { entityType: 'host', id: targetId })) as EvaluatedAction[]
      set({ actions, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load actions',
        loading: false,
      })
    }
  },

  clearActions: () => {
    set({ actions: [], targetId: null, error: null })
  },
}))

// ── Selectors ──

export const selectActions = (state: ActionState): EvaluatedAction[] => state.actions

export const selectActionsByCategory = (state: ActionState): Map<string, EvaluatedAction[]> => {
  const groups = new Map<string, EvaluatedAction[]>()
  for (const action of state.actions) {
    const cat = action.category ?? 'General'
    const list = groups.get(cat)
    if (list) {
      list.push(action)
    } else {
      groups.set(cat, [action])
    }
  }
  return groups
}

export const selectCriticalActions = (state: ActionState): EvaluatedAction[] =>
  state.actions.filter((a) => a.priority <= 20)

export const selectActionCount = (state: ActionState): number => state.actions.length
