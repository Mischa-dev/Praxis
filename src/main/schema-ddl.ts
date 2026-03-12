/**
 * Schema DDL generator — produces CREATE TABLE SQL from a ResolvedSchema.
 *
 * Maps entity definitions to SQLite DDL with:
 *   - Column types from FieldDef.kind
 *   - CHECK constraints for enum fields
 *   - Foreign key columns from parent + references
 *   - Composite unique constraints from unique_together
 *   - Timestamp columns
 *   - Schema meta table for migration tracking
 */

import type { ResolvedSchema, ResolvedEntityDef, FieldDef } from '@shared/types/entity'

/**
 * Generate all CREATE TABLE statements for profile-defined entities.
 * Engine-managed tables (scans, command_history, pipelines) are NOT generated here.
 */
export function generateDDL(schema: ResolvedSchema): string {
  const statements: string[] = []

  // Schema meta table for tracking schema version/hash
  statements.push(`CREATE TABLE IF NOT EXISTS entity_schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`)

  // Generate a CREATE TABLE for each entity
  for (const entity of Object.values(schema.entities)) {
    statements.push(generateEntityTable(entity))
  }

  return statements.join('\n\n')
}

/**
 * Generate ALTER TABLE statements for adding new columns to existing tables.
 * Used during schema migration when the profile adds new fields.
 */
export function generateMigrationDDL(
  schema: ResolvedSchema,
  existingColumns: Map<string, Set<string>>
): string[] {
  const statements: string[] = []

  for (const entity of Object.values(schema.entities)) {
    const existing = existingColumns.get(entity.tableName)
    if (!existing) continue // New table — CREATE TABLE handles it

    // Check for new user-defined fields
    for (const [fieldId, fieldDef] of Object.entries(entity.fields)) {
      if (!existing.has(fieldId)) {
        const colDef = columnDefinition(fieldId, fieldDef, false) // No NOT NULL for ALTER
        statements.push(`ALTER TABLE ${entity.tableName} ADD COLUMN ${colDef};`)
      }
    }

    // Check for new parent FK column
    if (entity.parentFkColumn && !existing.has(entity.parentFkColumn)) {
      statements.push(
        `ALTER TABLE ${entity.tableName} ADD COLUMN ${entity.parentFkColumn} INTEGER REFERENCES ${entity.parent}s(id);`
      )
    }

    // Check for new timestamp columns
    if (entity.timestamps) {
      for (const ts of entity.timestamps) {
        if (!existing.has(ts)) {
          statements.push(
            `ALTER TABLE ${entity.tableName} ADD COLUMN ${ts} DATETIME DEFAULT CURRENT_TIMESTAMP;`
          )
        }
      }
    }
  }

  return statements
}

// ---------------------------------------------------------------------------
// Internal — table generation
// ---------------------------------------------------------------------------

function generateEntityTable(entity: ResolvedEntityDef): string {
  const columns: string[] = []

  // Primary key
  columns.push('id INTEGER PRIMARY KEY AUTOINCREMENT')

  // Parent FK column (if this entity has a parent)
  if (entity.parentFkColumn && entity.parent) {
    columns.push(
      `${entity.parentFkColumn} INTEGER NOT NULL REFERENCES ${entity.parent}s(id) ON DELETE CASCADE`
    )
  }

  // User-defined fields
  for (const [fieldId, fieldDef] of Object.entries(entity.fields)) {
    // Skip fields that reference engine tables — they're just integer FKs
    if (fieldDef.references) {
      columns.push(referenceColumn(fieldId, fieldDef))
    } else {
      columns.push(columnDefinition(fieldId, fieldDef, true))
    }
  }

  // Timestamp columns
  if (entity.timestamps) {
    for (const ts of entity.timestamps) {
      columns.push(`${ts} DATETIME DEFAULT CURRENT_TIMESTAMP`)
    }
  }

  // Composite unique constraints
  const constraints: string[] = []
  if (entity.unique_together) {
    for (const fields of entity.unique_together) {
      constraints.push(`UNIQUE(${fields.join(', ')})`)
    }
  }

  const allParts = [...columns, ...constraints]

  return `CREATE TABLE IF NOT EXISTS ${entity.tableName} (\n  ${allParts.join(',\n  ')}\n);`
}

function columnDefinition(fieldId: string, field: FieldDef, allowConstraints: boolean): string {
  const parts: string[] = [fieldId, sqliteType(field)]

  if (allowConstraints) {
    if (field.required) parts.push('NOT NULL')
    if (field.unique) parts.push('UNIQUE')

    // CHECK constraint for enum fields
    if (field.kind === 'enum' && field.values && field.values.length > 0) {
      const quoted = field.values.map((v) => `'${v}'`).join(',')
      parts.push(`CHECK(${fieldId} IN (${quoted}))`)
    }

    // Default value
    if (field.default !== undefined) {
      parts.push(`DEFAULT ${sqliteDefault(field.default)}`)
    }
  } else {
    // ALTER TABLE ADD COLUMN — provide default for NOT NULL fields
    if (field.default !== undefined) {
      parts.push(`DEFAULT ${sqliteDefault(field.default)}`)
    }
  }

  return parts.join(' ')
}

function referenceColumn(fieldId: string, field: FieldDef): string {
  // Reference fields are integer FKs. The referenced table is the reference
  // value + 's' (e.g., 'scan' → 'scans', 'service' → 'services').
  const refTable = field.references + 's'
  return `${fieldId} INTEGER REFERENCES ${refTable}(id)`
}

function sqliteType(field: FieldDef): string {
  switch (field.kind) {
    case 'text':
    case 'enum':
    case 'json':
      return 'TEXT'
    case 'integer':
    case 'boolean':
      return 'INTEGER'
    case 'real':
      return 'REAL'
    default:
      return 'TEXT'
  }
}

function sqliteDefault(value: unknown): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
  return `'${String(value)}'`
}

/**
 * Generate an ON CONFLICT upsert clause for an entity's INSERT statement.
 * Used by the generic CRUD create method.
 */
export function generateUpsertSQL(entity: ResolvedEntityDef): string | null {
  if (!entity.on_conflict || entity.on_conflict.strategy !== 'upsert') return null
  if (!entity.unique_together || entity.unique_together.length === 0) return null

  // Use the first unique_together constraint for ON CONFLICT
  const conflictFields = entity.unique_together[0]
  const coalesceFields = entity.on_conflict.coalesce_fields ?? []

  // Build the SET clause for upsert
  const setClauses: string[] = []
  for (const [fieldId] of Object.entries(entity.fields)) {
    if (conflictFields.includes(fieldId)) continue // Don't update conflict key fields

    if (coalesceFields.includes(fieldId)) {
      setClauses.push(`${fieldId} = COALESCE(excluded.${fieldId}, ${entity.tableName}.${fieldId})`)
    } else {
      setClauses.push(`${fieldId} = excluded.${fieldId}`)
    }
  }

  if (setClauses.length === 0) return null

  return `ON CONFLICT(${conflictFields.join(', ')}) DO UPDATE SET\n    ${setClauses.join(',\n    ')}`
}
