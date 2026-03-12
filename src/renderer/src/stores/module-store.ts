import { create } from 'zustand'
import type { Module } from '@shared/types'

/** Score a fuzzy match — lower is better. Returns -1 if no match. */
function fuzzyScore(target: string, query: string): number {
  const lower = target.toLowerCase()
  const q = query.toLowerCase()
  let j = 0
  let score = 0
  let lastMatch = -1
  for (let i = 0; i < lower.length && j < q.length; i++) {
    if (lower[i] === q[j]) {
      // Penalize gaps between matched characters
      if (lastMatch >= 0) score += i - lastMatch - 1
      lastMatch = i
      j++
    }
  }
  if (j < q.length) return -1
  // Bonus: penalize matches that start later
  return score + (lower.indexOf(q[0]) ?? 0)
}

const FAVORITES_KEY = 'aeth0n:module-favorites'
const RECENTS_KEY = 'aeth0n:module-recents'
const MAX_RECENTS = 10

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage errors
  }
}

interface ModuleState {
  modules: Module[]
  loading: boolean
  error: string | null
  search: string
  favoriteIds: string[]
  recentIds: string[]
  expandedCategories: Set<string>
}

interface ModuleActions {
  loadModules: () => Promise<void>
  reloadModules: () => Promise<void>
  setSearch: (query: string) => void
  toggleFavorite: (moduleId: string) => void
  addRecent: (moduleId: string) => void
  toggleCategory: (categoryId: string) => void
  expandCategory: (categoryId: string) => void
  collapseCategory: (categoryId: string) => void
}

export const useModuleStore = create<ModuleState & ModuleActions>((set, get) => ({
  modules: [],
  loading: false,
  error: null,
  search: '',
  favoriteIds: loadFromStorage<string[]>(FAVORITES_KEY, []),
  recentIds: loadFromStorage<string[]>(RECENTS_KEY, []),
  expandedCategories: new Set<string>(),

  loadModules: async () => {
    try {
      set({ loading: true, error: null })
      const modules = await window.api.invoke('module:list')
      set({ modules, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load modules',
        loading: false,
      })
    }
  },

  reloadModules: async () => {
    try {
      set({ loading: true, error: null })
      const modules = await window.api.invoke('module:reload')
      set({ modules, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to reload modules',
        loading: false,
      })
    }
  },

  setSearch: (query: string) => set({ search: query }),

  toggleFavorite: (moduleId: string) => {
    const { favoriteIds } = get()
    const next = favoriteIds.includes(moduleId)
      ? favoriteIds.filter((id) => id !== moduleId)
      : [...favoriteIds, moduleId]
    saveToStorage(FAVORITES_KEY, next)
    set({ favoriteIds: next })
  },

  addRecent: (moduleId: string) => {
    const { recentIds } = get()
    const filtered = recentIds.filter((id) => id !== moduleId)
    const next = [moduleId, ...filtered].slice(0, MAX_RECENTS)
    saveToStorage(RECENTS_KEY, next)
    set({ recentIds: next })
  },

  toggleCategory: (categoryId: string) => {
    const { expandedCategories } = get()
    const next = new Set(expandedCategories)
    if (next.has(categoryId)) {
      next.delete(categoryId)
    } else {
      next.add(categoryId)
    }
    set({ expandedCategories: next })
  },

  expandCategory: (categoryId: string) => {
    const { expandedCategories } = get()
    if (expandedCategories.has(categoryId)) return
    const next = new Set(expandedCategories)
    next.add(categoryId)
    set({ expandedCategories: next })
  },

  collapseCategory: (categoryId: string) => {
    const { expandedCategories } = get()
    if (!expandedCategories.has(categoryId)) return
    const next = new Set(expandedCategories)
    next.delete(categoryId)
    set({ expandedCategories: next })
  },
}))

// ── Selectors ──

/** All modules grouped by category */
export const selectModulesByCategory = (
  state: ModuleState,
): Map<string, Module[]> => {
  const map = new Map<string, Module[]>()
  for (const mod of state.modules) {
    const list = map.get(mod.category) ?? []
    list.push(mod)
    map.set(mod.category, list)
  }
  return map
}

/** Modules matching the fuzzy search query, sorted by match quality */
export const selectFilteredModules = (state: ModuleState): Module[] => {
  const { modules, search } = state
  if (!search.trim()) return modules

  const query = search.trim()
  const scored = modules
    .map((mod) => {
      // Match against name, description, binary, tags, and category
      const targets = [mod.name, mod.description, mod.binary, mod.category, ...(mod.tags ?? [])]
      let best = Infinity
      for (const t of targets) {
        const s = fuzzyScore(t, query)
        if (s >= 0 && s < best) best = s
      }
      return { mod, score: best }
    })
    .filter((r) => r.score < Infinity)
    .sort((a, b) => a.score - b.score)

  return scored.map((r) => r.mod)
}

/** Favorite modules (resolved from IDs) */
export const selectFavoriteModules = (state: ModuleState): Module[] => {
  const { modules, favoriteIds } = state
  return favoriteIds
    .map((id) => modules.find((m) => m.id === id))
    .filter((m): m is Module => m !== undefined)
}

/** Recent modules (resolved from IDs) */
export const selectRecentModules = (state: ModuleState): Module[] => {
  const { modules, recentIds } = state
  return recentIds
    .map((id) => modules.find((m) => m.id === id))
    .filter((m): m is Module => m !== undefined)
}

/** Check if a module is favorited */
export const selectIsFavorite =
  (moduleId: string) =>
  (state: ModuleState): boolean =>
    state.favoriteIds.includes(moduleId)

/** Get a single module by ID */
export const selectModule =
  (moduleId: string) =>
  (state: ModuleState): Module | undefined =>
    state.modules.find((m) => m.id === moduleId)

/** Module count */
export const selectModuleCount = (state: ModuleState): number => state.modules.length

/** Installed module count */
export const selectInstalledCount = (state: ModuleState): number =>
  state.modules.filter((m) => m.installed).length
