/**
 * CommandPreview — live-updating command preview with syntax highlighting.
 *
 * Features:
 * - Syntax highlighting: binary (green), flags (cyan), values (white), positional (amber)
 * - Hover tooltips on each segment explaining what it does (via FlagTooltip)
 * - Toggle to editable raw text mode for manual tweaking
 * - Copy button to copy the full command string
 * - Live-updates as form values change
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Copy, Check, Pencil, Eye } from 'lucide-react'
import type { Module } from '@shared/types/module'
import { buildCommand, segmentsToString, type CommandSegment } from '../../lib/command-builder'
import { FlagTooltip } from './FlagTooltip'

interface CommandPreviewProps {
  module: Module
  formValues: Record<string, unknown>
  /** Called when user edits command in raw mode — passes the raw string */
  onCommandEdit?: (command: string) => void
}

const roleClasses: Record<string, string> = {
  binary: 'text-accent-primary font-semibold',
  flag: 'text-[#00d4ff]',
  value: 'text-text-primary',
  positional: 'text-[#ffb000]',
  separator: 'text-text-muted'
}

export function CommandPreview({
  module: mod,
  formValues,
  onCommandEdit
}: CommandPreviewProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editValue, setEditValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Build segments from current form values
  const segments = useMemo(() => buildCommand(mod, formValues), [mod, formValues])
  const commandString = useMemo(() => segmentsToString(segments), [segments])

  // Sync edit value when switching to edit mode or when command changes while not editing
  useEffect(() => {
    if (!editMode) {
      setEditValue(commandString)
    }
  }, [commandString, editMode])

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editMode && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      )
    }
  }, [editMode])

  const handleCopy = useCallback(async () => {
    const text = editMode ? editValue : commandString
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [editMode, editValue, commandString])

  const handleToggleEdit = useCallback(() => {
    if (editMode) {
      // Exiting edit mode — notify parent of manual edits
      if (editValue !== commandString) {
        onCommandEdit?.(editValue)
      }
    } else {
      setEditValue(commandString)
    }
    setEditMode(!editMode)
  }, [editMode, editValue, commandString, onCommandEdit])

  const handleEditChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditValue(e.target.value)
      // Auto-resize
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      }
    },
    []
  )

  // Don't show preview if no segments beyond the binary
  const hasArgs = segments.length > (mod.requiresRoot ? 2 : 1)

  return (
    <div className="rounded-md border border-border bg-bg-primary overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-elevated border-b border-border">
        <span className="text-[10px] font-sans uppercase tracking-widest text-text-muted">
          Command Preview
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleEdit}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-primary/50 transition-colors"
            title={editMode ? 'View highlighted' : 'Edit command'}
          >
            {editMode ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-primary/50 transition-colors"
            title="Copy command"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-accent-primary" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Command body */}
      <div className="px-3 py-2.5 min-h-[2.5rem]">
        {editMode ? (
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={handleEditChange}
            spellCheck={false}
            className="w-full bg-transparent text-sm font-mono text-text-primary resize-none outline-none leading-relaxed"
            rows={1}
            style={{ minHeight: '1.5rem' }}
          />
        ) : (
          <div className="font-mono text-sm leading-relaxed flex flex-wrap gap-x-1.5 gap-y-0.5 items-baseline">
            {segments.map((seg, i) => (
              <SegmentSpan key={`${seg.argId ?? 'bin'}-${i}`} segment={seg} />
            ))}
            {!hasArgs && (
              <span className="text-text-muted italic text-xs ml-1">
                (configure options above)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** A single highlighted segment with an optional tooltip. */
function SegmentSpan({ segment }: { segment: CommandSegment }): React.JSX.Element {
  const cls = roleClasses[segment.role] ?? 'text-text-primary'

  // Binary segments don't need tooltips
  if (segment.role === 'binary') {
    return <span className={cls}>{segment.text}</span>
  }

  return (
    <FlagTooltip argName={segment.argName} help={segment.help}>
      <span className={`${cls} cursor-default hover:underline hover:decoration-dotted hover:underline-offset-4 hover:decoration-text-muted/40`}>
        {segment.text}
      </span>
    </FlagTooltip>
  )
}
