// Entity schema YAML validation — validates profile/schema.yaml at load time

import {
  type ValidationResult,
  type ValidationError,
  requireString,
  requireObject,
  optionalString,
  optionalBoolean,
  optionalNumber,
  makeResult
} from './validate'

const FIELD_KINDS = ['text', 'integer', 'real', 'boolean', 'enum', 'json']
const FIELD_ROLES = ['display', 'status', 'category']
const CONFLICT_STRATEGIES = ['upsert', 'ignore', 'replace']

export function validateEntitySchema(data: unknown): ValidationResult {
  const errors: ValidationError[] = []
  const root = 'schema'

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push({ path: root, message: 'Schema must be an object' })
    return makeResult(errors)
  }

  const obj = data as Record<string, unknown>

  // schema_version
  if (typeof obj.schema_version !== 'number' || obj.schema_version < 1) {
    errors.push({ path: `${root}.schema_version`, message: 'schema_version must be a positive number' })
  }

  // primary_entity
  requireString(obj, 'primary_entity', root, errors)

  // entities
  requireObject(obj, 'entities', root, errors)
  if (typeof obj.entities !== 'object' || obj.entities === null || Array.isArray(obj.entities)) {
    return makeResult(errors)
  }

  const entities = obj.entities as Record<string, unknown>
  const entityIds = Object.keys(entities)

  // Validate primary_entity references a real entity
  if (typeof obj.primary_entity === 'string' && !entityIds.includes(obj.primary_entity)) {
    errors.push({
      path: `${root}.primary_entity`,
      message: `primary_entity "${obj.primary_entity}" does not match any entity in entities`
    })
  }

  // Validate each entity definition
  for (const [entityId, entityData] of Object.entries(entities)) {
    validateEntityDef(entityId, entityData, entityIds, `${root}.entities.${entityId}`, errors)
  }

  // Validate extraction_patterns (optional)
  if ('extraction_patterns' in obj && obj.extraction_patterns !== undefined) {
    if (!Array.isArray(obj.extraction_patterns)) {
      errors.push({ path: `${root}.extraction_patterns`, message: 'extraction_patterns must be an array' })
    } else {
      for (let i = 0; i < obj.extraction_patterns.length; i++) {
        const ep = obj.extraction_patterns[i]
        const path = `${root}.extraction_patterns[${i}]`
        if (typeof ep !== 'object' || ep === null) {
          errors.push({ path, message: 'Extraction pattern must be an object' })
          continue
        }
        const p = ep as Record<string, unknown>
        requireString(p, 'type', path, errors)
        requireString(p, 'pattern', path, errors)
        // Validate regex compiles
        if (typeof p.pattern === 'string') {
          try {
            new RegExp(p.pattern)
          } catch {
            errors.push({ path: `${path}.pattern`, message: `Invalid regex: ${p.pattern}` })
          }
        }
      }
    }
  }

  return makeResult(errors)
}

