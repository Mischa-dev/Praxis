import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Terminal, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { ShellNodeData } from './types'

type ShellNodeProps = NodeProps & { data: ShellNodeData }

function ShellNodeComponent({ data, selected }: ShellNodeProps) {
  const { command, status, configured, captureVariable } = data

  const borderColor =
    status === 'running' ? 'border-emerald-500 animate-pulse' :
    status === 'completed' ? 'border-green-500' :
    status === 'failed' ? 'border-red-500' :
    configured ? 'border-emerald-600/60' : 'border-border'

  const truncatedCmd = command
    ? command.length > 40 ? command.slice(0, 40) + '...' : command
    : 'No command'

  return (
    <div
      className={`
        relative rounded-lg border-2 px-4 py-2.5 min-w-[180px] max-w-[260px]
        bg-bg-elevated transition-all duration-150
        ${borderColor}
        ${selected ? 'shadow-[0_0_16px_rgba(16,185,129,0.3)]' : 'shadow-sm'}
        ${status === 'skipped' ? 'opacity-40' : ''}
      `}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-bg-base !-top-1.5"
      />

      {/* Status indicator */}
      {status && status !== 'pending' && (
        <div className="absolute -top-1 -right-1">
          {status === 'running' && <Loader2 size={14} className="text-emerald-400 animate-spin" />}
          {status === 'completed' && <CheckCircle size={14} className="text-green-400" />}
          {status === 'failed' && <XCircle size={14} className="text-red-400" />}
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <Terminal size={14} className="text-emerald-400 shrink-0" />
        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
          Shell
        </span>
      </div>

      <div className="text-[11px] text-text-primary font-mono truncate" title={command}>
        {truncatedCmd}
      </div>

      {captureVariable && (
        <div className="text-[9px] text-text-muted mt-1">
          → ${'{'}vars.{captureVariable}{'}'}
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-bg-base !-bottom-1.5"
      />
    </div>
  )
}

export const ShellNode = memo(ShellNodeComponent)
