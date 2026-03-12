// Entity detail header — shows entity icon, display value, status, and key fields

import type { EntityRecord, ResolvedEntityDef } from '@shared/types/entity'
import { getDisplayValue, getStatusValue, getCategoryValue } from '../../lib/schema-utils'
import { getIcon } from '../../lib/icon-map'
import { Badge } from '../common'

interface EntityHeaderProps {
  entity: EntityRecord
  entityDef: ResolvedEntityDef
  stats?: Record<string, number>
}

export function EntityHeader({ entity, entityDef, stats }: EntityHeaderProps): React.JSX.Element {
  const display = getDisplayValue(entity, entityDef)
  const status = getStatusValue(entity, entityDef)
  const category = getCategoryValue(entity, entityDef)
  const Icon = getIcon(entityDef.icon)

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded bg-bg-surface">
          <Icon size={18} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary truncate font-mono">
              {display}
            </h2>
            {status && <Badge variant="default" size="sm">{status}</Badge>}
          </div>
          {category && (
            <span className="text-xs text-text-muted font-mono">{category}</span>
          )}
        </div>
      </div>

      {/* Quick stats for child entities */}
      {stats && Object.keys(stats).length > 0 && (
        <div className="flex gap-4 mt-3">
          {Object.entries(stats).map(([type, count]) => (
            <div key={type} className="text-center">
              <div className="text-sm font-semibold text-accent font-mono">{count}</div>
              <div className="text-xs text-text-muted">{type}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
