import { create } from 'zustand'
import type { Scan, ScanStatus, ParsedResults, Module } from '@shared/types'

interface ScanState {
  /** All scans loaded for the current context (target or global) */
  scans: Scan[]
  /** The scan currently being viewed in detail */
  activeScan: Scan | null
  /** Parsed results for the active scan */
  parsedResults: ParsedResults | null
  /** Module definition for the active scan's tool */
  scanModule: Module | null
  loading: boolean
  resultsLoading: boolean
  error: string | null
}

interface ScanActions {
  /** Load scans with optional filters */
  loadScans: (filters?: {
    targetId?: number
    status?: ScanStatus
    toolId?: string
    limit?: number
  }) => Promise<void>
  /** Load a specific scan and its parsed results + module */
  loadScanDetail: (scanId: number) => Promise<void>
  /** Clear the active scan view */
  clearActiveScan: () => void
  /** Update a scan in the list (e.g., when status changes) */
  updateScan: (scanId: number, updates: Partial<Scan>) => void
}

export const useScanStore = create<ScanState & ScanActions>((set, get) => ({
  scans: [],
  activeScan: null,
  parsedResults: null,
  scanModule: null,
  loading: false,
  resultsLoading: false,
  error: null,

  loadScans: async (filters) => {
    try {
      set({ loading: true, error: null })
      const scans = (await window.api.invoke('scan:list', filters ?? {})) as Scan[]
      set({ scans, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load scans',
        loading: false,
      })
    }
  },

  loadScanDetail: async (scanId: number) => {
    try {
      set({ loading: true, resultsLoading: true, error: null })

      // Fetch scan record
      const scan = (await window.api.invoke('scan:get', { scanId })) as Scan
      set({ activeScan: scan, loading: false })

      // Fetch module definition and parsed results in parallel
      const [mod, results] = await Promise.all([
        window.api.invoke('module:get', { moduleId: scan.tool_id }).catch(() => null) as Promise<Module | null>,
        scan.status === 'completed'
          ? (window.api.invoke('scan:results', { scanId }).catch(() => null) as Promise<ParsedResults | null>)
          : Promise.resolve(null),
      ])

      set({
        scanModule: mod,
        parsedResults: results,
        resultsLoading: false,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load scan detail',
        loading: false,
        resultsLoading: false,
      })
    }
  },

  clearActiveScan: () => {
    set({ activeScan: null, parsedResults: null, scanModule: null, error: null })
  },

  updateScan: (scanId, updates) => {
    const { scans, activeScan } = get()
    set({
      scans: scans.map((s) => (s.id === scanId ? { ...s, ...updates } : s)),
      activeScan: activeScan?.id === scanId ? { ...activeScan, ...updates } as Scan : activeScan,
    })
  },
}))

// ── Selectors ──

export const selectActiveScan = (state: ScanState): Scan | null => state.activeScan
export const selectParsedResults = (state: ScanState): ParsedResults | null => state.parsedResults
export const selectScanModule = (state: ScanState): Module | null => state.scanModule
export const selectRunningScans = (state: ScanState): Scan[] =>
  state.scans.filter((s) => s.status === 'running' || s.status === 'queued')
export const selectCompletedScans = (state: ScanState): Scan[] =>
  state.scans.filter((s) => s.status === 'completed')
