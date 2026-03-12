// Schema-driven form field — renders the appropriate input based on FieldDef.kind

import type { FieldDef } from '@shared/types/entity'
import { Input, Select, Toggle } from '../common'
import { fieldIdToLabel } from '../../lib/schema-utils'

interface SchemaFieldProps {
  fieldId: string
  fieldDef: FieldDef
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}

export function SchemaField({ fieldId, fieldDef, value, onChange, disabled }: SchemaFieldProps): React.JSX.Element {
  const label = fieldIdToLabel(fieldId)

  switch (fieldDef.kind) {
    case 'text':
      return (
        <Input
          label={label}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={fieldDef.required}
          placeholder={fieldDef.pattern ? `Pattern: ${fieldDef.pattern}` : undefined}
          disabled={disabled}
        />
      )

    case 'integer':
    case 'real':
      return (
        <Input
          label={label}
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) => {
            const v = e.target.value
            onChange(v === '' ? null : fieldDef.kind === 'integer' ? parseInt(v, 10) : parseFloat(v))
          }}
          required={fieldDef.required}
          min={fieldDef.min}
          max={fieldDef.max}
          disabled={disabled}
        />
      )

    case 'enum':
      return (
        <Select
          label={label}
          value={String(value ?? fieldDef.default ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={fieldDef.required}
          disabled={disabled}
          options={(fieldDef.values ?? []).map((v) => ({ value: v, label: v }))}
        />
      )

    case 'boolean':
      return (
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-text-secondary font-mono">{label}</span>
          <Toggle
            checked={!!value}
            onChange={(checked) => onChange(checked ? 1 : 0)}
            disabled={disabled}
          />
        </div>
      )

    case 'json':
      return (
        <div className="space-y-1">
          <label className="text-xs text-text-secondary font-mono">{label}</label>
          <textarea
            className="w-full bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary font-mono resize-y min-h-[60px]"
            value={typeof value === 'string' ? value : JSON.stringify(value ?? '', null, 2)}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      )

    default:
      return (
        <Input
          label={label}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )
  }
}
