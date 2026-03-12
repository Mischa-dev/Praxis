// Schema-driven form — generates form fields from entity field definitions

import { useState } from 'react'
import type { ResolvedEntityDef } from '@shared/types/entity'
import { SchemaField } from './SchemaField'
import { Button } from '../common'

interface SchemaFormProps {
  entityDef: ResolvedEntityDef
  /** Initial values (for edit mode) */
  initialValues?: Record<string, unknown>
  /** Fields to exclude from the form */
  excludeFields?: string[]
  onSubmit: (data: Record<string, unknown>) => void
  onCancel?: () => void
  submitLabel?: string
  loading?: boolean
}

export function SchemaForm({
  entityDef,
  initialValues,
  excludeFields = [],
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  loading
}: SchemaFormProps): React.JSX.Element {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {}
    for (const [fieldId, fieldDef] of Object.entries(entityDef.fields)) {
      initial[fieldId] = initialValues?.[fieldId] ?? fieldDef.default ?? null
    }
    return initial
  })

  const handleChange = (fieldId: string, value: unknown): void => {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    // Filter out null/undefined values and excluded fields
    const data: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(values)) {
      if (excludeFields.includes(key)) continue
      if (val !== null && val !== undefined && val !== '') {
        data[key] = val
      }
    }
    onSubmit(data)
  }

  // Get form-relevant fields (skip references, parent FK, timestamps)
  const formFields = Object.entries(entityDef.fields).filter(([fieldId, fieldDef]) => {
    if (excludeFields.includes(fieldId)) return false
    if (fieldDef.references) return false
    if (fieldId === entityDef.parentFkColumn) return false
    return true
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {formFields.map(([fieldId, fieldDef]) => (
        <SchemaField
          key={fieldId}
          fieldId={fieldId}
          fieldDef={fieldDef}
          value={values[fieldId]}
          onChange={(val) => handleChange(fieldId, val)}
          disabled={loading}
        />
      ))}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} type="button">
            Cancel
          </Button>
        )}
        <Button variant="primary" size="sm" type="submit" disabled={loading}>
          {loading ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
