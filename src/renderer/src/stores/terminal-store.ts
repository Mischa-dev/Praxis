/**
 * Terminal store — manages terminal sessions, output buffering,
 * and IPC streaming subscriptions.
 */

import { create } from 'zustand'

export interface TerminalSession {
  id: string // scanId-based or "shell-{n}"
  scanId?: number
  label: string
  toolId?: string
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'idle'
  createdAt: number
}

interface TerminalState {
  sessions: TerminalSession[]
  activeSessionId: string | null
  paneOpen: boolean
  paneHeight: number // in pixels

  // Actions
  addSession: (session: TerminalSession) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string | null) => void
  updateSessionStatus: (id: string, status: TerminalSession['status']) => void
  togglePane: () => void
  openPane: () => void
  closePane: () => void
  setPaneHeight: (height: number) => void
}

const DEFAULT_PANE_HEIGHT = 280
const MIN_PANE_HEIGHT = 120
const MAX_PANE_HEIGHT_RATIO = 0.7 // max 70% of viewport

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: [],
  activeSessionId: null,
  paneOpen: false,
  paneHeight: DEFAULT_PANE_HEIGHT,

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
      paneOpen: true
    })),

  removeSession: (id) =>
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id)
      const activeSessionId =
        state.activeSessionId === id
          ? sessions.length > 0
            ? sessions[sessions.length - 1].id
            : null
          : state.activeSessionId
      return {
        sessions,
        activeSessionId,
        paneOpen: sessions.length > 0 ? state.paneOpen : false
      }
    }),

  setActiveSession: (id) => set({ activeSessionId: id }),

  updateSessionStatus: (id, status) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, status } : s))
    })),

  togglePane: () =>
    set((state) => ({ paneOpen: !state.paneOpen })),

  openPane: () => set({ paneOpen: true }),

  closePane: () => set({ paneOpen: false }),

  setPaneHeight: (height) =>
    set(() => {
      const maxHeight = window.innerHeight * MAX_PANE_HEIGHT_RATIO
      return { paneHeight: Math.max(MIN_PANE_HEIGHT, Math.min(height, maxHeight)) }
    })
}))

// Selectors
export const selectActiveSession = (state: TerminalState): TerminalSession | undefined =>
  state.sessions.find((s) => s.id === state.activeSessionId)

export const selectSessionCount = (state: TerminalState): number =>
  state.sessions.length

export const selectRunningCount = (state: TerminalState): number =>
  state.sessions.filter((s) => s.status === 'running').length
