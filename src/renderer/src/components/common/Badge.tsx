import type { HTMLAttributes } from 'react'
import type { Severity } from '@shared/types'

type BadgeVariant = 'default' | 'accent' | 'success' | 'error' | 'purple'
type BadgeSize = 'xs' | 'sm'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  pulse?: boolean
}

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default: 'bg-bg-elevated text-text-secondary border-border-bright',
  accent: 'bg-accent/10 text-accent border-accent/20',
  success: 'bg-success/10 text-success border-success/20',
  error: 'bg-error/10 text-error border-error/20',
  purple: 'bg-accent-purple/10 text-accent-purple border-accent-purple/20'
}

const badgeSizeClasses: Record<BadgeSize, string> = {
  xs: 'px-1.5 py-px rounded text-[10px]',
  sm: 'px-2 py-0.5 rounded text-xs',
}

function Badge({
  variant = 'default',
  size = 'sm',
  pulse,
  className = '',
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={`
        inline-flex items-center font-sans font-medium border
        ${badgeSizeClasses[size]}
        ${badgeVariantClasses[variant]}
        ${pulse ? 'badge-pulse' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  )
}

// --- SeverityBadge ---

interface SeverityBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  severity: Severity
}

const severityConfig: Record<Severity, { label: string; classes: string }> = {
  critical: {
    label: 'CRITICAL',
    classes: 'bg-severity-critical/15 text-severity-critical border-severity-critical/25'
  },
  high: {
    label: 'HIGH',
    classes: 'bg-severity-high/15 text-severity-high border-severity-high/25'
  },
  medium: {
    label: 'MEDIUM',
    classes: 'bg-severity-medium/15 text-severity-medium border-severity-medium/25'
  },
  low: {
    label: 'LOW',
    classes: 'bg-severity-low/15 text-severity-low border-severity-low/25'
  },
  info: {
    label: 'INFO',
    classes: 'bg-severity-info/15 text-severity-info border-severity-info/25'
  }
}

function SeverityBadge({
  severity,
  className = '',
  ...props
}: SeverityBadgeProps): React.JSX.Element {
  const config = severityConfig[severity]
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold
        uppercase tracking-widest border
        ${config.classes}
        ${className}
      `}
      {...props}
    >
      <span className={`w-1.5 h-1.5 rounded-full bg-current`} />
      {config.label}
    </span>
  )
}

export { Badge, SeverityBadge }
export type { BadgeProps, BadgeVariant, BadgeSize, SeverityBadgeProps }
