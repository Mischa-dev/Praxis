import { Info, BookOpen, Shield } from 'lucide-react'
import type { ParsedResults, Module } from '@shared/types'
import type { Severity } from '@shared/types/results'

interface ResultExplanationProps {
  results: ParsedResults
  module: Module | null
}

/** Severity priority for sorting (lower = more severe) */
const severityOrder: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

export function ResultExplanation({ results, module }: ResultExplanationProps) {
  const { entities, summary } = results
  const totalEntities =
    entities.services.length +
    entities.vulnerabilities.length +
    entities.credentials.length +
    entities.webPaths.length +
    entities.findings.length +
    entities.hosts.length

  if (totalEntities === 0 && !summary) {
    return null
  }

  // Find highest severity across vulns and findings
  const allSeverities = [
    ...entities.vulnerabilities.map((v) => v.severity),
    ...entities.findings.map((f) => f.severity),
  ]
  const highestSeverity = allSeverities.length > 0
    ? allSeverities.sort((a, b) => severityOrder[a] - severityOrder[b])[0]
    : null

  const severityColors: Record<Severity, string> = {
    critical: 'border-severity-critical/30 bg-severity-critical/5',
    high: 'border-severity-high/30 bg-severity-high/5',
    medium: 'border-severity-medium/30 bg-severity-medium/5',
    low: 'border-severity-low/30 bg-severity-low/5',
    info: 'border-accent/20 bg-accent/5',
  }

  const borderClass = highestSeverity ? severityColors[highestSeverity] : 'border-border bg-bg-surface'

  // Build explanation sections
  const sections: { icon: typeof Info; title: string; content: string }[] = []

  // Summary from parser
  if (summary) {
    sections.push({
      icon: Info,
      title: 'Summary',
      content: summary,
    })
  }

  // Services explanation
  if (entities.services.length > 0) {
    const open = entities.services.filter((s) => s.state === 'open')
    const serviceNames = [...new Set(open.map((s) => s.service_name).filter(Boolean))]
    const portList = open
      .slice(0, 8)
      .map((s) => `${s.port}/${s.protocol}`)
      .join(', ')
    const overflow = open.length > 8 ? ` and ${open.length - 8} more` : ''

    sections.push({
      icon: BookOpen,
      title: 'Services Discovered',
      content: `Found ${open.length} open port${open.length !== 1 ? 's' : ''}: ${portList}${overflow}. ` +
        (serviceNames.length > 0
          ? `Identified services: ${serviceNames.join(', ')}. Each open service is a potential entry point that should be investigated further.`
          : 'Service identification was not possible for all ports. Consider running a version detection scan.'),
    })
  }

  // Vulnerability explanation
  if (entities.vulnerabilities.length > 0) {
    const bySeverity = new Map<string, number>()
    for (const v of entities.vulnerabilities) {
      bySeverity.set(v.severity, (bySeverity.get(v.severity) ?? 0) + 1)
    }
    const breakdown = ['critical', 'high', 'medium', 'low', 'info']
      .filter((s) => bySeverity.has(s))
      .map((s) => `${bySeverity.get(s)} ${s}`)
      .join(', ')
    const cves = entities.vulnerabilities.filter((v) => v.cve).map((v) => v.cve!)
    const cveNote = cves.length > 0
      ? ` CVEs found: ${cves.slice(0, 5).join(', ')}${cves.length > 5 ? ` (+${cves.length - 5} more)` : ''}.`
      : ''

    sections.push({
      icon: Shield,
      title: 'Vulnerabilities',
      content: `Detected ${entities.vulnerabilities.length} vulnerabilit${entities.vulnerabilities.length !== 1 ? 'ies' : 'y'}: ${breakdown}.${cveNote} Prioritize critical and high severity findings for remediation or exploitation.`,
    })
  }

  // Credentials explanation
  if (entities.credentials.length > 0) {
    const valid = entities.credentials.filter((c) => c.status === 'valid')
    sections.push({
      icon: Shield,
      title: 'Credentials',
      content: `Found ${entities.credentials.length} credential${entities.credentials.length !== 1 ? 's' : ''}${valid.length > 0 ? ` (${valid.length} confirmed valid)` : ''}. Valid credentials can be used for authenticated access to services.`,
    })
  }

  // Web paths explanation
  if (entities.webPaths.length > 0) {
    const ok = entities.webPaths.filter((w) => w.status_code >= 200 && w.status_code < 300)
    sections.push({
      icon: BookOpen,
      title: 'Web Paths',
      content: `Discovered ${entities.webPaths.length} web path${entities.webPaths.length !== 1 ? 's' : ''} (${ok.length} returning 2xx status). Review paths for sensitive files, admin panels, or interesting endpoints.`,
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
    <div className={`rounded-lg border p-4 space-y-4 ${borderClass}`}>
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
