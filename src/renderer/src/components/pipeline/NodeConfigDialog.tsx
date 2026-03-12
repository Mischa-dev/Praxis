import { useState, useMemo } from 'react'
import type { Node } from '@xyflow/react'
import { Button, Dialog } from '../common'
import type { Module } from '@shared/types'
import type { ToolNodeData, ConditionNodeData, ForEachNodeData, DelayNodeData, StartNodeData, NoteNodeData } from './types'
import { useEntityStore, selectPrimaryType } from '../../stores/entity-store'
import { getDisplayValue } from '../../lib/schema-utils'
import type { EntityRecord } from '@shared/types/entity'

const EMPTY_ENTITIES: EntityRecord[] = []

// ---------------------------------------------------------------------------
// Tool config dialog (existing, extracted)
// ---------------------------------------------------------------------------

export function ToolConfigDialog({
  node,
  module,
  onClose,
  onSave,
}: {
  node: Node
  module: Module | undefined
  onClose: () => void
  onSave: (args: Record<string, unknown>) => void
}) {
  const data = node.data as unknown as ToolNodeData
  const [args, setArgs] = useState<Record<string, unknown>>(data.args ?? {})

  const visibleArgs = useMemo(
    () => module?.arguments?.filter((a) => a.type !== 'hidden') ?? [],
    [module],
  )

  return (
    <Dialog open onClose={onClose} title={`Configure: ${data.label}`}>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {visibleArgs.length === 0 && (
          <p className="text-sm text-text-secondary">No configurable arguments for this tool.</p>
        )}
        {visibleArgs.map((arg) => (
          <div key={arg.id}>
            <label className="block text-xs text-text-secondary mb-1">
              {arg.name}
              {arg.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {arg.type === 'select' ? (
              <select
                className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                value={(args[arg.id] as string) ?? arg.default ?? ''}
                onChange={(e) => setArgs({ ...args, [arg.id]: e.target.value })}
              >
                <option value="">-- Select --</option>
                {arg.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : arg.type === 'toggle' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(args[arg.id] ?? arg.default)}
                  onChange={(e) => setArgs({ ...args, [arg.id]: e.target.checked })}
                  className="accent-accent-primary"
                />
                <span className="text-text-secondary">{arg.help ?? 'Enable'}</span>
              </label>
            ) : (
              <input
                type={arg.type === 'number' || arg.type === 'port' ? 'number' : 'text'}
                className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                value={(args[arg.id] as string) ?? ''}
                placeholder={arg.default != null ? String(arg.default) : arg.help ?? ''}
                onChange={(e) => setArgs({ ...args, [arg.id]: e.target.value })}
              />
            )}
            {arg.help && <p className="text-[10px] text-text-muted mt-0.5">{arg.help}</p>}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            onSave(args)
            onClose()
          }}
        >
          Apply
        </Button>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Condition config dialog
// ---------------------------------------------------------------------------

export function ConditionConfigDialog({
  node,
  onClose,
  onSave,
}: {
  node: Node
  onClose: () => void
  onSave: (data: Partial<ConditionNodeData>) => void
}) {
  const data = node.data as unknown as ConditionNodeData
  const [expression, setExpression] = useState(data.expression ?? '')
  const [label, setLabel] = useState(data.label ?? '')

  return (
    <Dialog open onClose={onClose} title="Configure Condition">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Label</label>
          <input
            className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Has open ports?"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            Expression <span className="text-red-400">*</span>
          </label>
          <input
            className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono focus:border-accent-primary focus:outline-none"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="e.g., nodes.scan.results.services | count | > 0"
          />
          <p className="text-[10px] text-text-muted mt-1">
            Reference upstream nodes with nodes.&lt;nodeId&gt;.results.* — pipe functions: count, join, where, pluck, first, unique, &gt;, ==
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => { onSave({ expression, label }); onClose() }} disabled={!expression.trim()}>
          Apply
        </Button>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// ForEach config dialog
// ---------------------------------------------------------------------------

export function ForEachConfigDialog({
  node,
  onClose,
  onSave,
}: {
  node: Node
  onClose: () => void
  onSave: (data: Partial<ForEachNodeData>) => void
}) {
  const data = node.data as unknown as ForEachNodeData
  const [expression, setExpression] = useState(data.expression ?? '')
  const [itemVariable, setItemVariable] = useState(data.itemVariable ?? 'item')
  const [parallel, setParallel] = useState(data.parallel ?? false)

  return (
    <Dialog open onClose={onClose} title="Configure For Each">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            Collection Expression <span className="text-red-400">*</span>
          </label>
          <input
            className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono focus:border-accent-primary focus:outline-none"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="e.g., nodes.scan.results.services"
          />
          <p className="text-[10px] text-text-muted mt-1">
            Expression that resolves to an array to iterate over
          </p>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Item Variable Name</label>
          <input
            className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono focus:border-accent-primary focus:outline-none"
            value={itemVariable}
            onChange={(e) => setItemVariable(e.target.value)}
            placeholder="item"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={parallel}
            onChange={(e) => setParallel(e.target.checked)}
            className="accent-accent-primary"
          />
          <span className="text-text-secondary">Execute iterations in parallel</span>
        </label>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => { onSave({ expression, itemVariable, parallel }); onClose() }} disabled={!expression.trim()}>
          Apply
        </Button>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Delay config dialog
// ---------------------------------------------------------------------------

export function DelayConfigDialog({
  node,
  onClose,
  onSave,
}: {
  node: Node
  onClose: () => void
  onSave: (data: Partial<DelayNodeData>) => void
}) {
  const data = node.data as unknown as DelayNodeData
  const [seconds, setSeconds] = useState(data.seconds ?? 5)
  const [reason, setReason] = useState(data.reason ?? '')

  return (
    <Dialog open onClose={onClose} title="Configure Delay">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            Delay (seconds) <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            min={1}
            className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            value={seconds}
            onChange={(e) => setSeconds(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Reason (optional)</label>
          <input
            className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Wait for service to restart"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => { onSave({ seconds, reason }); onClose() }}>
          Apply
        </Button>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Start config dialog
// ---------------------------------------------------------------------------

export function StartConfigDialog({
  node,
  onClose,
  onSave,
}: {
  node: Node
  onClose: () => void
  onSave: (data: Partial<StartNodeData>) => void
}) {
  const data = node.data as unknown as StartNodeData
  const primaryType = useEntityStore(selectPrimaryType)
  const primaryEntityType = useEntityStore((s) => s.schema?.primaryEntity ?? '')
  const entities = useEntityStore((s) => s.caches[primaryEntityType]?.entities ?? EMPTY_ENTITIES)
  const [targetSource, setTargetSource] = useState<'selected' | 'all-in-scope'>(data.targetSource ?? 'selected')
  const [targetId, setTargetId] = useState<number | undefined>(data.targetId)
  const [label, setLabel] = useState(data.label ?? '')

  return (
    <Dialog open onClose={onClose} title="Configure Start Node">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Label (optional)</label>
          <input
            className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Pipeline entry point"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Target Source</label>
          <select
            className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            value={targetSource}
            onChange={(e) => setTargetSource(e.target.value as 'selected' | 'all-in-scope')}
          >
            <option value="selected">Selected target at runtime</option>
            <option value="all-in-scope">All in-scope targets</option>
          </select>
        </div>
        {targetSource === 'selected' && entities.length > 0 && (
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Pinned Target (optional — overrides runtime selection)
            </label>
            <select
              className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              value={targetId ?? ''}
              onChange={(e) => setTargetId(e.target.value ? parseInt(e.target.value) : undefined)}
            >
              <option value="">Use runtime selection</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {primaryType ? getDisplayValue(e, primaryType) : String(e.id)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          const entity = entities.find((e) => e.id === targetId)
          onSave({
            targetSource,
            targetId,
            targetLabel: entity && primaryType ? getDisplayValue(entity, primaryType) : undefined,
            label
          })
          onClose()
        }}>
          Apply
        </Button>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Note config dialog
// ---------------------------------------------------------------------------

export function NoteConfigDialog({
  node,
  onClose,
  onSave,
}: {
  node: Node
  onClose: () => void
  onSave: (data: Partial<NoteNodeData>) => void
}) {
  const data = node.data as unknown as NoteNodeData
  const [content, setContent] = useState(data.content ?? '')
  const [color, setColor] = useState<NoteNodeData['color']>(data.color ?? 'default')

  const colors: NoteNodeData['color'][] = ['default', 'yellow', 'blue', 'red', 'green']
  const colorLabels: Record<string, string> = {
    default: 'Gray', yellow: 'Yellow', blue: 'Blue', red: 'Red', green: 'Green'
  }

  return (
    <Dialog open onClose={onClose} title="Edit Note">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Content</label>
          <textarea
            className="w-full bg-bg-input border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none resize-y min-h-[80px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a note..."
            rows={4}
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Color</label>
          <div className="flex gap-2">
            {colors.map((c) => (
              <button
                key={c}
                className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                  color === c ? 'border-accent-primary text-accent-primary' : 'border-border text-text-muted hover:text-text-secondary'
                }`}
                onClick={() => setColor(c)}
              >
                {colorLabels[c]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => { onSave({ content, color }); onClose() }}>
          Apply
        </Button>
      </div>
    </Dialog>
  )
}
