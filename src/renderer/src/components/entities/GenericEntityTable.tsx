// Generic entity table — renders any entity type as a sortable table using schema fields

import { useState } from 'react'
import type { EntityRecord, ResolvedEntityDef } from '@shared/types/entity'
import { getTableColumns, formatFieldValue } from '../../lib/schema-utils'
import { Badge } from '../common'

interface GenericEntityTableProps {
  entities: EntityRecord[]
  entityDef: ResolvedEntityDef
  onRowClick?: (entity: EntityRecord) => void
}

export function GenericEntityTable({
  entities,
  entityDef,
  onRowClick
}: GenericEntityTableProps): React.JSX.Element {
  const columns = getTableColumns(entityDef)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (colKey: string): void => {
    if (sortCol === colKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(colKey)
      setSortDir('asc')
    }
  }

  const sorted = [...entities].sort((a, b) => {
    if (!sortCol) return 0
    const aVal = a[sortCol]
    const bVal = b[sortCol]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (entities.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-xs font-mono">
        No {entityDef.label_plural.toLowerCase()} found
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-3 py-2 text-text-muted font-normal cursor-pointer hover:text-text-secondary transition-colors"
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                {sortCol === col.key && (
                  <span className="ml-1 text-accent">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entity) => (
            <tr
              key={entity.id}
              className="border-b border-border/50 hover:bg-bg-surface/50 transition-colors cursor-pointer"
              onClick={() => onRowClick?.(entity)}
            >
              {columns.map((col) => {
                const fieldDef = entityDef.fields[col.key]
                const value = entity[col.key]
                const isStatus = fieldDef?.role === 'status'

                return (
                  <td key={col.key} className="px-3 py-2 text-text-secondary">
                    {isStatus && value != null ? (
                      <Badge variant="default" size="sm">{String(value)}</Badge>
                    ) : (
                      fieldDef ? formatFieldValue(value, fieldDef) : String(value ?? '—')
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