function validateEntityDef(
  entityId: string,
  data: unknown,
  allEntityIds: string[],
  path: string,
  errors: ValidationError[]
): void {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push({ path, message: 'Entity definition must be an object' })
    return
  }

  const entity = data as Record<string, unknown>

  requireString(entity, 'label', path, errors)
  requireString(entity, 'label_plural', path, errors)
  requireString(entity, 'icon', path, errors)

  // parent (optional FK to another entity)
  if ('parent' in entity && entity.parent !== undefined) {
    if (typeof entity.parent !== 'string') {
      errors.push({ path: `${path}.parent`, message: 'parent must be a string' })
    } else if (!allEntityIds.includes(entity.parent)) {
      errors.push({ path: `${path}.parent`, message: `parent "${entity.parent}" does not match any entity` })
    } else if (entity.parent === entityId) {
      errors.push({ path: `${path}.parent`, message: 'entity cannot be its own parent' })
    }
  }

  // fields (required)
  requireObject(entity, 'fields', path, errors)
  if (typeof entity.fields === 'object' && entity.fields !== null && !Array.isArray(entity.fields)) {
    const fields = entity.fields as Record<string, unknown>
    let displayCount = 0

    for (const [fieldId, fieldData] of Object.entries(fields)) {
      validateFieldDef(fieldId, fieldData, `${path}.fields.${fieldId}`, errors)

      // Count display role fields
      if (typeof fieldData === 'object' && fieldData !== null) {
        const f = fieldData as Record<string, unknown>
        if (f.role === 'display') displayCount++
      }
    }

    if (displayCount > 1) {
      errors.push({ path: `${path}.fields`, message: 'At most one field can have role: display' })
    }
  }

  // timestamps (optional array of strings)
  if ('timestamps' in entity && entity.timestamps !== undefined) {
    if (!Array.isArray(entity.timestamps)) {
      errors.push({ path: `${path}.timestamps`, message: 'timestamps must be an array' })
    }
  }

  // searchable (optional array of strings)
  if ('searchable' in entity && entity.searchable !== undefined) {
    if (!Array.isArray(entity.searchable)) {
      errors.push({ path: `${path}.searchable`, message: 'searchable must be an array' })
    }
  }

  // unique_together (optional array of string arrays)
  if ('unique_together' in entity && entity.unique_together !== undefined) {
    if (!Array.isArray(entity.unique_together)) {
      errors.push({ path: `${path}.unique_together`, message: 'unique_together must be an array' })
    } else {
      for (let i = 0; i < entity.unique_together.length; i++) {
        const constraint = entity.unique_together[i]
        if (!Array.isArray(constraint)) {
          errors.push({ path: `${path}.unique_together[${i}]`, message: 'Each constraint must be an array of field names' })
        }
      }
    }
  }

  // on_conflict (optional)
  if ('on_conflict' in entity && entity.on_conflict !== undefined) {
    if (typeof entity.on_conflict !== 'object' || entity.on_conflict === null) {
      errors.push({ path: `${path}.on_conflict`, message: 'on_conflict must be an object' })
    } else {
      const oc = entity.on_conflict as Record<string, unknown>
      if (typeof oc.strategy !== 'string' || !CONFLICT_STRATEGIES.includes(oc.strategy)) {
        errors.push({ path: `${path}.on_conflict.strategy`, message: `strategy must be one of: ${CONFLICT_STRATEGIES.join(', ')}` })
      }
    }
  }

  // auto_detect (optional array)
  if ('auto_detect' in entity && entity.auto_detect !== undefined) {
    if (!Array.isArray(entity.auto_detect)) {
      errors.push({ path: `${path}.auto_detect`, message: 'auto_detect must be an array' })
    } else {
      for (let i = 0; i < entity.auto_detect.length; i++) {
        const rule = entity.auto_detect[i]
        const rp = `${path}.auto_detect[${i}]`
        if (typeof rule !== 'object' || rule === null) {
          errors.push({ path: rp, message: 'Auto-detect rule must be an object' })
          continue
        }
        const r = rule as Record<string, unknown>
        requireString(r, 'type_value', rp, errors)
        requireString(r, 'pattern', rp, errors)
        if (typeof r.pattern === 'string') {
          try {
            new RegExp(r.pattern)
          } catch {
            errors.push({ path: `${rp}.pattern`, message: `Invalid regex: ${r.pattern}` })
          }
        }
      }
    }
  }
}

function validateFieldDef(
  _fieldId: string,
  data: unknown,
  path: string,
  errors: ValidationError[]
): void {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push({ path, message: 'Field definition must be an object' })
    return
  }

  const field = data as Record<string, unknown>

  // kind (required)
  if (typeof field.kind !== 'string' || !FIELD_KINDS.includes(field.kind)) {
    errors.push({ path: `${path}.kind`, message: `kind must be one of: ${FIELD_KINDS.join(', ')}` })
  }

  // role (optional)
  if ('role' in field && field.role !== undefined) {
    if (typeof field.role !== 'string' || !FIELD_ROLES.includes(field.role)) {
      errors.push({ path: `${path}.role`, message: `role must be one of: ${FIELD_ROLES.join(', ')}` })
    }
  }

  // enum values (required if kind is enum)
  if (field.kind === 'enum') {
    if (!Array.isArray(field.values) || field.values.length === 0) {
      errors.push({ path: `${path}.values`, message: 'enum fields must have a non-empty values array' })
    }
  }

  optionalBoolean(field, 'required', path, errors)
  optionalBoolean(field, 'unique', path, errors)
  optionalString(field, 'pattern', path, errors)
  optionalString(field, 'references', path, errors)
  optionalNumber(field, 'min', path, errors)
  optionalNumber(field, 'max', path, errors)
}
