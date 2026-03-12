// Generic entity card — renders any entity based on schema field roles

import type { EntityRecord, ResolvedEntityDef } from '@shared/types/entity'
import { getDisplayValue, getStatusValue, getCategoryValue } from '../../lib/schema-utils'
import { getIcon } from '../../lib/icon-map'
import { Badge, Card } from '../common'

interface EntityCardProps {
  entity: EntityRecord
  entityDef: ResolvedEntityDef
  selected?: boolean
  onClick?: () => void
  childCounts?: Record<string, number>
}

export function EntityCard({
  entity,
  entityDef,
  selected,
  onClick,
  childCounts
}: EntityCardProps): React.JSX.Element {
  const display = getDisplayValue(entity, entityDef)
  const status = getStatusValue(entity, entityDef)
  const category = getCategoryValue(entity, entityDef)
  const Icon = getIcon(entityDef.icon)

  return (
    <Card
      className={`cursor-pointer transition-all hover-lift ${
        selected ? 'ring-1 ring-accent border-accent' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded bg-bg-base">
          <Icon size={14} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-text-primary truncate">
              {display}
            </span>
            {status && (
              <Badge variant={statusVariant(status)} size="sm">
                {status}
              </Badge>
            )}
          </div>
          {category && (
            <span className="text-xs text-text-muted font-mono">{category}</span>
          )}
          {childCounts && Object.keys(childCounts).length > 0 && (
            <div className="flex gap-3 mt-1.5">
              {Object.entries(childCounts).map(([type, count]) => (
                <span key={type} className="text-xs text-text-muted">
                  <span className="text-text-secondary">{count}</span> {type}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function statusVariant(status: string): 'default' | 'accent' | 'success' | 'error' {
  const lower = status.toLowerCase()
  if (['new', 'open', 'found', 'info', 'unchecked'].includes(lower)) return 'default'
  if (['scanned', 'valid', 'completed', 'in-scope'].includes(lower)) return 'success'
  if (['scanning', 'medium', 'low'].includes(lower)) return 'accent'
  if (['compromised', 'critical', 'high', 'invalid', 'out-of-scope'].includes(lower)) return 'error'
  return 'default'
}
