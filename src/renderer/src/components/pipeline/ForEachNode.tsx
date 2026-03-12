import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Repeat, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { ForEachNodeData } from './types'

type ForEachNodeProps = NodeProps & { data: ForEachNodeData }

function ForEachNodeComponent({ data, selected }: ForEachNodeProps) {
  const { expression, itemVariable, parallel, status } = data

  const statusStyles = getStatusStyles(status)

  return (
    <div
      className={`
        relative min-w-[200px] rounded-lg border bg-bg-elevated
        border-l-[3px] border-l-blue-400 border-t-dashed
        transition-all duration-150
        ${statusStyles.border}
        ${selected ? 'shadow-[0_0_12px_rgba(96,165,250,0.2)]' : ''}
        ${status === 'skipped' ? 'opacity-40' : ''}
      `}
    >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-bg-base !-top-1.5"
      />

      {/* Status indicator */}
      {status && status !== 'pending' && (
        <div className="absolute -top-1 -right-1">
          {status === 'running' && <Loader2 size={14} className="text-blue-400 animate-spin" />}
          {status === 'completed' && <CheckCircle size={14} className="text-green-400" />}
          {status === 'failed' && <XCircle size={14} className="text-red-400" />}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border rounded-t-lg bg-bg-surface">
        <Repeat size={12} className="text-blue-400 shrink-0" />
        <span className="text-xs font-medium text-text-primary truncate flex-1">
          For Each
        </span>
        {parallel && (
          <span className="text-[9px] bg-blue-400/20 text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
            parallel
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1">
        <div className="text-[10px] text-text-muted font-mono truncate" title={expression}>
          {expression || 'No collection set'}
        </div>
        <div className="text-[10px] text-text-secondary">
          as <span className="font-mono text-blue-300">{itemVariable || 'item'}</span>
        </div>
      </div>

      {/* Output handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-bg-base !-bottom-1.5"
      />
    </div>
  )
}

function getStatusStyles(status?: string): { border: string } {
  switch (status) {
    case 'running':
      return { border: 'border-blue-400 animate-pulse' }
    case 'completed':
      return { border: 'border-green-500' }
    case 'failed':
      return { border: 'border-red-500' }
    default:
      return { border: 'border-border-bright' }
  }
}

export const ForEachNode = memo(ForEachNodeComponent)
