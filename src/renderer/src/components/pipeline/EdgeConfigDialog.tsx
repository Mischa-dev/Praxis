import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Dialog } from '../common'
import type { DataMappingEntry } from '@shared/types/pipeline'

interface EdgeConfigDialogProps {
  sourceNodeLabel: string
  targetNodeLabel: string
  mappings: DataMappingEntry[]
  onClose: () => void
  onSave: (mappings: DataMappingEntry[]) => void
}

export function EdgeConfigDialog({
  sourceNodeLabel,
  targetNodeLabel,
  mappings: initialMappings,
  onClose,
  onSave,
}: EdgeConfigDialogProps) {
  const [mappings, setMappings] = useState<DataMappingEntry[]>(
    initialMappings.length > 0 ? initialMappings : [{ sourceExpression: '', targetArg: '' }]
  )

  const addRow = () => {
    setMappings([...mappings, { sourceExpression: '', targetArg: '' }])
  }

  const removeRow = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index))
  }

  const updateRow = (index: number, field: keyof DataMappingEntry, value: string) => {
    setMappings(mappings.map((m, i) => (i === index ? { ...m, [field]: value } : m)))
  }

  const validMappings = mappings.filter(
    (m) => m.sourceExpression.trim() && m.targetArg.trim()
  )

  return (
    <Dialog open onClose={onClose} title="Configure Data Mapping">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="font-mono text-accent-primary">{sourceNodeLabel}</span>
          <span>→</span>
          <span className="font-mono text-accent-primary">{targetNodeLabel}</span>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {mappings.map((mapping, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="flex-1 bg-bg-input border border-border rounded px-2 py-1.5 text-xs text-text-primary font-mono focus:border-accent-primary focus:outline-none"
                value={mapping.sourceExpression}
                onChange={(e) => updateRow(i, 'sourceExpression', e.target.value)}
                placeholder="nodes.source.results.services"
              />
              <span className="text-text-muted text-xs">→</span>
              <input
                className="w-32 bg-bg-input border border-border rounded px-2 py-1.5 text-xs text-text-primary font-mono focus:border-accent-primary focus:outline-none"
                value={mapping.targetArg}
                onChange={(e) => updateRow(i, 'targetArg', e.target.value)}
                placeholder="target_arg"
              />
              <button
                className="p-1 text-text-muted hover:text-red-400 transition-colors"
                onClick={() => removeRow(i)}
                title="Remove mapping"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={addRow}>
          <Plus size={12} className="mr-1" />
          Add Mapping
        </Button>
      </div>

      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => { onSave(validMappings); onClose() }}>
          Apply
        </Button>
      </div>
    </Dialog>
  )
}
