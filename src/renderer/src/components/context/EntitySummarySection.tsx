// Entity summary section for the context panel — shows active entity card

import { useState } from 'react'
import { ChevronDown, ExternalLink, Monitor } from 'lucide-react'
import { useEntityStore, selectPrimaryType, selectActiveEntity } from '../../stores/entity-store'
import { useUiStore } from '../../stores/ui-store'
import { getIcon } from '../../lib/icon-map'
import { getDisplayValue, getStatusValue, getCategoryValue } from '../../lib/schema-utils'
import { Badge } from '../common'
import type { EntityRecord } from '@shared/types/entity'

const EMPTY_ENTITIES: EntityRecord[] = []

export function EntitySummarySection(): React.JSX.Element | null {
  const primaryType = useEntityStore(selectPrimaryType)
  const activeEntity = useEntityStore(selectActiveEntity)
  const primaryTypeId = primaryType?.id ?? ''
  const entities = useEntityStore((s) => s.caches[primaryTypeId]?.entities ?? EMPTY_ENTITIES)
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity)
  const navigate = useUiStore((s) => s.navigate)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  if (!primaryType || !activeEntity) return null

  const displayValue = getDisplayValue(activeEntity, primaryType)
  const statusValue = getStatusValue(activeEntity, primaryType)
  const categoryValue = getCategoryValue(activeEntity, primaryType)
  const TypeIcon = categoryValue ? getIcon(primaryType.icon) : Monitor

  const handleOpen = (id: number): void => {
    setActiveEntity(id)
    navigate('entity-detail-view', { entityType: primaryType.id, entityId: id })
  }

  const handleSwitch = (entity: EntityRecord): void => {
    setActiveEntity(entity.id)
    setSwitcherOpen(false)
  }

  return (
    <div className="space-y-2">
      {/* Active entity card */}
      <div
        className="bg-bg-elevated rounded-lg p-2.5 border border-border hover:border-accent/30 transition-colors cursor-pointer"
        onClick={() => handleOpen(activeEntity.id)}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <TypeIcon className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          <span className="text-xs font-mono text-text-primary truncate flex-1 font-semibold">
            {displayValue}
          </span>
          <ExternalLink className="w-3 h-3 text-text-muted flex-shrink-0" />
        </div>
        <div className="flex items-center gap-1.5 ml-5.5">
          {statusValue && (
            <Badge variant="default" className="text-[9px] px-1.5 py-0 uppercase">
              {statusValue}
            </Badge>
          )}
          {categoryValue && (
            <span className="text-[9px] text-text-muted font-mono">{categoryValue}</span>
          )}
        </div>
      </div>

      {/* Quick-switch dropdown */}
      {entities.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setSwitcherOpen(!switcherOpen)}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors w-full"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />
            <span>Switch {primaryType.label.toLowerCase()} ({entities.length})</span>
          </button>

          {switcherOpen && (
            <div className="mt-1 bg-bg-elevated border border-border rounded-lg max-h-40 overflow-y-auto scrollbar-hidden">
              {entities
                .filter((e) => e.id !== activeEntity.id)
                .map((e) => (
                  <button
                    key={e.id}
                    onClick={() => handleSwitch(e)}
                    className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-bg-input transition-colors text-left"
                  >
                    <TypeIcon className="w-3 h-3 text-text-muted flex-shrink-0" />
                    <span className="text-[11px] font-mono text-text-secondary truncate">
                      {getDisplayValue(e, primaryType)}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
