// Add entity dialog — smart input with auto-detection for the primary entity type

import { useState } from 'react'
import type { ResolvedEntityDef } from '@shared/types/entity'
import { Dialog, Input, Button } from '../common'
import { SchemaForm } from './SchemaForm'

interface AddEntityDialogProps {
  open: boolean
  onClose: () => void
  entityDef: ResolvedEntityDef
  onAdd: (data: Record<string, unknown>) => Promise<void>
}

export function AddEntityDialog({
  open,
  onClose,
  entityDef,
  onAdd
}: AddEntityDialogProps): React.JSX.Element {
  const [quickInput, setQuickInput] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasAutoDetect = entityDef.auto_detect && entityDef.auto_detect.length > 0

  const handleQuickAdd = async (): Promise<void> => {
    if (!quickInput.trim()) return
    setLoading(true)
    setError(null)

    try {
      const data: Record<string, unknown> = {}

      // Find the display role field and set it
      for (const [fieldId, fieldDef] of Object.entries(entityDef.fields)) {
        if (fieldDef.role === 'display') {
          data[fieldId] = quickInput.trim()
          break
        }
      }

      // Auto-detect type from patterns
      if (entityDef.auto_detect) {
        for (const [fieldId, fieldDef] of Object.entries(entityDef.fields)) {
          if (fieldDef.role === 'category') {
            const detectedType = detectType(quickInput.trim(), entityDef.auto_detect)
            if (detectedType) {
              data[fieldId] = detectedType
            }
            break
          }
        }
      }

      await onAdd(data)
      setQuickInput('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entity')
    } finally {
      setLoading(false)
    }
  }

  const handleAdvancedAdd = async (data: Record<string, unknown>): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      await onAdd(data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entity')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Add ${entityDef.label}`}>
      <div className="space-y-4">
        {error && (
          <div className="text-xs text-error bg-error/10 rounded px-3 py-2">{error}</div>
        )}

        {!showAdvanced && hasAutoDetect ? (
          <>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder={`Enter ${entityDef.label.toLowerCase()}...`}
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQuickAdd()
                }}
                autoFocus
                disabled={loading}
              />
              <Button variant="primary" size="sm" onClick={handleQuickAdd} disabled={loading || !quickInput.trim()}>
                Add
              </Button>
            </div>
            <button
              className="text-xs text-text-muted hover:text-accent transition-colors"
              onClick={() => setShowAdvanced(true)}
            >
              Advanced...
            </button>
          </>
        ) : (
          <SchemaForm
            entityDef={entityDef}
            onSubmit={handleAdvancedAdd}
            onCancel={onClose}
            submitLabel={`Add ${entityDef.label}`}
            loading={loading}
            excludeFields={entityDef.parentFkColumn ? [entityDef.parentFkColumn] : []}
          />
        )}
      </div>
    </Dialog>
  )
}

function detectType(
  value: string,
  rules: { type_value: string; pattern: string }[]
): string | null {
  for (const rule of rules) {
    try {
      if (new RegExp(rule.pattern).test(value)) {
        return rule.type_value
      }
    } catch {
      continue
    }
  }
  return null
}
