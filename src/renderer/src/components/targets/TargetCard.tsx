import {
  Globe,
  Monitor,
  Network,
  Link,
  Mail,
  Server,
  Shield,
  ShieldAlert,
  ShieldQuestion,
  Bug,
  Clock,
  Crosshair,
  ScanLine,
  Trash2
} from 'lucide-react'
import type { Target, TargetType, ScopeStatus, TargetStatus } from '@shared/types'
import { Card, Badge } from '../common'

interface TargetCardProps {
  target: Target
  active: boolean
  onSelect: (targetId: number) => void
  onRemove: (targetId: number) => void
  onOpen: (targetId: number) => void
}

const typeIcons: Record<TargetType, typeof Globe> = {
  ip: Monitor,
  cidr: Network,
  hostname: Server,
  domain: Globe,
  url: Link,
  email: Mail
}

const typeLabels: Record<TargetType, string> = {
  ip: 'IP',
  cidr: 'CIDR',
  hostname: 'Host',
  domain: 'Domain',
  url: 'URL',
  email: 'Email'
}

const scopeIcons: Record<ScopeStatus, typeof Shield> = {
  'in-scope': Shield,
  'out-of-scope': ShieldAlert,
  unchecked: ShieldQuestion
}

const scopeClasses: Record<ScopeStatus, string> = {
  'in-scope': 'text-success',
  'out-of-scope': 'text-error',
  unchecked: 'text-text-muted'
}

const statusConfig: Record<TargetStatus, { label: string; variant: 'default' | 'accent' | 'success' | 'error' | 'purple' }> = {
  new: { label: 'NEW', variant: 'default' },
  scanning: { label: 'SCANNING', variant: 'accent' },
  scanned: { label: 'SCANNED', variant: 'success' },
  compromised: { label: 'PWNED', variant: 'error' }
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function TargetCard({ target, active, onSelect, onRemove, onOpen }: TargetCardProps) {
  const TypeIcon = typeIcons[target.type]
  const ScopeIcon = scopeIcons[target.scope_status]
  const status = statusConfig[target.status]

  // Parse tags JSON
  let tags: string[] = []
  try {
    tags = JSON.parse(target.tags || '[]')
  } catch {
    // ignore
  }

  return (
    <Card
      hoverable
      active={active}
      padding="none"
      onClick={() => onSelect(target.id)}
      onDoubleClick={() => onOpen(target.id)}
      className="group relative"
    >
      {/* Remove button — visible on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove(target.id)
        }}
        className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 text-text-muted hover:text-error hover:bg-error/10 transition-all"
        aria-label="Remove target"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="p-4">
        {/* Header: type icon + value */}
        <div className="flex items-start gap-2.5 mb-3">
          <div className="mt-0.5 p-1.5 rounded bg-bg-elevated">
            <TypeIcon className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-mono font-semibold text-text-primary truncate" title={target.value}>
              {target.value}
            </p>
            {target.label && (
              <p className="text-xs text-text-secondary truncate">{target.label}</p>
            )}
          </div>
        </div>

        {/* Meta row: type badge + scope icon + status */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="default" className="text-[10px]">{typeLabels[target.type]}</Badge>
          <ScopeIcon className={`w-3.5 h-3.5 ${scopeClasses[target.scope_status]}`} />
          <Badge variant={status.variant} className="text-[10px]">
            {status.label}
          </Badge>
          {target.status === 'scanning' && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent status-running" />
          )}
        </div>

        {/* Stats row — will show real counts once scans exist */}
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          <span className="flex items-center gap-1" title="Services">
            <Crosshair className="w-3 h-3" />
            0
          </span>
          <span className="flex items-center gap-1" title="Findings">
            <Bug className="w-3 h-3" />
            0
          </span>
          <span className="flex items-center gap-1" title="Scans">
            <ScanLine className="w-3 h-3" />
            0
          </span>
          <div className="flex-1" />
          <span className="flex items-center gap-1" title={`Added ${target.created_at}`}>
            <Clock className="w-3 h-3" />
            {formatRelativeTime(target.created_at)}
          </span>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-bg-elevated text-text-secondary border border-border">
                {tag}
              </span>
            ))}
            {tags.length > 4 && (
              <span className="text-[10px] text-text-muted">+{tags.length - 4}</span>
            )}
          </div>
        )}

        {/* OS guess */}
        {target.os_guess && (
          <p className="mt-2 text-[10px] text-text-muted font-mono truncate">
            OS: {target.os_guess}
          </p>
        )}
      </div>
    </Card>
  )
}
