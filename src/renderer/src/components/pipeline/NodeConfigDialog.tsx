import { useState, useMemo } from 'react'
import type { Node } from '@xyflow/react'
import { Button, Dialog } from '../common'
import type { Module } from '@shared/types'
import type { ToolNodeData, ConditionNodeData, ForEachNodeData, DelayNodeData, StartNodeData, NoteNodeData, ShellNodeData, PromptNodeData, SetVariableNodeData } from './types'
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

// ---------------------------------------------------------------------------
// Shell config dialog
// ---------------------------------------------------------------------------

export function ShellConfigDialog({
  node,
  onClose,
  onSave,
}: {
  node: Node
  onClose: () => void
  onSave: (data: Partial<ShellNodeData>) => void
}) {
  const data = node.data as unknown as ShellNodeData
  const [command, setCommand] = useState(data.command ?? '')
  const [cwd, setCwd] = useState(data.cwd ?? '')
  const [timeout, setTimeout_] = useState(data.timeout ?? 0)
  const [onFailure, setOnFailure] = useState(data.onFailure ?? 'skip')
  const [captureVariable, setCaptureVariable] = useState(data.captureVariable ?? '')
  const [captureMode, setCaptureMode] = useState(data.captureMode ?? 'full')
  const [capturePattern, setCapturePattern] = useState(data.capturePattern ?? '')

  return (
    <Dialog open onClose={onClose} title="Configure Shell Command">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            Command <span className="text-red-400">*</span>
          </label>
          <textarea
            className="w-full bg-bg-input border border-border rounded px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:border-accent-primary focus:outline-none resize-y min-h-[60px]"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="e.g., curl -s https://api.example.com/data"
            rows={3}
          />
          <p className="text-[10px] text-text-muted mt-1">
            Supports {'${'} template expressions. Example: {'${vars.url}'} or {'${nodes.prev.output}'}
          </p>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Working Directory</label>
          <input
            className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono focus:border-accent-primary focus:outline-none"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="(default: inherit)"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Timeout (seconds)</label>
            <input
              type="number"
              min={0}
              className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              value={timeout}
              onChange={(e) => setTimeout_(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">On Failure</label>
            <select
              className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              value={onFailure}
              onChange={(e) => setOnFailure(e.target.value as 'skip' | 'abort' | 'retry')}
            >
              <option value="skip">Skip & continue</option>
              <option value="abort">Abort pipeline</option>
              <option value="retry">Retry once</option>
            </select>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <label className="block text-xs text-text-secondary mb-1">Capture Output → Variable</label>
          <input
            className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono focus:border-accent-primary focus:outline-none"
            value={captureVariable}
            onChange={(e) => setCaptureVariable(e.target.value)}
            placeholder="Variable name (e.g., api_response)"
          />
          {captureVariable && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-text-muted mb-1">Capture Mode</label>
                <select
                  className="w-full bg-bg-input border border-border rounded px-2 py-1 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                  value={captureMode}
                  onChange={(e) => setCaptureMode(e.target.value as 'full' | 'last_line' | 'regex' | 'json')}
                >
                  <option value="full">Full output</option>
                  <option value="last_line">Last line</option>
                  <option value="regex">Regex match</option>
                  <option value="json">JSON parse</option>
                </select>
              </div>
              {(captureMode === 'regex' || captureMode === 'json') && (
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">
                    {captureMode === 'regex' ? 'Pattern' : 'JSON path'}
                  </label>
                  <input
                    className="w-full bg-bg-input border border-border rounded px-2 py-1 text-xs text-text-primary font-mono focus:border-accent-primary focus:outline-none"
                    value={capturePattern}
                    onChange={(e) => setCapturePattern(e.target.value)}
                    placeholder={captureMode === 'regex' ? '(.+)' : 'data.result'}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          onSave({
            command,
            cwd: cwd || undefined,
            timeout: timeout || undefined,
            onFailure: onFailure as 'skip' | 'abort' | 'retry',
            captureVariable: captureVariable || undefined,
            captureMode: captureVariable ? captureMode : undefined,
            capturePattern: captureVariable && capturePattern ? capturePattern : undefined,
          })
          onClose()
        }} disabled={!command.trim()}>
          Apply
        </Button>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Prompt config dialog
// ---------------------------------------------------------------------------

export function PromptConfigDialog({
  node,
  onClose,
  onSave,
}: {
  node: Node
  onClose: () => void
  onSave: (data: Partial<PromptNodeData>) => void
}) {
  const data = node.data as unknown as PromptNodeData
  const [message, setMessage] = useState(data.message ?? '')
  const [promptType, setPromptType] = useState<'confirm' | 'text' | 'select'>(data.promptType ?? 'text')
  const [variable, setVariable] = useState(data.variable ?? '')
  const [defaultVal, setDefaultVal] = useState(data.default ?? '')
  const [options, setOptions] = useState(data.options?.join('\n') ?? '')
  const [timeout, setTimeout_] = useState(data.timeout ?? 0)

  return (
    <Dialog open onClose={onClose} title="Configure Prompt">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            Message <span className="text-red-400">*</span>
          </label>
          <textarea
            className="w-full bg-bg-input border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none resize-y min-h-[50px]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What would you like to ask?"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Type</label>
            <select
              className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              value={promptType}
              onChange={(e) => setPromptType(e.target.value as 'confirm' | 'text' | 'select')}
            >
              <option value="text">Text input</option>
              <option value="confirm">Yes / No</option>
              <option value="select">Select from list</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Variable Name <span className="text-red-400">*</span>
            </label>
            <input
              className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono focus:border-accent-primary focus:outline-none"
              value={variable}
              onChange={(e) => setVariable(e.target.value)}
              placeholder="user_input"
            />
          </div>
        </div>
        {promptType === 'select' && (
          <div>
            <label className="block text-xs text-text-secondary mb-1">Options (one per line)</label>
            <textarea
              className="w-full bg-bg-input border border-border rounded px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:border-accent-primary focus:outline-none resize-y min-h-[60px]"
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="Option 1&#10;Option 2&#10;Option 3"
              rows={3}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Default Value</label>
            <input
              className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              value={defaultVal}
              onChange={(e) => setDefaultVal(e.target.value)}
              placeholder="(none)"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Timeout (seconds)</label>
            <input
              type="number"
              min={0}
              className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              value={timeout}
              onChange={(e) => setTimeout_(Math.max(0, parseInt(e.target.value) || 0))}
            />
            <p className="text-[10px] text-text-muted mt-0.5">0 = wait forever</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          onSave({
            message,
            promptType,
            variable,
            default: defaultVal || undefined,
            options: promptType === 'select' ? options.split('\n').filter((o) => o.trim()) : undefined,
            timeout: timeout || undefined,
          })
          onClose()
        }} disabled={!message.trim() || !variable.trim()}>
          Apply
        </Button>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Set-variable config dialog
// ---------------------------------------------------------------------------

export function SetVariableConfigDialog({
  node,
  onClose,
  onSave,
}: {
  node: Node
  onClose: () => void
  onSave: (data: Partial<SetVariableNodeData>) => void
}) {
  const data = node.data as unknown as SetVariableNodeData
  const [variable, setVariable] = useState(data.variable ?? '')
  const [value, setValue] = useState(data.value ?? '')

  return (
    <Dialog open onClose={onClose} title="Configure Set Variable">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            Variable Name <span className="text-red-400">*</span>
          </label>
          <input
            className="w-full bg-bg-input border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono focus:border-accent-primary focus:outline-none"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            placeholder="my_variable"
          />
          <p className="text-[10px] text-text-muted mt-0.5">
            Access later with {'${vars.my_variable}'}
          </p>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            Value Expression <span className="text-red-400">*</span>
          </label>
          <textarea
            className="w-full bg-bg-input border border-border rounded px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:border-accent-primary focus:outline-none resize-y min-h-[50px]"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="literal value or ${...} template"
            rows={2}
          />
          <p className="text-[10px] text-text-muted mt-1">
            Supports template expressions: {'${nodes.<id>.output}'}, {'${vars.other_var}'}, etc.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          onSave({ variable, value })
          onClose()
        }} disabled={!variable.trim() || !value.trim()}>
          Apply
        </Button>
      </div>
    </Dialog>
  )
}
