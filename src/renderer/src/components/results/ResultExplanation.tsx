import { Info, BookOpen } from 'lucide-react'
import type { ParsedResults, Module } from '@shared/types'
import { useEntityStore } from '../../stores/entity-store'

interface ResultExplanationProps {
  results: ParsedResults
  module: Module | null
}

export function ResultExplanation({ results, module }: ResultExplanationProps) {
  const schema = useEntityStore((s) => s.schema)
  const { entities, summary } = results

  // Count total entities across all types
  let totalEntities = 0
  for (const records of Object.values(entities)) {
    if (Array.isArray(records)) totalEntities += records.length
  }

  if (totalEntities === 0 && !summary) {
    return null
  }

  // Build explanation sections dynamically from parsed entity types
  const sections: { icon: typeof Info; title: string; content: string }[] = []

  // Summary from parser
  if (summary) {
    sections.push({
      icon: Info,
      title: 'Summary',
      content: summary,
    })
  }

  // Entity sections — generated from whatever types appear in results
  for (const [entityType, records] of Object.entries(entities)) {
    if (!Array.isArray(records) || records.length === 0) continue

    // Get label from schema, or format the type ID
    const entityDef = schema?.entities[entityType]
    const label = entityDef?.label_plural ?? entityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + 's'
    const singular = entityDef?.label ?? entityType.replace(/_/g, ' ')

    sections.push({
      icon: BookOpen,
      title: `${label} (${records.length})`,
      content: `Found ${records.length} ${records.length === 1 ? singular.toLowerCase() : label.toLowerCase()} from this execution.`,
    })
  }

  // Tool context
  if (module) {
    sections.push({
      icon: Info,
      title: 'About This Tool',
      content: `${module.name}: ${module.description}`,
    })
  }

  return (
    <div className="rounded-lg border border-border bg-bg-surface p-4 space-y-4">
      <h3 className="text-xs font-sans uppercase tracking-wider text-text-muted flex items-center gap-2">
        <BookOpen className="w-3.5 h-3.5" />
        What This Means
      </h3>

      {sections.map((section, i) => {
        const Icon = section.icon
        return (
          <div key={i} className="flex gap-3">
            <Icon className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-sans font-semibold text-text-primary mb-0.5">
                {section.title}
              </h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                {section.content}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
