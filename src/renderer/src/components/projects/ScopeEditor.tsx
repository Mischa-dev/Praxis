import { useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, Input } from '../common'

interface ScopeEditorProps {
  inScope: string[]
  outOfScope: string[]
  onChange: (scope: { inScope: string[]; outOfScope: string[] }) => void
}

function ScopeList({
  label,
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string
  items: string[]
  onAdd: (value: string) => void
  onRemove: (index: number) => void
  placeholder: string
}) {
  const [value, setValue] = useState('')

  const handleAdd = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed && !items.includes(trimmed)) {
      onAdd(trimmed)
      setValue('')
    }
  }, [value, items, onAdd])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAdd()
      }
    },
    [handleAdd]
  )

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-text-secondary font-sans uppercase tracking-wider">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAdd}
          disabled={!value.trim()}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-bg-elevated border border-border text-text-secondary"
            >
              {item}
              <button
                onClick={() => onRemove(i)}
                className="hover:text-error transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {items.length === 0 && (
        <p className="text-[10px] text-text-muted font-sans">No entries yet</p>
      )}
    </div>
  )
}

export function ScopeEditor({ inScope, outOfScope, onChange }: ScopeEditorProps) {
  const handleAddIn = useCallback(
    (value: string) => onChange({ inScope: [...inScope, value], outOfScope }),
    [inScope, outOfScope, onChange]
  )

  const handleRemoveIn = useCallback(
    (index: number) =>
      onChange({ inScope: inScope.filter((_, i) => i !== index), outOfScope }),
    [inScope, outOfScope, onChange]
  )

  const handleAddOut = useCallback(
    (value: string) => onChange({ inScope, outOfScope: [...outOfScope, value] }),
    [inScope, outOfScope, onChange]
  )

  const handleRemoveOut = useCallback(
    (index: number) =>
      onChange({ inScope, outOfScope: outOfScope.filter((_, i) => i !== index) }),
    [inScope, outOfScope, onChange]
  )

  return (
    <div className="flex flex-col gap-4">
      <ScopeList
        label="In-scope targets / ranges"
        items={inScope}
        onAdd={handleAddIn}
        onRemove={handleRemoveIn}
        placeholder="e.g. 192.168.1.0/24, example.com"
      />
      <ScopeList
        label="Out-of-scope exclusions"
        items={outOfScope}
        onAdd={handleAddOut}
        onRemove={handleRemoveOut}
        placeholder="e.g. 192.168.1.1, prod.example.com"
      />
    </div>
  )
}
