import { useState, useCallback } from 'react'
import type { GlossaryTerm } from '@shared/types'
import { useGlossary } from '../../hooks/useGlossary'
import { ConceptTooltip } from './ConceptTooltip'

interface ExplanationPanelProps {
  /** The term ID to display */
  termId?: string
  /** Alternatively, provide the term object directly */
  term?: GlossaryTerm
  /** Whether the panel starts expanded */
  defaultExpanded?: boolean
  /** Custom label for the toggle (defaults to "Learn more") */
  label?: string
}

/**
 * Expandable panel that shows the detailed explanation for a glossary term.
 * Includes the full explanation text, related terms, and category.
 */
export function ExplanationPanel({
  termId,
  term: termProp,
  defaultExpanded = false,
  label,
}: ExplanationPanelProps) {
  const { lookupById, getRelated } = useGlossary()
  const resolved = termProp ?? (termId ? lookupById(termId) : undefined)
  const [expanded, setExpanded] = useState(defaultExpanded)

  const toggle = useCallback(() => setExpanded((v) => !v), [])

  if (!resolved) return null

  const relatedTerms = getRelated(resolved.id)
  const hasExplanation = resolved.explanation && resolved.explanation.trim().length > 0

  return (
    <div className="border border-border-default rounded-md overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={toggle}
        className="
          w-full flex items-center gap-2 px-3 py-2
          text-xs font-sans text-text-secondary
          hover:bg-bg-elevated/50 transition-colors
          focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary
        "
      >
        <svg
          className={`w-3 h-3 text-accent-primary transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-accent-primary">
          {label ?? 'Learn more'}
        </span>
        <span className="text-text-muted">
          — {resolved.term}
        </span>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border-default">
          {/* Definition */}
          <p className="mt-2 text-xs text-text-secondary leading-relaxed">
            {resolved.definition}
          </p>

          {/* Detailed explanation */}
          {hasExplanation && (
            <div className="mt-3 text-xs text-text-primary/80 leading-relaxed whitespace-pre-line">
              {resolved.explanation}
            </div>
          )}

          {/* Related terms */}
          {relatedTerms.length > 0 && (
            <div className="mt-3 pt-2 border-t border-border-default">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                Related
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {relatedTerms.map((rt) => (
                  <ConceptTooltip key={rt.id} term={rt}>
                    <span className="
                      inline-block px-1.5 py-0.5 rounded
                      bg-accent-primary/10 text-accent-primary
                      text-[10px] font-mono
                    ">
                      {rt.term}
                    </span>
                  </ConceptTooltip>
                ))}
              </div>
            </div>
          )}

          {/* Category */}
          {resolved.category && (
            <div className="mt-2 text-[10px] uppercase tracking-wider text-text-muted">
              {resolved.category}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface InlineExplanationProps {
  /** Text content with an optional explanation context */
  explanation: string
  /** Title for the panel */
  title?: string
}

/**
 * Simpler explanation panel for inline educational content
 * (action rule explanations, module help text, workflow step descriptions).
 * Does not require a glossary term — just wraps arbitrary explanation text.
 */
export function InlineExplanation({ explanation, title }: InlineExplanationProps) {
  const [expanded, setExpanded] = useState(false)
  const toggle = useCallback(() => setExpanded((v) => !v), [])

  if (!explanation) return null

  return (
    <div className="border border-accent-primary/20 rounded-md overflow-hidden">
      <button
        onClick={toggle}
        className="
          w-full flex items-center gap-2 px-3 py-2
          text-xs font-sans text-text-secondary
          hover:bg-bg-elevated/50 transition-colors
          focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary
        "
      >
        <svg
          className={`w-3 h-3 text-accent-primary transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-accent-primary">
          {title ?? 'What does this do?'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-accent-primary/20">
          <p className="mt-2 text-xs text-text-primary/80 leading-relaxed whitespace-pre-line">
            {explanation}
          </p>
        </div>
      )}
    </div>
  )
}
