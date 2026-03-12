import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { ConditionNodeData } from './types'

type ConditionNodeProps = NodeProps & { data: ConditionNodeData }

function ConditionNodeComponent({ data, selected }: ConditionNodeProps) {
  const { expression, label, status } = data

  const statusStyles = getStatusStyles(status)

  return (
    <div
      className={`
        relative min-w-[200px] rounded-lg border bg-bg-elevated
        border-l-[3px] border-l-amber-400
        transition-all duration-150
        ${statusStyles.border}
        ${selected ? 'shadow-[0_0_12px_rgba(245,158,11,0.2)]' : ''}
        ${status === 'skipped' ? 'opacity-40' : ''}
      `}
    >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-bg-base !-top-1.5"
      />

      {/* Status indicator */}
      {status && status !== 'pending' && (
        <div className="absolute -top-1 -right-1">
          {status === 'running' && <Loader2 size={14} className="text-amber-400 animate-spin" />}
          {status === 'completed' && <CheckCircle size={14} className="text-green-400" />}
          {status === 'failed' && <XCircle size={14} className="text-red-400" />}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border rounded-t-lg bg-bg-surface">
        <GitBranch size={12} className="text-amber-400 shrink-0" />
        <span className="text-xs font-medium text-text-primary truncate flex-1">
          {label || 'Condition'}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <div className="text-[10px] text-text-muted font-mono truncate" title={expression}>
          {expression || 'No expression set'}
        </div>
      </div>

      {/* TRUE output handle (bottom-left) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!w-3 !h-3 !bg-green-400 !border-2 !border-bg-base !-bottom-1.5"
        style={{ left: '30%' }}
      />
      <span
        className="absolute bottom-[-18px] text-[8px] font-bold text-green-400 pointer-events-none select-none"
        style={{ left: 'calc(30% - 4px)' }}
      >
        T
      </span>

      {/* FALSE output handle (bottom-right) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!w-3 !h-3 !bg-red-400 !border-2 !border-bg-base !-bottom-1.5"
        style={{ left: '70%' }}
      />
      <span
        className="absolute bottom-[-18px] text-[8px] font-bold text-red-400 pointer-events-none select-none"
        style={{ left: 'calc(70% - 3px)' }}
      >
        F
      </span>
    </div>
  )
}

function getStatusStyles(status?: string): { border: string } {
  switch (status) {
    case 'running':
      return { border: 'border-amber-400 animate-pulse' }
    case 'completed':
      return { border: 'border-green-500' }
    case 'failed':
      return { border: 'border-red-500' }
    default:
      return { border: 'border-border-bright' }
  }
}

export const ConditionNode = memo(ConditionNodeComponent)
