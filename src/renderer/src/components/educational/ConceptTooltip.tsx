import { type ReactNode, useState, useRef, useCallback, useMemo } from 'react'
import type { GlossaryTerm } from '@shared/types'
import { useGlossary } from '../../hooks/useGlossary'

interface ConceptTooltipProps {
  /** The term ID to look up in the glossary */
  termId?: string
  /** Alternatively, provide the term object directly */
  term?: GlossaryTerm
  /** The inline text to render (defaults to term.term) */
  children?: ReactNode
}

/**
 * Inline concept tooltip — renders underlined text that shows
 * the glossary definition on hover.
 */
export function ConceptTooltip({ termId, term: termProp, children }: ConceptTooltipProps) {
  const { lookupById } = useGlossary()
  const resolved = termProp ?? (termId ? lookupById(termId) : undefined)
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), 300)
  }, [])

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setVisible(false)
  }, [])

  if (!resolved) {
    return <>{children}</>
  }

  return (
    <span
      className="relative inline"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span className="border-b border-dotted border-accent-primary/60 cursor-help text-text-primary">
        {children ?? resolved.term}
      </span>
      {visible && (
        <span
          role="tooltip"
          className="
            absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
            w-72 px-3 py-2.5
            bg-bg-elevated border border-border-bright rounded-md shadow-lg
            text-xs text-text-primary font-sans
            pointer-events-none fade-in
          "
        >
          <span className="block text-accent-primary font-semibold mb-1">
            {resolved.term}
          </span>
          <span className="block text-text-secondary leading-relaxed">
            {resolved.definition}
          </span>
          {resolved.category && (
            <span className="block mt-1.5 text-text-muted text-[10px] uppercase tracking-wider">
              {resolved.category}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

interface GlossaryHighlightProps {
  /** Raw text to scan for glossary term matches */
  text: string
}

/**
 * Scans a block of text for glossary term matches and wraps them
 * in ConceptTooltip components. Matching is case-insensitive, whole-word only.
 */
export function GlossaryHighlight({ text }: GlossaryHighlightProps) {
  const { terms } = useGlossary()

  const segments = useMemo(() => {
    if (terms.length === 0) return [{ text, term: undefined as GlossaryTerm | undefined }]

    // Build regex from all term names, sorted longest-first to avoid partial matches
    const sorted = [...terms].sort((a, b) => b.term.length - a.term.length)
    const escaped = sorted.map((t) => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')

    // Build lookup map
    const byName = new Map<string, GlossaryTerm>()
    for (const t of terms) byName.set(t.term.toLowerCase(), t)

    const result: { text: string; term: GlossaryTerm | undefined }[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
      // Add text before this match
      if (match.index > lastIndex) {
        result.push({ text: text.slice(lastIndex, match.index), term: undefined })
      }
      // Add the matched term
      const matched = byName.get(match[1].toLowerCase())
      result.push({ text: match[0], term: matched })
      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({ text: text.slice(lastIndex), term: undefined })
    }

    return result
  }, [text, terms])

  return (
    <>
      {segments.map((seg, i) =>
        seg.term ? (
          <ConceptTooltip key={i} term={seg.term}>
            {seg.text}
          </ConceptTooltip>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  )
}
