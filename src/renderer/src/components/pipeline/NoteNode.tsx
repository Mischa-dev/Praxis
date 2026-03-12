import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import type { NoteNodeData } from './types'

type NoteNodeProps = NodeProps & { data: NoteNodeData }

const colorStyles: Record<string, string> = {
  default: 'bg-bg-surface border-border text-text-secondary',
  yellow: 'bg-yellow-900/20 border-yellow-700/30 text-yellow-200',
  blue: 'bg-blue-900/20 border-blue-700/30 text-blue-200',
  red: 'bg-red-900/20 border-red-700/30 text-red-200',
  green: 'bg-green-900/20 border-green-700/30 text-green-200',
}

function NoteNodeComponent({ data, selected }: NoteNodeProps) {
  const { content, color } = data
  const style = colorStyles[color] || colorStyles.default

  return (
    <div
      className={`
        relative min-w-[140px] max-w-[240px] rounded border px-3 py-2
        rotate-[1deg] transition-all duration-150
        ${style}
        ${selected ? 'ring-1 ring-accent-primary' : ''}
      `}
    >
      {/* No handles — notes are not connectable */}
      <p className="text-xs whitespace-pre-wrap break-words leading-relaxed">
        {content || 'Empty note'}
      </p>
    </div>
  )
}

export const NoteNode = memo(NoteNodeComponent)
