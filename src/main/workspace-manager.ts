/**
 * Workspace manager — manages project (workspace) databases.
 *
 * Each project gets its own SQLite database. A JSON metadata file per project
 * stores name, description, type, scope, and timestamps. The workspace directory
 * lives under `<userData>/workspaces/`.
 */

import { app } from 'electron'
import { join } from 'path'
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  copyFileSync
} from 'fs'
import { WorkspaceDatabase } from './database'
import type { Workspace, WorkspaceType, WorkspaceScope } from '@shared/types/workspace'
import type { ResolvedSchema } from '@shared/types/entity'
import { randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** Metadata stored alongside each workspace database */
interface WorkspaceMeta {
  id: string
  name: string
  description: string | null
  type: WorkspaceType
  scope_in: string[] | null
  scope_out: string[] | null
  created_at: string
  updated_at: string
}

let activeDb: WorkspaceDatabase | null = null
let activeWorkspaceId: string | null = null
let activeEntitySchema: ResolvedSchema | null = null

/** Set the entity schema to use when opening databases */
export function setEntitySchema(schema: ResolvedSchema | null): void {
  activeEntitySchema = schema
  // If a database is already open, initialize the entity schema on it
  if (activeDb && schema) {
    activeDb.initEntitySchema(schema)
  }
}

/** Ensure the workspaces directory exists and return its path */
function getWorkspacesDir(): string {
  const dir = join(app.getPath('userData'), 'workspaces')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Get the directory for a specific workspace */
function getWorkspaceDir(workspaceId: string): string {
  return join(getWorkspacesDir(), workspaceId)
}

/** Get the metadata file path for a workspace */
function getMetaPath(workspaceId: string): string {
  return join(getWorkspaceDir(workspaceId), 'meta.json')
}

/** Get the database file path for a workspace */
function getDbPath(workspaceId: string): string {
  return join(getWorkspaceDir(workspaceId), 'workspace.db')
}

/** Read workspace metadata from disk */
function readMeta(workspaceId: string): WorkspaceMeta | null {
  const metaPath = getMetaPath(workspaceId)
  if (!existsSync(metaPath)) return null
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8')) as WorkspaceMeta
  } catch {
    return null
  }
}

/** Write workspace metadata to disk */
function writeMeta(meta: WorkspaceMeta): void {
  const dir = getWorkspaceDir(meta.id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(getMetaPath(meta.id), JSON.stringify(meta, null, 2), 'utf-8')
}

/** Convert metadata to Workspace type */
function metaToWorkspace(meta: WorkspaceMeta): Workspace {
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    type: meta.type,
    scope_in: meta.scope_in ? JSON.stringify(meta.scope_in) : null,
    scope_out: meta.scope_out ? JSON.stringify(meta.scope_out) : null,
    db_path: getDbPath(meta.id),
    created_at: meta.created_at,
    updated_at: meta.updated_at
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Initialize or migrate the default workspace if no workspaces exist */
export function initDefaultWorkspace(): void {
  if (activeDb) return

  const wsDir = getWorkspacesDir()

  // Check if there are any workspace directories
  const entries = readdirSync(wsDir, { withFileTypes: true }).filter((e) => e.isDirectory())

  if (entries.length === 0) {
    // No workspaces exist — create a default one
    const ws = createWorkspace('Default Project', undefined, 'custom')
    loadWorkspace(ws.id)
    return
  }

  // Load the most recently updated workspace that has a valid database
  const metas: WorkspaceMeta[] = []
  for (const entry of entries) {
    const meta = readMeta(entry.name)
    if (meta) metas.push(meta)
  }
  metas.sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  for (const meta of metas) {
    const dbPath = getDbPath(meta.id)
    if (existsSync(dbPath)) {
      loadWorkspace(meta.id)
      return
    }
    // Stale workspace — database missing, skip it
    console.warn(`Workspace "${meta.name}" (${meta.id}) has no database, skipping`)
  }

  // No valid workspace found — create default
  const ws = createWorkspace('Default Project', undefined, 'custom')
  loadWorkspace(ws.id)
}

/** Create a new workspace (project) */
export function createWorkspace(
  name: string,
  description?: string,
  type?: WorkspaceType,
  scope?: WorkspaceScope
): Workspace {
  const id = randomUUID()
  const now = new Date().toISOString()

  const meta: WorkspaceMeta = {
    id,
    name,
    description: description ?? null,
    type: type ?? 'custom',
    scope_in: scope?.inScope ?? null,
    scope_out: scope?.outOfScope ?? null,
    created_at: now,
    updated_at: now
  }

  // Create workspace directory and write metadata
  writeMeta(meta)

  // Initialize the database file (creates tables)
  const dbPath = getDbPath(id)
  const db = new WorkspaceDatabase(dbPath, activeEntitySchema ?? undefined)
  db.close()

  return metaToWorkspace(meta)
}

/** Load (switch to) a workspace */
export function loadWorkspace(workspaceId: string): Workspace {
  const meta = readMeta(workspaceId)
  if (!meta) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }

  // Close current database if open
  if (activeDb) {
    activeDb.close()
    activeDb = null
  }

  // Open the new workspace database
  const dbPath = getDbPath(workspaceId)
  if (!existsSync(dbPath)) {
    throw new Error(`Workspace database not found: ${dbPath}`)
  }

  activeDb = new WorkspaceDatabase(dbPath, activeEntitySchema ?? undefined)
  activeWorkspaceId = workspaceId

  // Update the last-accessed timestamp
  meta.updated_at = new Date().toISOString()
  writeMeta(meta)

  return metaToWorkspace(meta)
}

/** List all workspaces */
export function listWorkspaces(): Workspace[] {
  const wsDir = getWorkspacesDir()
  const entries = readdirSync(wsDir, { withFileTypes: true }).filter((e) => e.isDirectory())

  const workspaces: Workspace[] = []
  for (const entry of entries) {
    const meta = readMeta(entry.name)
    if (meta) {
      workspaces.push(metaToWorkspace(meta))
    }
  }

  // Sort by most recently updated
  workspaces.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return workspaces
}

/** Delete a workspace and all its data */
export function deleteWorkspace(workspaceId: string): void {
  // Cannot delete the active workspace
  if (workspaceId === activeWorkspaceId) {
    throw new Error('Cannot delete the currently active workspace. Switch to another workspace first.')
  }

  const wsDir = getWorkspaceDir(workspaceId)
  if (!existsSync(wsDir)) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }

  rmSync(wsDir, { recursive: true, force: true })
}

/** Update workspace metadata */
export function updateWorkspace(
  workspaceId: string,
  updates: { name?: string; description?: string; type?: WorkspaceType; scope?: WorkspaceScope }
): Workspace {
  const meta = readMeta(workspaceId)
  if (!meta) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }

  if (updates.name !== undefined) meta.name = updates.name
  if (updates.description !== undefined) meta.description = updates.description
  if (updates.type !== undefined) meta.type = updates.type
  if (updates.scope !== undefined) {
    meta.scope_in = updates.scope.inScope
    meta.scope_out = updates.scope.outOfScope
  }
  meta.updated_at = new Date().toISOString()

  writeMeta(meta)
  return metaToWorkspace(meta)
}

