// Quick-add section for the context panel — schema-driven entity creation

import { useState } from 'react'
import { Plus, Loader2, AlertTriangle } from 'lucide-react'
import { useEntityStore, selectPrimaryType } from '../../stores/entity-store'

export function QuickAddSection(): React.JSX.Element | null {
  const primaryType = useEntityStore(selectPrimaryType)
  const createEntity = useEntityStore((s) => s.createEntity)
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity)
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!primaryType) return null

  // Find the display field
  const displayFieldId = Object.entries(primaryType.fields).find(
    ([, f]) => f.role === 'display'
  )?.[0]

  if (!displayFieldId) return null

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return

    setAdding(true)
    setError(null)
    try {
      // Build data using auto_detect if available
      const data: Record<string, unknown> = { [displayFieldId]: trimmed }

      if (primaryType.auto_detect) {
        for (const rule of primaryType.auto_detect) {
          if (new RegExp(rule.pattern).test(trimmed)) {
            // Find the category field to assign the detected type
            const categoryFieldId = Object.entries(primaryType.fields).find(
              ([, f]) => f.role === 'category'
            )?.[0]
            if (categoryFieldId) {
              data[categoryFieldId] = rule.type_value
            }
            break
          }
        }
      }

      const entity = await createEntity(primaryType.id, data)
      setActiveEntity(entity.id)
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <span className="text-[10px] font-sans uppercase tracking-wider text-text-muted block mb-1.5">
        Quick Add
      </span>
      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          placeholder={`Add ${primaryType.label.toLowerCase()}...`}
          className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono bg-bg-input border border-border rounded
                     text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:ring-1 focus:ring-accent"
          disabled={adding}
        />
        <button
          type="submit"
          disabled={adding || !value.trim()}
          className="p-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={`Add ${primaryType.label.toLowerCase()}`}
        >
          {adding ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
        </button>
      </form>
      {error && (
        <span className="text-[9px] text-error flex items-center gap-0.5 mt-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </span>
      )}
    </div>
  )
}
