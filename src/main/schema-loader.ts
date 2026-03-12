/**
 * Schema loader — loads and validates profile/schema.yaml, producing a
 * ResolvedSchema with enriched entity definitions (table names, FK columns,
 * parent/child relationships).
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as yaml from 'js-yaml'
import { validateEntitySchema } from '@shared/schemas/schema-schema'
import type {
  EntitySchema,
  ResolvedSchema,
  ResolvedEntityDef,
} from '@shared/types/entity'

let cachedSchema: ResolvedSchema | null = null

/**
 * Load and validate the entity schema from profile/schema.yaml.
 * Returns a resolved schema with computed properties (table names, FK columns, child types).
 *
 * @param profileRoot - Absolute path to the profile directory
 * @param schemaPath - Relative path to schema file within profile (default: 'schema.yaml')
 */
export function loadSchema(profileRoot: string, schemaPath: string = 'schema.yaml'): ResolvedSchema {
  if (cachedSchema) return cachedSchema

  const fullPath = join(profileRoot, schemaPath)

  if (!existsSync(fullPath)) {
    throw new Error(`Entity schema not found: ${fullPath}`)
  }

  const raw = readFileSync(fullPath, 'utf-8')
  const data = yaml.load(raw)

  // Validate
  const result = validateEntitySchema(data)
  if (!result.valid) {
    const details = result.errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')
    throw new Error(`Invalid entity schema:\n${details}`)
  }

  const schema = data as EntitySchema
  cachedSchema = resolveSchema(schema)
  return cachedSchema
}

/**
 * Get the loaded schema. Throws if loadSchema() hasn't been called.
 */
export function getSchema(): ResolvedSchema {
  if (!cachedSchema) {
    throw new Error('Entity schema not loaded. Call loadSchema() first.')
  }
  return cachedSchema
}

/**
 * Clear the schema cache (for testing or profile reload).
 */
export function clearSchemaCache(): void {
  cachedSchema = null
}

// ---------------------------------------------------------------------------
// Schema resolution — enrich raw YAML definitions with computed properties
// ---------------------------------------------------------------------------

function resolveSchema(raw: EntitySchema): ResolvedSchema {
  const resolved: Record<string, ResolvedEntityDef> = {}

  // First pass: create resolved entities with basic computed properties
  for (const [entityId, entityDef] of Object.entries(raw.entities)) {
    resolved[entityId] = {
      ...entityDef,
      id: entityId,
      tableName: entityId + 's',
      parentFkColumn: entityDef.parent ? entityDef.parent + '_id' : null,
      childTypes: []
    }
  }

  // Second pass: populate childTypes from parent references
  for (const [entityId, entityDef] of Object.entries(raw.entities)) {
    if (entityDef.parent && resolved[entityDef.parent]) {
      resolved[entityDef.parent].childTypes.push(entityId)
    }
  }

  // Validate no circular parent chains
  for (const entityId of Object.keys(resolved)) {
    const visited = new Set<string>()
    let current: string | undefined = entityId
    while (current) {
      if (visited.has(current)) {
        throw new Error(`Circular parent chain detected: ${Array.from(visited).join(' -> ')} -> ${current}`)
      }
      visited.add(current)
      current = resolved[current]?.parent
    }
  }

  return {
    version: raw.schema_version,
    primaryEntity: raw.primary_entity,
    entities: resolved,
    extractionPatterns: raw.extraction_patterns ?? []
  }
}