/** Export a workspace as a zip archive. Returns the path to the exported file. */
export async function exportWorkspace(workspaceId: string): Promise<string> {
  const meta = readMeta(workspaceId)
  if (!meta) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }

  const dbPath = getDbPath(workspaceId)
  if (!existsSync(dbPath)) {
    throw new Error(`Workspace database not found: ${dbPath}`)
  }

  // Export to the user's downloads directory
  const downloadsDir = app.getPath('downloads')
  const safeName = meta.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  const exportPath = join(downloadsDir, `${safeName}_${Date.now()}.zip`)

  // Use system zip command (available on all Linux distros)
  try {
    const wsDir = getWorkspaceDir(workspaceId)
    await execFileAsync('zip', ['-j', exportPath, getMetaPath(workspaceId), dbPath], {
      cwd: wsDir
    })
  } catch {
    // Fallback: just copy the database file with a .db extension
    const fallbackPath = join(downloadsDir, `${safeName}_${Date.now()}.db`)
    copyFileSync(dbPath, fallbackPath)
    return fallbackPath
  }

  return exportPath
}

/** Get the currently active workspace */
export function getCurrentWorkspace(): Workspace | null {
  if (!activeWorkspaceId) return null
  const meta = readMeta(activeWorkspaceId)
  if (!meta) return null
  return metaToWorkspace(meta)
}

/** Get the active workspace database. Throws if not initialized. */
export function getDatabase(): WorkspaceDatabase {
  if (!activeDb) {
    throw new Error('No active workspace database. Call initDefaultWorkspace() first.')
  }
  return activeDb
}

/** Close the active database connection */
export function closeDatabase(): void {
  if (activeDb) {
    activeDb.close()
    activeDb = null
    activeWorkspaceId = null
  }
}
