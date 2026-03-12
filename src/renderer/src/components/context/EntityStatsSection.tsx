// Entity stats section for the context panel — shows child entity counts

import { useEntityStore, selectPrimaryType } from '../../stores/entity-store'

export function EntityStatsSection(): React.JSX.Element | null {
  const primaryType = useEntityStore(selectPrimaryType)
  const entityDetail = useEntityStore((s) => s.entityDetail)
  const schema = useEntityStore((s) => s.schema)

  if (!primaryType || !entityDetail || !schema) return null

  const stats: { label: string; value: number }[] = []
  for (const childType of primaryType.childTypes) {
    const childDef = schema.entities[childType]
    if (childDef) {
      const count = entityDetail.children[childType]?.length ?? 0
      stats.push({ label: childDef.label_plural, value: count })
    }
  }

  if (stats.length === 0) return null

  const cols = Math.min(stats.length, 4)

  return (
    <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className={`text-sm font-mono font-bold ${stat.value > 0 ? 'text-accent' : 'text-text-muted'}`}>
            {stat.value}
          </div>
          <div className="text-[8px] font-sans uppercase text-text-muted tracking-wider">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  )
}
