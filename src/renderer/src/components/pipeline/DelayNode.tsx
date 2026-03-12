import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Timer, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { DelayNodeData } from './types'

type DelayNodeProps = NodeProps & { data: DelayNodeData }

function DelayNodeComponent({ data, selected }: DelayNodeProps) {
  const { seconds, reason, status } = data

  const statusStyles = getStatusStyles(status)

  return (
    <div
      className={`
        relative min-w-[120px] rounded-lg border bg-bg-elevated
        transition-all duration-150
        ${statusStyles.border}
        ${selected ? 'shadow-[0_0_12px_rgba(var(--accent-primary-rgb,0,255,136),0.15)]' : ''}
        ${status === 'skipped' ? 'opacity-40' : ''}
      `}
    >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-text-muted !border-2 !border-bg-base !-top-1.5"
      />

      {/* Status indicator */}
      {status && status !== 'pending' && (
        <div className="absolute -top-1 -right-1">
          {status === 'running' && <Loader2 size={14} className="text-text-secondary animate-spin" />}
          {status === 'completed' && <CheckCircle size={14} className="text-green-400" />}
          {status === 'failed' && <XCircle size={14} className="text-red-400" />}
        </div>
      )}

      {/* Body */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <Timer size={14} className="text-text-muted shrink-0" />
        <span className="text-sm font-mono font-bold text-text-primary">
          {seconds}s
        </span>
      </div>

      {reason && (
        <div className="px-3 pb-2 -mt-1">
          <div className="text-[10px] text-text-muted truncate" title={reason}>
            {reason}
          </div>
        </div>
      )}

      {/* Output handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-text-muted !border-2 !border-bg-base !-bottom-1.5"
      />
    </div>
  )
}

function getStatusStyles(status?: string): { border: string } {
  switch (status) {
    case 'running':
      return { border: 'border-text-secondary animate-pulse' }
    case 'completed':
      return { border: 'border-green-500' }
    case 'failed':
      return { border: 'border-red-500' }
    default:
      return { border: 'border-border' }
  }
}

export const DelayNode = memo(DelayNodeComponent)
