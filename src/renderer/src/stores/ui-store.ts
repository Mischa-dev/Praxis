import { create } from 'zustand'
import type { ViewId, ViewHistoryEntry } from '@shared/types'

interface UiState {
  activeView: ViewId
  viewParams: Record<string, unknown>
  viewHistory: ViewHistoryEntry[]
  historyIndex: number
  sidebarSection: string
  sidebarCollapsed: boolean
  contextPanelOpen: boolean
  sidebarWidth: number
  contextPanelWidth: number
}

interface UiActions {
  navigate: (view: ViewId, params?: Record<string, unknown>) => void
  goBack: () => void
  goForward: () => void
  setSidebarSection: (section: string) => void
  toggleSidebar: () => void
  toggleContextPanel: () => void
  setContextPanelOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  setContextPanelWidth: (width: number) => void
}

export const useUiStore = create<UiState & UiActions>((set, get) => ({
  activeView: 'home',
  viewParams: {},
  viewHistory: [{ view: 'home', params: {} }],
  historyIndex: 0,
  sidebarSection: 'navigation',
  sidebarCollapsed: false,
  contextPanelOpen: true,
  sidebarWidth: 224,
  contextPanelWidth: 288,

  navigate: (view, params = {}) => {
    const { viewHistory, historyIndex } = get()
    // Truncate forward history when navigating from a non-latest position
    const truncated = viewHistory.slice(0, historyIndex + 1)
    const entry: ViewHistoryEntry = { view, params }
    set({
      activeView: view,
      viewParams: params,
      viewHistory: [...truncated, entry],
      historyIndex: truncated.length,
    })
  },

  goBack: () => {
    const { viewHistory, historyIndex } = get()
    if (historyIndex <= 0) return
    const prev = viewHistory[historyIndex - 1]
    set({
      activeView: prev.view,
      viewParams: prev.params,
      historyIndex: historyIndex - 1,
    })
  },

  goForward: () => {
    const { viewHistory, historyIndex } = get()
    if (historyIndex >= viewHistory.length - 1) return
    const next = viewHistory[historyIndex + 1]
    set({
      activeView: next.view,
      viewParams: next.params,
      historyIndex: historyIndex + 1,
    })
  },

  setSidebarSection: (section) => set({ sidebarSection: section }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),
  setContextPanelOpen: (open) => set({ contextPanelOpen: open }),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(160, Math.min(400, width)) }),
  setContextPanelWidth: (width) => set({ contextPanelWidth: Math.max(200, Math.min(480, width)) }),
}))
