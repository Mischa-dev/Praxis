/**
 * Generic entity IPC handlers — schema-driven CRUD for all profile-defined entities.
 *
 * These handlers work alongside the existing domain-specific handlers (target, scan, etc.)
 * during the migration period. Once migration is complete, the old handlers can be removed.
 */

import type { IpcMain } from 'electron'
import { getDatabase } from '../workspace-manager'
import { getEntitySchema } from '../profile-loader'
import { getActionsForTarget } from '../action-engine'
import { getResolvedPaths } from '../profile-loader'
import type { EntityFilter, EntityRecord, ResolvedSchema } from '@shared/types/entity'

/** Validate that an entity type exists in the schema (prevents SQL injection) */
function requireValidEntityType(schema: ResolvedSchema, entityType: string): void {
  if (!schema.entities[entityType]) {
    throw new Error(`Unknown entity type: ${entityType}`)
  }
}

export function registerEntityHandlers(ipcMain: IpcMain): void {
  // ── Return the full entity schema to the renderer ──
  ipcMain.handle('entity:schema', async () => {
    const schema = getEntitySchema()
    if (!schema) {
      throw new Error('Entity schema not loaded')
    }
    return schema
  })

  // ── Create a new entity ──
  ipcMain.handle(
    'entity:create',
    async (_event, data: { entityType: string; data: Record<string, unknown> }) => {
      const schema = getEntitySchema()
      if (!schema) throw new Error('Entity schema not loaded')
      requireValidEntityType(schema, data.entityType)

      const db = getDatabase()
      return db.entityCreate(data.entityType, data.data)
    }
  )

  // ── Get a single entity by ID ──
  ipcMain.handle(
    'entity:get',
    async (_event, data: { entityType: string; id: number }) => {
      const schema = getEntitySchema()
      if (!schema) throw new Error('Entity schema not loaded')
      requireValidEntityType(schema, data.entityType)

      const db = getDatabase()
      return db.entityGet(data.entityType, data.id) ?? null
    }
  )

  // ── List entities with optional filters ──
  ipcMain.handle(
    'entity:list',
    async (_event, data: { entityType: string; filter?: EntityFilter }) => {
      const schema = getEntitySchema()
      if (!schema) throw new Error('Entity schema not loaded')
      requireValidEntityType(schema, data.entityType)

      const db = getDatabase()
      return db.entityList(data.entityType, data.filter)
    }
  )

  // ── Update an entity ──
  ipcMain.handle(
    'entity:update',
    async (
      _event,
      data: { entityType: string; id: number; updates: Record<string, unknown> }
    ) => {
      const schema = getEntitySchema()
      if (!schema) throw new Error('Entity schema not loaded')
      requireValidEntityType(schema, data.entityType)

      const db = getDatabase()
      return db.entityUpdate(data.entityType, data.id, data.updates) ?? null
    }
  )

  // ── Delete an entity ──
  ipcMain.handle(
    'entity:delete',
    async (_event, data: { entityType: string; id: number }) => {
      const schema = getEntitySchema()
      if (!schema) throw new Error('Entity schema not loaded')
      requireValidEntityType(schema, data.entityType)

      const db = getDatabase()
      db.entityRemove(data.entityType, data.id)
    }
  )

  // ── Get entity detail (primary entity + all children) ──
  ipcMain.handle(
    'entity:detail',
    async (_event, data: { entityType: string; id: number }) => {
      const schema = getEntitySchema()
      if (!schema) throw new Error('Entity schema not loaded')
      requireValidEntityType(schema, data.entityType)

      const db = getDatabase()
      return db.entityGetDetail(data.entityType, data.id) ?? null
    }
  )

  // ── Cross-entity search ──
  ipcMain.handle('entity:search', async (_event, data: { query: string }) => {
    const db = getDatabase()
    return db.entitySearch(data.query)
  })

  // ── Entity stats (counts) ──
  ipcMain.handle('entity:stats', async () => {
    const db = getDatabase()
    return db.entityStats()
  })

  // ── Entity actions (contextual suggestions for primary entities) ──
  ipcMain.handle(
    'entity:actions',
    async (_event, data: { entityType: string; id: number }) => {
      const schema = getEntitySchema()
      if (!schema) throw new Error('Entity schema not loaded')
      requireValidEntityType(schema, data.entityType)

      // Actions only apply to the primary entity type (or entities with children)
      const db = getDatabase()
      const detail = db.entityGetDetail(data.entityType, data.id)
      if (!detail) return []

      // Use the existing action engine — build a TargetDetail-like object
      // This bridges the generic entity system with the existing action engine
      // during the transition period
      const paths = getResolvedPaths()
      try {
        const targetDetail = bridgeToTargetDetail(detail.entity, detail.children)
        return getActionsForTarget(paths.actions, targetDetail)
      } catch {
        return []
      }
    }
  )
}

/**
 * Bridge a generic EntityDetail to the existing TargetDetail format.
 * This allows the existing action engine to work with generic entities
 * during the transition period. Will be removed when action engine is
 * fully genericized (Phase 4).
 */
function bridgeToTargetDetail(
  entity: EntityRecord,
  children: Record<string, EntityRecord[]>
): import('@shared/types/target').TargetDetail {
  return {
    id: entity.id,
    type: String(entity.type ?? 'ip') as import('@shared/types/target').TargetType,
    value: String(entity.value ?? ''),
    label: entity.label as string | null ?? null,
    os_guess: entity.os_guess as string | null ?? null,
    scope_status: (entity.scope_status ?? 'unchecked') as import('@shared/types/target').ScopeStatus,
    tags: entity.tags as string ?? '[]',
    notes: entity.notes as string | null ?? null,
    status: (entity.status ?? 'new') as import('@shared/types/target').TargetStatus,
    created_at: entity.created_at as string ?? '',
    updated_at: entity.updated_at as string ?? '',
    services: (children.service ?? []) as unknown as import('@shared/types/target').Service[],
    vulnerabilities: (children.vulnerability ?? []) as unknown as import('@shared/types/results').Vulnerability[],
    credentials: (children.credential ?? []) as unknown as import('@shared/types/results').Credential[],
    web_paths: (children.web_path ?? []) as unknown as import('@shared/types/results').WebPath[],
    findings: (children.finding ?? []) as unknown as import('@shared/types/results').Finding[],
    scans: [],
    notes_list: (children.note ?? []) as unknown as import('@shared/types/target').Note[]
  }
}
