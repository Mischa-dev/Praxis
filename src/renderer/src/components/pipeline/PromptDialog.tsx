import { useState } from 'react'
import { Button, Dialog } from '../common'
import type { PipelinePromptEvent } from '@shared/types/ipc'

interface PromptDialogProps {
  prompt: PipelinePromptEvent
  onClose: () => void
}

export function PromptDialog({ prompt, onClose }: PromptDialogProps) {
  const [textValue, setTextValue] = useState(prompt.default ?? '')
  const [selectValue, setSelectValue] = useState(prompt.default ?? prompt.options?.[0] ?? '')

  const handleSubmit = (value: string | boolean) => {
    window.api.invoke('pipeline:prompt-response', {
      runId: prompt.runId,
      nodeId: prompt.nodeId,
      value
    })
    onClose()
  }

  return (
    <Dialog open onClose={() => {}} title="Pipeline Input Required">
      <div className="space-y-4">
        <p className="text-sm text-text-primary">{prompt.message}</p>

        {prompt.type === 'confirm' && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => handleSubmit(false)}>
              No
            </Button>
            <Button size="sm" onClick={() => handleSubmit(true)}>
              Yes
            </Button>
          </div>
        )}

        {prompt.type === 'text' && (
          <>
            <input
              type="text"
              className="w-full bg-bg-input border border-border rounded px-3 py-2 text-sm text-text-primary font-mono focus:border-accent-primary focus:outline-none"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={prompt.default ?? 'Enter a value...'}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit(textValue)
              }}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => handleSubmit(textValue)}>
                Submit
              </Button>
            </div>
          </>
        )}

        {prompt.type === 'select' && prompt.options && (
          <>
            <select
              className="w-full bg-bg-input border border-border rounded px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              value={selectValue}
              onChange={(e) => setSelectValue(e.target.value)}
            >
              {prompt.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => handleSubmit(selectValue)}>
                Submit
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
