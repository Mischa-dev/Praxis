// Entity detail view — schema-driven detail page for any entity type
// Auto-discovered by view-registry as 'entity-detail-view'

import { useEffect } from 'react'
import { useEntityStore } from '../../stores/entity-store'
import { useUiStore } from '../../stores/ui-store'
import { EntityHeader, EntityTabs } from '../entities'
import { Button } from '../common'
import { ArrowLeft } from 'lucide-react'

interface EntityDetailViewProps {
  params: Record<string, unknown>
}

export default function EntityDetailView({ params }: EntityDetailViewProps): React.JSX.Element {
  const entityType = params.entityType as string
  const entityId = params.entityId as number
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
        Unknown entity type: {entityType}
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

  // Calculate child counts for the header
  const childStats: Record<string, number> = {}
  for (const [type, records] of Object.entries(entityDetail.children)) {
    const childDef = schema?.entities[type]
    if (childDef) {
      childStats[childDef.label_plural] = records.length
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Back button */}
      <div className="px-4 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('entities')}
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
