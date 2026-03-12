// EntityBoard — schema-driven grid view for the primary entity type
// Replaces TargetBoard with a generic, schema-aware implementation.

import { useCallback, useEffect, useState } from 'react'
import type { ResolvedEntityDef, EntityRecord } from '@shared/types/entity'
import { useEntityStore } from '../../stores/entity-store'
import type { EntityRecord } from '@shared/types/entity'
import { EntityCard } from './EntityCard'
import { AddEntityDialog } from './AddEntityDialog'
import { getStatusFieldDef } from '../../lib/schema-utils'
import { getIcon } from '../../lib/icon-map'
import { Badge, EmptyState, Button } from '../common'
import { Plus, Search } from 'lucide-react'

const EMPTY_ENTITIES: EntityRecord[] = []

interface EntityBoardProps {
  entityDef: ResolvedEntityDef
  onEntityClick: (entity: EntityRecord) => void
}

export function EntityBoard({ entityDef, onEntityClick }: EntityBoardProps): React.JSX.Element {
  const entities = useEntityStore((s) => s.caches[entityDef.id]?.entities ?? EMPTY_ENTITIES)
  const loading = useEntityStore((s) => s.caches[entityDef.id]?.loading ?? false)
  const loadEntities = useEntityStore((s) => s.loadEntities)
  const createEntity = useEntityStore((s) => s.createEntity)
  const activeEntityId = useEntityStore((s) => s.activeEntityId)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  useEffect(() => {
    loadEntities(entityDef.id)
  }, [entityDef.id, loadEntities])

  const handleAdd = useCallback(
    async (data: Record<string, unknown>) => {
      await createEntity(entityDef.id, data)
    },
    [entityDef.id, createEntity]
  )

  // Filter entities
  const statusField = getStatusFieldDef(entityDef)
  const filtered = entities.filter((e) => {
    // Status filter
    if (statusFilter && statusField) {
      if (String(e[statusField[0]]) !== statusFilter) return false
    }
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return Object.values(e).some(
        (v) => v != null && String(v).toLowerCase().includes(q)
      )
    }
    return true
  })

  const Icon = getIcon(entityDef.icon)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">
            {entityDef.label_plural}
          </h2>
          <Badge variant="default" size="sm">{entities.length}</Badge>
        </div>
        <button
          className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-accent hover:bg-accent/10 rounded transition-colors"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {/* Search + Status Filter Tabs */}
      <div className="px-4 py-2 space-y-2 border-b border-border/50">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="w-full bg-bg-surface border border-border rounded pl-7 pr-2 py-1 text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent"
            placeholder={`Search ${entityDef.label_plural.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {statusField && statusField[1].values && (
          <div className="flex gap-1">
            <button
              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                !statusFilter ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-secondary'
              }`}
              onClick={() => setStatusFilter(null)}
            >
              All
            </button>
            {statusField[1].values.map((val) => {
              const count = entities.filter((e) => String(e[statusField[0]]) === val).length
              return (
                <button
                  key={val}
                  className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                    statusFilter === val ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-secondary'
                  }`}
                  onClick={() => setStatusFilter(statusFilter === val ? null : val)}
                >
                  {val} ({count})
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && entities.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 rounded" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No matches' : `No ${entityDef.label_plural.toLowerCase()}`}
            description={
              searchQuery
                ? `No ${entityDef.label_plural.toLowerCase()} match "${searchQuery}"`
                : `Add your first ${entityDef.label.toLowerCase()} to get started`
            }
            action={
              !searchQuery
                ? <Button variant="secondary" size="sm" onClick={() => setAddDialogOpen(true)}>Add {entityDef.label}</Button>
                : undefined
            }
          />
        ) : (
          <div className="grid gap-2">
            {filtered.map((entity) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                entityDef={entityDef}
                selected={entity.id === activeEntityId}
                onClick={() => onEntityClick(entity)}
              />
            ))}
          </div>
        )}
      </div>

      <AddEntityDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        entityDef={entityDef}
        onAdd={handleAdd}
      />
    </div>
  )
}
