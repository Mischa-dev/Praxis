import { useState, useCallback, useRef, useEffect } from 'react'
import { detectTargetType } from '../../stores/target-store'
import { Dialog, DialogFooter, Input, Button, Badge } from '../common'
import type { TargetType } from '@shared/types'

interface AddTargetDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (value: string, label?: string) => Promise<void>
}

const typeLabels: Record<TargetType, string> = {
  ip: 'IP Address',
  cidr: 'CIDR Range',
  hostname: 'Hostname',
  domain: 'Domain',
  url: 'URL',
  email: 'Email'
}

export function AddTargetDialog({ open, onClose, onAdd }: AddTargetDialogProps) {
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when dialog opens
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [open])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setValue('')
      setLabel('')
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  const detectedType = value.trim() ? detectTargetType(value) : null

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Target value is required')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onAdd(trimmed, label.trim() || undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add target')
    } finally {
      setSubmitting(false)
    }
  }, [value, label, onAdd, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !submitting) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, submitting]
  )

  return (
    <Dialog open={open} onClose={onClose} title="Add Target" description="Enter an IP, domain, URL, CIDR range, or hostname.">
      <div className="space-y-4" onKeyDown={handleKeyDown}>
        <div>
          <Input
            ref={inputRef}
            label="Target"
            placeholder="e.g. 10.10.10.1, example.com, http://..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={error ?? undefined}
          />
          {detectedType && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-text-muted">Detected:</span>
              <Badge variant="accent" className="text-[10px]">{typeLabels[detectedType]}</Badge>
            </div>
          )}
        </div>

        <Input
          label="Label (optional)"
          placeholder="e.g. Web Server, DC01, Mail Gateway"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          hint="A friendly name to help identify this target"
        />

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={submitting} disabled={!value.trim()}>
            Add Target
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}
