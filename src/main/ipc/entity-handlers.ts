/**
 * Generic entity IPC handlers — schema-driven CRUD for all profile-defined entities.
 */

import type { IpcMain } from 'electron'
import { getDatabase } from '../workspace-manager'
import { getEntitySchema } from '../profile-loader'
import { getActionsForEntity } from '../action-engine'
import { getResolvedPaths } from '../profile-loader'
import type { EntityFilter, ResolvedSchema } from '@shared/types/entity'

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

  // ── Entity actions (contextual suggestions for entities) ──
  ipcMain.handle(
    'entity:actions',
    async (_event, data: { entityType: string; id: number }) => {
      const schema = getEntitySchema()
      if (!schema) throw new Error('Entity schema not loaded')
      requireValidEntityType(schema, data.entityType)

      const db = getDatabase()
      const detail = db.entityGetDetail(data.entityType, data.id)
      if (!detail) return []

      const paths = getResolvedPaths()
      try {
        return getActionsForEntity(
          paths.actions,
          data.entityType,
          detail.entity,
          detail.children
        )
      } catch {
        return []
      }
    }
  )
}
