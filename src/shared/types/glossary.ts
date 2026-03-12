// Glossary term types — loaded from profile/glossary/terms.yaml

export interface GlossaryTerm {
  id: string
  term: string
  definition: string
  explanation?: string
  related_terms?: string[]
  category?: string
}
