// Entity detail tabs — generates tabs from child entity types

import { useState, useEffect } from 'react'
import type { ResolvedEntityDef, EntityDetail } from '@shared/types/entity'
import { useEntityStore } from '../../stores/entity-store'
import { GenericEntityTable } from './GenericEntityTable'
import { Tabs } from '../common'
import { getIcon } from '../../lib/icon-map'

interface EntityTabsProps {
  detail: EntityDetail
  parentDef: ResolvedEntityDef
}

export function EntityTabs({ detail, parentDef }: EntityTabsProps): React.JSX.Element {
  const schema = useEntityStore((s) => s.schema)
  const [activeTab, setActiveTab] = useState<string>('')

  // Build tabs from child types
  const childTypes = parentDef.childTypes.filter(
    (t) => schema?.entities[t]
  )

  useEffect(() => {
    if (childTypes.length > 0 && !activeTab) {
      setActiveTab(childTypes[0])
    }
  }, [childTypes, activeTab])

  if (!schema || childTypes.length === 0) {
    return <div className="text-xs text-text-muted p-4">No related data</div>
  }

  const tabs = childTypes.map((type) => {
    const def = schema.entities[type]
    const count = detail.children[type]?.length ?? 0
    const Icon = getIcon(def.icon)
    return {
      id: type,
      label: `${def.label_plural} (${count})`,
      icon: Icon
    }
  })

  const activeDef = schema.entities[activeTab]
  const activeEntities = detail.children[activeTab] ?? []

  return (
    <div className="flex flex-col flex-1">
      <Tabs
        tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="flex-1 overflow-y-auto">
        {activeDef && (
          <GenericEntityTable
            entities={activeEntities}
            entityDef={activeDef}
          />
        )}
      </div>
    </div>
  )
}
