import { create } from 'zustand'
import type { Target, TargetType, TargetDetail } from '@shared/types'

// ── Type auto-detection ──

const IP_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const CIDR_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/
const URL_RE = /^https?:\/\//i
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const DOMAIN_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/

/** Auto-detect target type from a raw input string */
export function detectTargetType(value: string): TargetType {
  const trimmed = value.trim()
  if (CIDR_RE.test(trimmed)) return 'cidr'
  if (IP_RE.test(trimmed)) return 'ip'
  if (URL_RE.test(trimmed)) return 'url'
  if (EMAIL_RE.test(trimmed)) return 'email'
  if (DOMAIN_RE.test(trimmed)) return 'domain'
  // Fallback: anything with dots that isn't a domain (e.g. "server1.internal")
  return 'hostname'
}

// ── Store ──

interface TargetState {
  targets: Target[]
  activeTargetId: number | null
  targetDetail: TargetDetail | null
  loading: boolean
  error: string | null
}

interface TargetActions {
  loadTargets: () => Promise<void>
  addTarget: (value: string, label?: string, typeOverride?: TargetType) => Promise<Target>
  removeTarget: (targetId: number) => Promise<void>
  updateTarget: (
    targetId: number,
    updates: Partial<Pick<Target, 'label' | 'notes' | 'tags' | 'status' | 'os_guess'>>
  ) => Promise<Target>
  setActiveTarget: (targetId: number | null) => void
  loadTargetDetail: (targetId: number) => Promise<void>
  clearTargetDetail: () => void
}

export const useTargetStore = create<TargetState & TargetActions>((set, get) => ({
  targets: [],
  activeTargetId: null,
  targetDetail: null,
  loading: false,
  error: null,

  loadTargets: async () => {
    try {
      set({ loading: true, error: null })
      const targets = (await window.api.invoke('target:list')) as Target[]
      set({ targets, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load targets',
        loading: false
      })
    }
  },

  addTarget: async (value: string, label?: string, typeOverride?: TargetType) => {
    const type = typeOverride ?? detectTargetType(value)
    const target = (await window.api.invoke('target:add', {
      type,
      value: value.trim(),
      label
    })) as Target
    set({ targets: [target, ...get().targets] })
    return target
  },

  removeTarget: async (targetId: number) => {
    await window.api.invoke('target:remove', { targetId })
    const { targets, activeTargetId, targetDetail } = get()
    set({
      targets: targets.filter((t) => t.id !== targetId),
      activeTargetId: activeTargetId === targetId ? null : activeTargetId,
      targetDetail: targetDetail?.id === targetId ? null : targetDetail
    })
  },

  updateTarget: async (targetId, updates) => {
    const target = (await window.api.invoke('target:update', {
      targetId,
      updates
    })) as Target
    set({
      targets: get().targets.map((t) => (t.id === targetId ? target : t))
    })
    // If this is the currently viewed detail, refresh it
    if (get().targetDetail?.id === targetId) {
      get().loadTargetDetail(targetId)
    }
    return target
  },

  setActiveTarget: (targetId) => {
    set({ activeTargetId: targetId })
  },

  loadTargetDetail: async (targetId: number) => {
    try {
      set({ loading: true, error: null })
      const detail = (await window.api.invoke('target:get', { targetId })) as TargetDetail
      set({ targetDetail: detail, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load target detail',
        loading: false
      })
    }
  },

  clearTargetDetail: () => {
    set({ targetDetail: null })
  }
}))

// ── Selectors ──

export const selectTargetCount = (state: TargetState): number => state.targets.length

export const selectActiveTarget = (state: TargetState & TargetActions): Target | undefined =>
  state.targets.find((t) => t.id === state.activeTargetId)
