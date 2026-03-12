import { useState } from 'react'
import { Button, Input, Dialog } from '../common'
import type { Pipeline } from '@shared/types/pipeline'

export function SaveDialog({
  pipeline,
  onClose,
  onSave,
}: {
  pipeline: Pipeline | null
  onClose: () => void
  onSave: (name: string, description: string) => void
}) {
  const [name, setName] = useState(pipeline?.name ?? '')
  const [description, setDescription] = useState(pipeline?.description ?? '')

  return (
    <Dialog open onClose={onClose} title={pipeline ? 'Update Pipeline' : 'Save Pipeline'}>
      <div className="space-y-3">
        <Input
          label="Pipeline Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Custom Pipeline"
          autoFocus
        />
        <div>
          <label className="block text-xs text-text-secondary mb-1">Description</label>
          <textarea
            className="w-full bg-bg-input border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none resize-y min-h-[60px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this pipeline does..."
            rows={3}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(name, description)} disabled={!name.trim()}>
          {pipeline ? 'Update' : 'Save'}
        </Button>
      </div>
    </Dialog>
  )
}
