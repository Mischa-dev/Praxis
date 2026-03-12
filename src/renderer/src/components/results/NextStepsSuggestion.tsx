import { ArrowRight, Zap } from 'lucide-react'
import { Card, Badge } from '../common'
import { useModuleStore } from '../../stores/module-store'
import { useUiStore } from '../../stores/ui-store'
import type { ParsedResults, Module, ModuleSuggestion } from '@shared/types'

interface NextStepsSuggestionProps {
  results: ParsedResults
  module: Module | null
  targetId?: number | null
}

/** Resolved suggestion with its display info */
interface ResolvedSuggestion {
  suggestion: ModuleSuggestion
  suggestedModule: Module | undefined
  resolvedMessage: string
  priority: number
}

/**
 * Evaluate a suggestion condition against parsed results.
 * Conditions are simple expressions like:
 * - "open_ports > 0"
 * - "service:ssh"
 * - "service:http OR service:https"
 * - "vuln_count > 0"
 * - "any_service"
 * - "web_paths > 0"
 * - "credentials > 0"
 *
 * This is a best-effort evaluator — unrecognized conditions default to true
 * if results contain entities (the action engine does full condition evaluation).
 */
function evaluateCondition(condition: string, results: ParsedResults): boolean {
  const { entities } = results
  const lower = condition.toLowerCase().trim()

  // Handle OR conditions
  if (lower.includes(' or ')) {
    return lower.split(/\s+or\s+/).some((part) => evaluateCondition(part.trim(), results))
  }

  // Handle AND conditions
  if (lower.includes(' and ')) {
    return lower.split(/\s+and\s+/).every((part) => evaluateCondition(part.trim(), results))
  }

  // "service:<name>" — check if any service with that name was found
  const serviceMatch = lower.match(/^service[_:](\w+)$/)
  if (serviceMatch) {
    const svcName = serviceMatch[1]
    return entities.services.some(
      (s) => s.state === 'open' && s.service_name?.toLowerCase().includes(svcName)
    )
  }

  // "port:<number>" — check if a specific port is open
  const portMatch = lower.match(/^port[_:](\d+)$/)
  if (portMatch) {
    const portNum = parseInt(portMatch[1], 10)
    return entities.services.some((s) => s.state === 'open' && s.port === portNum)
  }

  // Numeric comparisons
  const cmpMatch = lower.match(/^(\w+)\s*(>|>=|<|<=|==|!=)\s*(\d+)$/)
  if (cmpMatch) {
    const [, field, op, valStr] = cmpMatch
    const val = parseInt(valStr, 10)
    let actual = 0

    switch (field) {
      case 'open_ports':
        actual = entities.services.filter((s) => s.state === 'open').length
        break
      case 'services':
      case 'service_count':
        actual = entities.services.length
        break
      case 'vulns':
      case 'vuln_count':
      case 'vulnerabilities':
        actual = entities.vulnerabilities.length
        break
      case 'credentials':
      case 'cred_count':
        actual = entities.credentials.length
        break
      case 'web_paths':
      case 'path_count':
        actual = entities.webPaths.length
        break
      case 'findings':
      case 'finding_count':
        actual = entities.findings.length
        break
      case 'hosts':
      case 'host_count':
        actual = entities.hosts.length
        break
      default:
        return true // Unknown field — default to showing suggestion
    }

    switch (op) {
      case '>': return actual > val
      case '>=': return actual >= val
      case '<': return actual < val
      case '<=': return actual <= val
      case '==': return actual === val
      case '!=': return actual !== val
    }
  }

  // Simple boolean conditions
  if (lower === 'any_service' || lower === 'any_services') {
    return entities.services.length > 0
  }
  if (lower === 'any_vuln' || lower === 'any_vulns') {
    return entities.vulnerabilities.length > 0
  }
  if (lower === 'any_creds' || lower === 'any_credentials') {
    return entities.credentials.length > 0
  }
  if (lower === 'always' || lower === 'true') {
    return true
  }

  // Default: show the suggestion if we have any results at all
  return entities.services.length > 0 ||
    entities.vulnerabilities.length > 0 ||
    entities.webPaths.length > 0 ||
    entities.credentials.length > 0 ||
    entities.findings.length > 0
}

/**
 * Resolve template variables in a message string.
 * Replaces ${open_ports}, ${services}, etc. with actual values.
 */
function resolveMessage(template: string, results: ParsedResults): string {
  const { entities } = results
  const openPorts = entities.services.filter((s) => s.state === 'open')

  return template
    .replace(/\$\{open_ports\}/g, openPorts.map((s) => String(s.port)).join(', '))
    .replace(/\$\{open_port_count\}/g, String(openPorts.length))
    .replace(/\$\{service_count\}/g, String(entities.services.length))
    .replace(/\$\{vuln_count\}/g, String(entities.vulnerabilities.length))
    .replace(/\$\{cred_count\}/g, String(entities.credentials.length))
    .replace(/\$\{path_count\}/g, String(entities.webPaths.length))
    .replace(/\$\{finding_count\}/g, String(entities.findings.length))
    .replace(/\$\{host_count\}/g, String(entities.hosts.length))
}

export function NextStepsSuggestion({ results, module, targetId }: NextStepsSuggestionProps) {
  const navigate = useUiStore((s) => s.navigate)
  const allModules = useModuleStore((s) => s.modules)

  if (!module?.suggestions || module.suggestions.length === 0) {
    return null
  }

  // Evaluate suggestions and resolve their data
  const resolved: ResolvedSuggestion[] = module.suggestions
    .filter((s) => evaluateCondition(s.condition, results))
    .map((s) => ({
      suggestion: s,
      suggestedModule: allModules.find((m) => m.id === s.suggest),
      resolvedMessage: resolveMessage(s.message, results),
      priority: s.priority ?? 50,
    }))
    .sort((a, b) => b.priority - a.priority) // Higher priority first

  if (resolved.length === 0) {
    return null
  }

  const handleLaunch = (suggestion: ResolvedSuggestion) => {
    const params: Record<string, unknown> = {
      moduleId: suggestion.suggestion.suggest,
    }
    if (targetId) {
      params.targetId = targetId
    }
    if (suggestion.suggestion.auto_args) {
      params.autoArgs = suggestion.suggestion.auto_args
    }
    navigate('tool-form', params)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-sans uppercase tracking-wider text-text-muted flex items-center gap-2">
        <Zap className="w-3.5 h-3.5" />
        Suggested Next Steps
      </h3>

      <div className="grid gap-2">
        {resolved.map((item, i) => {
          const SuggestedMod = item.suggestedModule
          return (
            <Card
              key={i}
              hoverable
              padding="sm"
              className="group"
              onClick={() => handleLaunch(item)}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 p-1.5 rounded bg-accent/10 text-accent">
                  <ArrowRight className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-sans font-semibold text-text-primary">
                      {SuggestedMod?.name ?? item.suggestion.suggest}
                    </span>
                    {SuggestedMod && !SuggestedMod.installed && (
                      <Badge variant="error" className="text-[9px]">NOT INSTALLED</Badge>
                    )}
                    {item.priority >= 80 && (
                      <Badge variant="accent" className="text-[9px]">RECOMMENDED</Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {item.resolvedMessage}
                  </p>
                </div>

                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors flex-shrink-0" />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
