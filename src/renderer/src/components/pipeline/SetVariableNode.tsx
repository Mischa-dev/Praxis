import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Braces, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { SetVariableNodeData } from './types'

type SetVariableNodeProps = NodeProps & { data: SetVariableNodeData }

function SetVariableNodeComponent({ data, selected }: SetVariableNodeProps) {
  const { variable, value, status, configured } = data

  const borderColor =
    status === 'running' ? 'border-cyan-500 animate-pulse' :
    status === 'completed' ? 'border-green-500' :
    status === 'failed' ? 'border-red-500' :
    configured ? 'border-cyan-600/60' : 'border-border'

  const truncatedValue = value
    ? value.length > 30 ? value.slice(0, 30) + '...' : value
    : '(empty)'

  return (
    <div
      className={`
        relative rounded-lg border-2 px-4 py-2.5 min-w-[160px] max-w-[240px]
        bg-bg-elevated transition-all duration-150
        ${borderColor}
        ${selected ? 'shadow-[0_0_16px_rgba(6,182,212,0.3)]' : 'shadow-sm'}
        ${status === 'skipped' ? 'opacity-40' : ''}
      `}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-bg-base !-top-1.5"
      />

      {/* Status indicator */}
      {status && status !== 'pending' && (
        <div className="absolute -top-1 -right-1">
          {status === 'running' && <Loader2 size={14} className="text-cyan-400 animate-spin" />}
          {status === 'completed' && <CheckCircle size={14} className="text-green-400" />}
          {status === 'failed' && <XCircle size={14} className="text-red-400" />}
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <Braces size={14} className="text-cyan-400 shrink-0" />
        <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">
          Set Var
        </span>
      </div>

      <div className="text-[11px] text-text-primary font-mono">
        <span className="text-cyan-300">{variable || '?'}</span>
        <span className="text-text-muted"> = </span>
        <span className="text-text-secondary truncate" title={value}>{truncatedValue}</span>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-bg-base !-bottom-1.5"
      />
    </div>
  )
}

export const SetVariableNode = memo(SetVariableNodeComponent)
