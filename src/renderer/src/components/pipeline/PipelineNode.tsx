import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Settings, Trash2, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { ToolNodeData } from './types'

type ToolNodeProps = NodeProps & { data: ToolNodeData }

function ToolNodeComponent({ data, selected }: ToolNodeProps) {
  const [showDelete, setShowDelete] = useState(false)
  const { label, module, configured, status } = data

  const installed = module?.installed ?? false
  const category = module?.category ?? 'unknown'
  const statusStyles = getStatusStyles(status)

  return (
    <div
      className={`
        relative min-w-[180px] rounded-lg border bg-bg-elevated
        transition-all duration-150
        ${statusStyles.border}
        ${selected && !status ? 'border-accent-primary shadow-[0_0_12px_rgba(var(--accent-primary-rgb,0,255,136),0.2)]' : ''}
        ${status === 'skipped' ? 'opacity-40' : ''}
      `}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-accent-primary !border-2 !border-bg-base !-top-1.5"
      />

      {/* Status indicator */}
      {status && status !== 'pending' && (
        <div className="absolute -top-1 -right-1 z-10">
          {status === 'running' && <Loader2 size={14} className="text-accent-primary animate-spin" />}
          {status === 'completed' && <CheckCircle size={14} className="text-green-400" />}
          {status === 'failed' && <XCircle size={14} className="text-red-400" />}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border rounded-t-lg bg-bg-surface">
        <Play size={12} className="text-accent-primary shrink-0" />
        <span className="text-xs font-medium text-text-primary truncate flex-1">
          {label}
        </span>
        {installed ? (
          <CheckCircle size={12} className="text-green-500 shrink-0" />
        ) : (
          <XCircle size={12} className="text-red-500 shrink-0" />
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-secondary uppercase tracking-wider">
            {category}
          </span>
          {configured ? (
            <span className="text-[10px] text-green-400 flex items-center gap-0.5">
              <Settings size={10} /> configured
            </span>
          ) : (
            <span className="text-[10px] text-text-muted flex items-center gap-0.5">
              <Settings size={10} /> defaults
            </span>
          )}
        </div>

        {module?.binary && (
          <div className="text-[10px] text-text-muted font-mono truncate">
            $ {module.binary}
          </div>
        )}
      </div>

      {/* Delete button (hover) */}
      {showDelete && !status && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center
                     text-white hover:bg-red-500 transition-colors nodrag"
          onClick={(e) => {
            e.stopPropagation()
            const event = new CustomEvent('pipeline:delete-node', { detail: { nodeId: (data as ToolNodeData & { nodeId?: string }).nodeId } })
            window.dispatchEvent(event)
          }}
          title="Remove node"
        >
          <Trash2 size={10} />
        </button>
      )}

      {/* Output handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-accent-primary !border-2 !border-bg-base !-bottom-1.5"
      />
    </div>
  )
}

function getStatusStyles(status?: string): { border: string } {
  switch (status) {
    case 'running':
      return { border: 'border-accent-primary animate-pulse' }
    case 'completed':
      return { border: 'border-green-500' }
    case 'failed':
      return { border: 'border-red-500' }
    default:
      return { border: 'border-border-bright' }
  }
}

export const ToolNode = memo(ToolNodeComponent)
