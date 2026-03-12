// TargetDetail view — renders the generic EntityDetail for the primary entity type.
// Keeps backward compat with navigate('target-detail', { targetId }) calls.

import { useEffect } from 'react'
import { useEntityStore } from '../../stores/entity-store'
import { useUiStore } from '../../stores/ui-store'
import { EntityHeader, EntityTabs } from '../entities'
import { Button } from '../common'
import { ArrowLeft } from 'lucide-react'

interface TargetDetailProps {
  params: Record<string, unknown>
}

export default function TargetDetail({ params }: TargetDetailProps): React.JSX.Element {
  // Support both old { targetId } and new { entityType, entityId } param shapes
  const entityType = (params.entityType as string) || useEntityStore.getState().schema?.primaryEntity || ''
  const entityId = (params.entityId ?? params.targetId) as number
  const schema = useEntityStore((s) => s.schema)
  const entityDetail = useEntityStore((s) => s.entityDetail)
  const loadEntityDetail = useEntityStore((s) => s.loadEntityDetail)
  const loading = useEntityStore((s) => s.loading)
  const navigate = useUiStore((s) => s.navigate)

  useEffect(() => {
    if (entityType && entityId) {
      loadEntityDetail(entityType, entityId)
    }
  }, [entityType, entityId, loadEntityDetail])

  const entityDef = schema?.entities[entityType]

  if (!entityDef) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs font-mono">
        {loading ? 'Loading...' : `Unknown entity type: ${entityType}`}
      </div>
    )
  }

  if (loading && !entityDetail) {
    return (
      <div className="p-4 space-y-3">
        <div className="skeleton h-16 rounded" />
        <div className="skeleton h-8 rounded" />
        <div className="skeleton h-48 rounded" />
      </div>
    )
  }

  if (!entityDetail) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs font-mono">
        Entity not found
      </div>
    )
  }

  const childStats: Record<string, number> = {}
  for (const [type, records] of Object.entries(entityDetail.children)) {
    const childDef = schema?.entities[type]
    if (childDef) {
      childStats[childDef.label_plural] = records.length
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('targets')}
          className="text-text-muted"
        >
          <ArrowLeft size={12} className="mr-1" />
          Back to {entityDef.label_plural}
        </Button>
      </div>

      <EntityHeader
        entity={entityDetail.entity}
        entityDef={entityDef}
        stats={childStats}
      />

      <EntityTabs detail={entityDetail} parentDef={entityDef} />
    </div>
  )
}
