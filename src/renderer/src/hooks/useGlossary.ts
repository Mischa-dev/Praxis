import { useState, useEffect, useCallback, useMemo } from 'react'
import type { GlossaryTerm } from '@shared/types'

let cachedTerms: GlossaryTerm[] | null = null

/**
 * Hook that loads glossary terms from the profile and provides lookup helpers.
 */
export function useGlossary() {
  const [terms, setTerms] = useState<GlossaryTerm[]>(cachedTerms ?? [])
  const [loading, setLoading] = useState(!cachedTerms)

  useEffect(() => {
    if (cachedTerms) return

    let cancelled = false
    setLoading(true)

    window.api
      .invoke('glossary:list')
      .then((result) => {
        if (cancelled) return
        const loaded = result as GlossaryTerm[]
        cachedTerms = loaded
        setTerms(loaded)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  /** Map from term ID to term object */
  const termById = useMemo(() => {
    const map = new Map<string, GlossaryTerm>()
    for (const t of terms) map.set(t.id, t)
    return map
  }, [terms])

  /** Map from lowercased display term to term object (for text matching) */
  const termByName = useMemo(() => {
    const map = new Map<string, GlossaryTerm>()
    for (const t of terms) map.set(t.term.toLowerCase(), t)
    return map
  }, [terms])

  /** Look up a term by ID */
  const lookupById = useCallback(
    (id: string): GlossaryTerm | undefined => termById.get(id),
    [termById]
  )

  /** Look up a term by display name (case-insensitive) */
  const lookupByName = useCallback(
    (name: string): GlossaryTerm | undefined => termByName.get(name.toLowerCase()),
    [termByName]
  )

  /** Get related terms for a given term ID */
  const getRelated = useCallback(
    (termId: string): GlossaryTerm[] => {
      const term = termById.get(termId)
      if (!term?.related_terms) return []
      return term.related_terms
        .map((id) => termById.get(id))
        .filter((t): t is GlossaryTerm => t !== undefined)
    },
    [termById]
  )

  /** Terms grouped by category */
  const termsByCategory = useMemo(() => {
    const map = new Map<string, GlossaryTerm[]>()
    for (const t of terms) {
      const cat = t.category ?? 'general'
      const list = map.get(cat) ?? []
      list.push(t)
      map.set(cat, list)
    }
    return map
  }, [terms])

  return {
    terms,
    loading,
    lookupById,
    lookupByName,
    getRelated,
    termsByCategory,
  }
}
