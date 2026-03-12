import { Lock } from 'lucide-react'
import type { Service, ServiceState } from '@shared/types'
import { Badge } from '../common'

interface ServiceCardProps {
  service: Service
}

const stateColors: Record<ServiceState, string> = {
  open: 'text-success',
  closed: 'text-error',
  filtered: 'text-warning'
}

const stateBgColors: Record<ServiceState, string> = {
  open: 'bg-success',
  closed: 'bg-error',
  filtered: 'bg-warning'
}

export function ServiceCard({ service }: ServiceCardProps) {
  const displayName = service.service_name || 'unknown'
  const version = [service.product, service.service_version].filter(Boolean).join(' ')

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-bg-surface border border-border rounded-lg hover:border-border-bright transition-colors group">
      {/* State indicator dot */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${stateBgColors[service.state]}`}
        title={service.state}
      />

      {/* Port & protocol */}
      <div className="flex-shrink-0 w-20">
        <span className="font-mono text-sm font-semibold text-text-primary">
          {service.port}
        </span>
        <span className="text-text-muted text-xs">/{service.protocol}</span>
      </div>

      {/* Service name */}
      <div className="flex-shrink-0 w-28">
        <span className={`text-sm font-mono ${stateColors[service.state]}`}>
          {displayName}
        </span>
      </div>

      {/* Version / product info */}
      <div className="flex-1 min-w-0">
        {version && (
          <span className="text-xs text-text-secondary font-mono truncate block">
            {version}
          </span>
        )}
        {service.banner && !version && (
          <span className="text-xs text-text-muted font-mono truncate block" title={service.banner}>
            {service.banner}
          </span>
        )}
      </div>

      {/* Tunnel indicator */}
      {service.tunnel === 'ssl' && (
        <Badge variant="accent" className="text-[10px] flex-shrink-0">
          <Lock className="w-3 h-3 mr-1" />
          TLS
        </Badge>
      )}

      {/* State badge */}
      <Badge
        variant={service.state === 'open' ? 'success' : service.state === 'closed' ? 'error' : 'default'}
        className="text-[10px] flex-shrink-0 uppercase"
      >
        {service.state}
      </Badge>
    </div>
  )
}

/** Compact badge showing port/service for inline use */
export function ServiceBadge({ service }: ServiceCardProps) {
  const displayName = service.service_name || '?'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border ${
      service.state === 'open'
        ? 'bg-success/10 text-success border-success/20'
        : service.state === 'filtered'
          ? 'bg-warning/10 text-warning border-warning/20'
          : 'bg-error/10 text-error border-error/20'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${stateBgColors[service.state]}`} />
      {service.port}/{displayName}
    </span>
  )
}
