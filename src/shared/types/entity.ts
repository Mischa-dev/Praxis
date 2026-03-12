// Entity schema types — profile-defined data model for the generic entity system
//
// Profiles declare entity types, fields, relationships, and display rules in
// profile/schema.yaml. The engine uses these types to dynamically create tables,
// IPC channels, UI views, and CRUD operations.

// ── Field Definition ──

/** Supported column types (maps to SQLite types) */
export type FieldKind = 'text' | 'integer' | 'real' | 'boolean' | 'enum' | 'json'

/** Semantic roles that connect generic fields to UI components */
export type FieldRole = 'display' | 'status' | 'category'

export interface FieldDef {
  kind: FieldKind
  required?: boolean
  unique?: boolean
  default?: unknown
  /** Allowed values for enum fields */
  values?: string[]
  /** Semantic role: display=card title, status=badge, category=grouping/icon */
  role?: FieldRole
  /** Validation regex pattern */
  pattern?: string
  min?: number
  max?: number
  /** FK reference to another entity type or engine table (e.g., 'scan') */
  references?: string
}

// ── Auto-Detection ──

export interface AutoDetectRule {
  type_value: string
  pattern: string
}

// ── Conflict Resolution ──

export interface OnConflictConfig {
  strategy: 'upsert' | 'ignore' | 'replace'
  /** Fields to COALESCE on upsert (keep existing if new value is null) */
  coalesce_fields?: string[]
}

// ── Entity Definition (as declared in schema.yaml) ──

export interface EntityDef {
  label: string
  label_plural: string
  icon: string
  /** Parent entity type — creates FK with ON DELETE CASCADE */
  parent?: string
  fields: Record<string, FieldDef>
  /** Timestamp columns to auto-add (e.g., ['created_at', 'updated_at']) */
  timestamps?: string[]
  /** Fields to include in full-text search */
  searchable?: string[]
  /** Composite unique constraints (arrays of field names) */
  unique_together?: string[][]
  on_conflict?: OnConflictConfig
  /** Smart input detection rules (for the primary entity's add dialog) */
  auto_detect?: AutoDetectRule[]
}

// ── Extraction Patterns ──

export interface ExtractionPattern {
  type: string
  pattern: string
}

// ── Raw Schema (as loaded from YAML) ──

export interface EntitySchema {
  schema_version: number
  primary_entity: string
  entities: Record<string, EntityDef>
  extraction_patterns?: ExtractionPattern[]
}

// ── Resolved Schema (validated + enriched at runtime) ──

export interface ResolvedEntityDef extends EntityDef {
  /** The entity type key (e.g., 'target', 'service') */
  id: string
  /** Database table name = id + 's' (e.g., 'targets', 'services') */
  tableName: string
  /** FK column name to parent (e.g., 'target_id'), null if no parent */
  parentFkColumn: string | null
  /** Entity types that have this entity as their parent */
  childTypes: string[]
}

export interface ResolvedSchema {
  version: number
  primaryEntity: string
  entities: Record<string, ResolvedEntityDef>
  extractionPatterns: ExtractionPattern[]
}

// ── Runtime Entity Records ──

/** A generic entity record from the database */
export type EntityRecord = Record<string, unknown> & { id: number }

/** Detail view: primary entity + all children grouped by type */
export interface EntityDetail {
  entity: EntityRecord
  children: Record<string, EntityRecord[]>
}

// ── Filter for list queries ──

export interface EntityFilter {
  where?: Record<string, unknown>
  sort?: { column: string; direction: 'asc' | 'desc' }
  limit?: number
  offset?: number
}
