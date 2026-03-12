import { useEffect, useCallback } from 'react'
import { useActionStore, selectActions, selectActionsByCategory } from '../stores/action-store'
import type { EvaluatedAction } from '@shared/types'

/**
 * Hook that loads and manages actions for a target.
 * Subscribes to tool:status events to auto-refresh when scans complete.
 */
export function useTargetActions(targetId: number) {
  const actions = useActionStore(selectActions)
  const actionsByCategory = useActionStore(selectActionsByCategory)
  const loading = useActionStore((s) => s.loading)
  const error = useActionStore((s) => s.error)
  const loadActions = useActionStore((s) => s.loadActions)
  const clearActions = useActionStore((s) => s.clearActions)

  // Load actions on mount / targetId change
  useEffect(() => {
    if (targetId > 0) {
      loadActions(targetId)
    }
    return () => clearActions()
  }, [targetId, loadActions, clearActions])

  // Auto-refresh when a scan completes for this target
  useEffect(() => {
    const cleanup = window.api.on('tool:status', (event: unknown) => {
      const e = event as { scanId: number; status: string }
      if (e.status === 'completed' || e.status === 'failed') {
        // Refresh actions — new scan data may unlock new actions
        loadActions(targetId)
      }
    })
    return cleanup
  }, [targetId, loadActions])

  const refresh = useCallback(() => {
    loadActions(targetId)
  }, [targetId, loadActions])

  return {
    actions,
    actionsByCategory,
    loading,
    error,
    refresh,
  }
}

/** Group actions by category, preserving order */
export function groupActionsByCategory(
  actions: EvaluatedAction[],
): Map<string, EvaluatedAction[]> {
  const groups = new Map<string, EvaluatedAction[]>()
  for (const action of actions) {
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
