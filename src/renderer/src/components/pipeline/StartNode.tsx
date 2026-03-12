import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { PlayCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { StartNodeData } from './types'

type StartNodeProps = NodeProps & { data: StartNodeData }

function StartNodeComponent({ data, selected }: StartNodeProps) {
  const { targetSource, targetLabel, label, status } = data

  const statusStyles = getStatusStyles(status)

  return (
    <div
      className={`
        relative rounded-full border-2 px-5 py-3 min-w-[160px]
        bg-bg-elevated transition-all duration-150 text-center
        ${statusStyles.border}
        ${selected ? 'shadow-[0_0_16px_rgba(var(--accent-primary-rgb,0,255,136),0.3)]' : 'shadow-[0_0_8px_rgba(var(--accent-primary-rgb,0,255,136),0.1)]'}
        ${status === 'skipped' ? 'opacity-40' : ''}
      `}
    >
      {/* Status indicator */}
      {status && status !== 'pending' && (
        <div className="absolute -top-1 -right-1">
          {status === 'running' && <Loader2 size={14} className="text-accent-primary animate-spin" />}
          {status === 'completed' && <CheckCircle size={14} className="text-green-400" />}
          {status === 'failed' && <XCircle size={14} className="text-red-400" />}
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        <PlayCircle size={16} className="text-accent-primary shrink-0" />
        <span className="text-[10px] font-bold text-accent-primary uppercase tracking-widest">
          {label || 'START'}
        </span>
      </div>

      <div className="text-[10px] text-text-secondary mt-1">
        {targetLabel ? (
          <span className="font-mono">{targetLabel}</span>
        ) : targetSource === 'all-in-scope' ? (
          'All In-Scope'
        ) : (
          'Selected Target'
        )}
      </div>

      {/* Output handle (bottom) — no input handle on start nodes */}
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
      return { border: 'border-accent-primary' }
  }
}

export const StartNode = memo(StartNodeComponent)
