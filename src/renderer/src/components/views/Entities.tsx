// Entities view — generic board view for the primary entity type
// Auto-discovered by view-registry as 'entities'

import { useEntityStore, selectPrimaryType } from '../../stores/entity-store'
import { useUiStore } from '../../stores/ui-store'
import { EntityBoard } from '../entities'
import type { EntityRecord } from '@shared/types/entity'

export default function Entities(): React.JSX.Element {
  const primaryType = useEntityStore(selectPrimaryType)
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity)
  const navigate = useUiStore((s) => s.navigate)

  const handleEntityClick = (entity: EntityRecord): void => {
    setActiveEntity(entity.id)
    navigate('entity-detail-view', { entityType: primaryType?.id, entityId: entity.id })
  }

  if (!primaryType) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs font-mono">
        No entity schema loaded
      </div>
    )
  }

  return <EntityBoard entityDef={primaryType} onEntityClick={handleEntityClick} />
}
