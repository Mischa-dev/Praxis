import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MessageCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { PromptNodeData } from './types'

type PromptNodeProps = NodeProps & { data: PromptNodeData }

function PromptNodeComponent({ data, selected }: PromptNodeProps) {
  const { message, promptType, variable, status, configured } = data

  const borderColor =
    status === 'running' ? 'border-violet-500 animate-pulse' :
    status === 'completed' ? 'border-green-500' :
    status === 'failed' ? 'border-red-500' :
    configured ? 'border-violet-600/60' : 'border-border'

  const truncatedMsg = message
    ? message.length > 40 ? message.slice(0, 40) + '...' : message
    : 'No message'

  const typeLabel = promptType === 'confirm' ? 'Y/N' : promptType === 'select' ? 'Select' : 'Text'

  return (
    <div
      className={`
        relative rounded-lg border-2 px-4 py-2.5 min-w-[180px] max-w-[260px]
        bg-bg-elevated transition-all duration-150
        ${borderColor}
        ${selected ? 'shadow-[0_0_16px_rgba(139,92,246,0.3)]' : 'shadow-sm'}
        ${status === 'skipped' ? 'opacity-40' : ''}
      `}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-bg-base !-top-1.5"
      />

      {/* Status indicator */}
      {status && status !== 'pending' && (
        <div className="absolute -top-1 -right-1">
          {status === 'running' && <Loader2 size={14} className="text-violet-400 animate-spin" />}
          {status === 'completed' && <CheckCircle size={14} className="text-green-400" />}
          {status === 'failed' && <XCircle size={14} className="text-red-400" />}
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <MessageCircle size={14} className="text-violet-400 shrink-0" />
        <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
          Prompt
        </span>
        <span className="text-[9px] text-text-muted ml-auto">{typeLabel}</span>
      </div>

      <div className="text-[11px] text-text-primary truncate" title={message}>
        {truncatedMsg}
      </div>

      <div className="text-[9px] text-text-muted mt-1">
        → ${'{'}vars.{variable}{'}'}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-bg-base !-bottom-1.5"
      />
    </div>
  )
}

export const PromptNode = memo(PromptNodeComponent)
