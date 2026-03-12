// Workspace types

export type WorkspaceType = 'external' | 'internal' | 'web' | 'wireless' | 'custom'

export interface Workspace {
  id: string // UUID
  name: string
  description: string | null
  type: WorkspaceType
  scope_in: string | null // JSON array of in-scope targets/ranges
  scope_out: string | null // JSON array of out-of-scope exclusions
  db_path: string // SQLite path
  created_at: string
  updated_at: string
}

export interface WorkspaceScope {
  inScope: string[]
  outOfScope: string[]
}
