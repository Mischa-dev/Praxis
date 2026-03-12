// Schema utility functions for the generic entity UI

import type { ResolvedEntityDef, FieldDef, EntityRecord } from '@shared/types/entity'

/** Get the display field value for an entity (the field with role: display) */
export function getDisplayValue(entity: EntityRecord, def: ResolvedEntityDef): string {
  for (const [fieldId, fieldDef] of Object.entries(def.fields)) {
    if (fieldDef.role === 'display') {
      return String(entity[fieldId] ?? '')
    }
  }
  // Fallback: try common fields
  return String(entity.value ?? entity.title ?? entity.name ?? entity.id ?? '')
}

/** Get the status field value for an entity (the field with role: status) */
export function getStatusValue(entity: EntityRecord, def: ResolvedEntityDef): string | null {
  for (const [fieldId, fieldDef] of Object.entries(def.fields)) {
    if (fieldDef.role === 'status') {
      const val = entity[fieldId]
      return val != null ? String(val) : null
    }
  }
  return null
}

/** Get the category field value (the field with role: category) */
export function getCategoryValue(entity: EntityRecord, def: ResolvedEntityDef): string | null {
  for (const [fieldId, fieldDef] of Object.entries(def.fields)) {
    if (fieldDef.role === 'category') {
      const val = entity[fieldId]
      return val != null ? String(val) : null
    }
  }
  return null
}

/** Get the status field definition */
export function getStatusFieldDef(def: ResolvedEntityDef): [string, FieldDef] | null {
  for (const [fieldId, fieldDef] of Object.entries(def.fields)) {
    if (fieldDef.role === 'status') {
      return [fieldId, fieldDef]
    }
  }
  return null
}

/** Get visible fields for table/card display (excludes internal fields like json, references) */
export function getVisibleFields(def: ResolvedEntityDef): [string, FieldDef][] {
  return Object.entries(def.fields).filter(([fieldId, fieldDef]) => {
    // Skip FK references and JSON blobs in table view
    if (fieldDef.references) return false
    if (fieldDef.kind === 'json') return false
    // Skip parent FK column
    if (fieldId === def.parentFkColumn) return false
    return true
  })
}

/** Get fields suitable for table columns */
export function getTableColumns(def: ResolvedEntityDef): { key: string; label: string; kind: string }[] {
  return getVisibleFields(def).map(([fieldId, fieldDef]) => ({
    key: fieldId,
    label: fieldIdToLabel(fieldId),
    kind: fieldDef.kind
  }))
}

/** Convert a field_id to a human-readable label */
export function fieldIdToLabel(fieldId: string): string {
  return fieldId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Format a field value for display */
export function formatFieldValue(value: unknown, fieldDef: FieldDef): string {
  if (value === null || value === undefined) return '—'
  if (fieldDef.kind === 'boolean') return value ? 'Yes' : 'No'
  if (fieldDef.kind === 'json') {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      if (Array.isArray(parsed)) return parsed.join(', ')
      return JSON.stringify(parsed)
    } catch {
      return String(value)
    }
  }
  return String(value)
}
