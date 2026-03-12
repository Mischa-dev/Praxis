/**
 * Entity store — generic Zustand store for all schema-defined entity types.
 *
 * Replaces per-entity stores (target-store, scan-store partial) with a single
 * store that dynamically manages entities based on the profile schema.
 */

import { create } from 'zustand'
import type {
  ResolvedSchema,
  ResolvedEntityDef,
  EntityRecord,
  EntityDetail,
  EntityFilter
} from '@shared/types/entity'
import type { EvaluatedAction } from '@shared/types/action'

// ── Per-type cache ──

interface EntityTypeCache {
  entities: EntityRecord[]
  loading: boolean
  error: string | null
}

// ── Store State ──

interface EntityState {
  /** The loaded entity schema (null until loaded) */
  schema: ResolvedSchema | null
  /** Per-type entity caches */
  caches: Record<string, EntityTypeCache>
  /** Active primary entity ID */
  activeEntityId: number | null
  /** Detail view data for the active entity */
  entityDetail: EntityDetail | null
  /** Entity counts by type */
  stats: Record<string, number>
  /** Evaluated actions for the active entity */
  actions: EvaluatedAction[]
  /** Global loading state */
  loading: boolean
  /** Global error */
  error: string | null
}

// ── Store Actions ──

interface EntityActions {
  /** Load the entity schema from the main process */
  loadSchema: () => Promise<void>
  /** Load entities of a specific type */
  loadEntities: (entityType: string, filter?: EntityFilter) => Promise<void>
  /** Create a new entity */
  createEntity: (entityType: string, data: Record<string, unknown>) => Promise<EntityRecord>
  /** Update an entity */
  updateEntity: (entityType: string, id: number, updates: Record<string, unknown>) => Promise<EntityRecord | null>
  /** Delete an entity */
  deleteEntity: (entityType: string, id: number) => Promise<void>
  /** Set the active entity and load its detail */
  setActiveEntity: (id: number | null) => void
  /** Load detail view for a specific entity */
  loadEntityDetail: (entityType: string, id: number) => Promise<void>
  /** Clear the entity detail */
  clearEntityDetail: () => void
  /** Load entity stats */
  loadStats: () => Promise<void>
  /** Load actions for the active entity */
  loadActions: (entityType: string, id: number) => Promise<void>
  /** Search across all entity types */
  search: (query: string) => Promise<Record<string, EntityRecord[]>>
}

// ── Store ──

export const useEntityStore = create<EntityState & EntityActions>((set, get) => ({
  schema: null,
  caches: {},
  activeEntityId: null,
  entityDetail: null,
  stats: {},
  actions: [],
  loading: false,
  error: null,

  loadSchema: async () => {
    try {
      set({ loading: true, error: null })
      const schema = (await window.api.invoke('entity:schema')) as ResolvedSchema
      set({ schema, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load entity schema',
        loading: false
      })
    }
  },

  loadEntities: async (entityType: string, filter?: EntityFilter) => {
    const { caches } = get()
    set({
      caches: {
        ...caches,
        [entityType]: { ...(caches[entityType] ?? { entities: [] }), loading: true, error: null }
      }
    })

    try {
      const entities = (await window.api.invoke('entity:list', {
        entityType,
        filter
      })) as EntityRecord[]
      const { caches: current } = get()
      set({
        caches: {
          ...current,
          [entityType]: { entities, loading: false, error: null }
        }
      })
    } catch (err) {
      const { caches: current } = get()
      set({
        caches: {
          ...current,
          [entityType]: {
            ...(current[entityType] ?? { entities: [] }),
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load entities'
          }
        }
      })
    }
  },

  createEntity: async (entityType: string, data: Record<string, unknown>) => {
    const entity = (await window.api.invoke('entity:create', {
      entityType,
      data
    })) as EntityRecord

    // Prepend to cache
    const { caches } = get()
    const cache = caches[entityType]
    if (cache) {
      set({
        caches: {
          ...caches,
          [entityType]: {
            ...cache,
            entities: [entity, ...cache.entities]
          }
        }
      })
    }

    return entity
  },

  updateEntity: async (entityType: string, id: number, updates: Record<string, unknown>) => {
    const entity = (await window.api.invoke('entity:update', {
      entityType,
      id,
      updates
    })) as EntityRecord | null

    if (entity) {
      const { caches } = get()
      const cache = caches[entityType]
      if (cache) {
        set({
          caches: {
            ...caches,
            [entityType]: {
              ...cache,
              entities: cache.entities.map((e) => (e.id === id ? entity : e))
            }
          }
        })
      }

      // Refresh detail if this is the active entity
      if (get().entityDetail?.entity.id === id) {
        get().loadEntityDetail(entityType, id)
      }
    }

    return entity
  },

  deleteEntity: async (entityType: string, id: number) => {
    await window.api.invoke('entity:delete', { entityType, id })

    const { caches, activeEntityId, entityDetail } = get()
    const cache = caches[entityType]
    if (cache) {
      set({
        caches: {
          ...caches,
          [entityType]: {
            ...cache,
            entities: cache.entities.filter((e) => e.id !== id)
          }
        },
        activeEntityId: activeEntityId === id ? null : activeEntityId,
        entityDetail: entityDetail?.entity.id === id ? null : entityDetail
      })
    }
  },

  setActiveEntity: (id: number | null) => {
    set({ activeEntityId: id })
  },

  loadEntityDetail: async (entityType: string, id: number) => {
    try {
      set({ loading: true, error: null })
      const detail = (await window.api.invoke('entity:detail', {
        entityType,
        id
      })) as EntityDetail | null
      set({ entityDetail: detail, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load entity detail',
        loading: false
      })
    }
  },

  clearEntityDetail: () => {
    set({ entityDetail: null })
  },

  loadStats: async () => {
    try {
      const stats = (await window.api.invoke('entity:stats')) as Record<string, number>
      set({ stats })
    } catch {
      // Non-critical
    }
  },

  loadActions: async (entityType: string, id: number) => {
    try {
      const actions = (await window.api.invoke('entity:actions', {
        entityType,
        id
      })) as EvaluatedAction[]
      set({ actions })
    } catch {
      set({ actions: [] })
    }
  },

  search: async (query: string) => {
    return (await window.api.invoke('entity:search', { query })) as Record<string, EntityRecord[]>
  }
}))

// ── Selectors ──

export const selectSchema = (state: EntityState): ResolvedSchema | null => state.schema

export const selectPrimaryType = (state: EntityState): ResolvedEntityDef | null => {
  if (!state.schema) return null
  return state.schema.entities[state.schema.primaryEntity] ?? null
}

const EMPTY_ENTITIES: EntityRecord[] = []

export const selectEntities = (entityType: string) => (state: EntityState): EntityRecord[] =>
  state.caches[entityType]?.entities ?? EMPTY_ENTITIES

export const selectEntitiesLoading = (entityType: string) => (state: EntityState): boolean =>
  state.caches[entityType]?.loading ?? false

export const selectActiveEntity = (state: EntityState & EntityActions): EntityRecord | undefined => {
  if (!state.schema || !state.activeEntityId) return undefined
  const primaryType = state.schema.primaryEntity
  return state.caches[primaryType]?.entities.find((e) => e.id === state.activeEntityId)
}

export const selectEntityDef = (entityType: string) => (state: EntityState): ResolvedEntityDef | null =>
  state.schema?.entities[entityType] ?? null

export const selectChildTypes = (entityType: string) => (state: EntityState): string[] =>
  state.schema?.entities[entityType]?.childTypes ?? []
