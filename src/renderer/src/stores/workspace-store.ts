/**
 * Zustand store for workspace (project) management.
 *
 * Handles project CRUD, switching, and export from the renderer side.
 */

import { create } from 'zustand'
import type { Workspace, WorkspaceType } from '@shared/types/workspace'

interface WorkspaceState {
  // State
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  loading: boolean
  error: string | null

  // Actions
  loadWorkspaces: () => Promise<void>
  loadCurrentWorkspace: () => Promise<void>
  createWorkspace: (
    name: string,
    description?: string,
    type?: WorkspaceType,
    scope?: { inScope: string[]; outOfScope: string[] }
  ) => Promise<Workspace>
  switchWorkspace: (workspaceId: string) => Promise<Workspace>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  updateWorkspace: (
    workspaceId: string,
    updates: {
      name?: string
      description?: string
      type?: WorkspaceType
      scope?: { inScope: string[]; outOfScope: string[] }
    }
  ) => Promise<Workspace>
  exportWorkspace: (workspaceId: string) => Promise<string>
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspace: null,
  loading: false,
  error: null,

  loadWorkspaces: async () => {
    set({ loading: true, error: null })
    try {
      const workspaces = (await window.api.invoke('workspace:list')) as Workspace[]
      set({ workspaces, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  loadCurrentWorkspace: async () => {
    try {
      const workspace = (await window.api.invoke('workspace:current')) as Workspace | null
      set({ activeWorkspace: workspace })
    } catch (err) {
      console.error('Failed to load current workspace:', err)
    }
  },

  createWorkspace: async (name, description, type, scope) => {
    const workspace = (await window.api.invoke('workspace:create', {
      name,
      description,
      type,
      scope
    })) as Workspace
    // Refresh the list
    const workspaces = (await window.api.invoke('workspace:list')) as Workspace[]
    set({ workspaces })
    return workspace
  },

  switchWorkspace: async (workspaceId) => {
    set({ loading: true, error: null })
    try {
      const workspace = (await window.api.invoke('workspace:load', {
        workspaceId
      })) as Workspace
      set({ activeWorkspace: workspace, loading: false })
      return workspace
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
      throw err
    }
  },

  deleteWorkspace: async (workspaceId) => {
    await window.api.invoke('workspace:delete', { workspaceId })
    // Refresh the list
    const workspaces = (await window.api.invoke('workspace:list')) as Workspace[]
    set({ workspaces })
  },

  updateWorkspace: async (workspaceId, updates) => {
    const workspace = (await window.api.invoke('workspace:update', {
      workspaceId,
      updates
    })) as Workspace
    // Update in local list
    const workspaces = get().workspaces.map((w) => (w.id === workspaceId ? workspace : w))
    const activeWorkspace =
      get().activeWorkspace?.id === workspaceId ? workspace : get().activeWorkspace
    set({ workspaces, activeWorkspace })
    return workspace
  },

  exportWorkspace: async (workspaceId) => {
    return (await window.api.invoke('workspace:export', {
      workspaceId,
      format: 'zip'
    })) as string
  }
}))

// Selectors
export const selectActiveWorkspace = (state: WorkspaceState): Workspace | null =>
  state.activeWorkspace
export const selectWorkspaces = (state: WorkspaceState): Workspace[] => state.workspaces
export const selectWorkspaceCount = (state: WorkspaceState): number => state.workspaces.length
