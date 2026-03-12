/**
 * Action engine — loads action rule YAML files from profile/actions/,
 * evaluates conditions against target state, resolves template variables,
 * and returns matching EvaluatedAction[].
 *
 * This engine is fully generic: it evaluates YAML conditions and never
 * hardcodes any domain-specific "if X then Y" logic. All domain knowledge
 * lives in the profile action YAML files.
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, extname } from 'path'
import * as yaml from 'js-yaml'
import { validateActionRuleFile } from '@shared/schemas/action-schema'
import type {
  ActionRule,
  ActionRuleFile,
  ActionCondition,
  EvaluatedAction
} from '@shared/types/action'
import type { Target, TargetDetail, Service } from '@shared/types/target'
import type { Vulnerability, Credential, Finding, WebPath } from '@shared/types/results'
import type { Scan } from '@shared/types/scan'

// ---------------------------------------------------------------------------
// Types for the target context used during condition evaluation
// ---------------------------------------------------------------------------

/** All the data needed to evaluate action rules for a target */
export interface TargetContext {
  target: Target
  services: Service[]
  vulnerabilities: Vulnerability[]
  credentials: Credential[]
  webPaths: WebPath[]
  findings: Finding[]
  scans: Scan[]
}

/** Template variable context built from matched entities */
interface TemplateContext {
  target: Target
  service?: Service
  credential?: Credential
  vuln?: Vulnerability
  finding?: Finding
}

// ---------------------------------------------------------------------------
// Action rule cache
// ---------------------------------------------------------------------------

let cachedRules: ActionRule[] | null = null

/**
 * Load all action rule YAML files from the given directory.
 * Validates each file and collects all rules into a flat list.
 */
export function loadActionRules(actionsDir: string): ActionRule[] {
  if (cachedRules) return cachedRules

  if (!existsSync(actionsDir)) {
    cachedRules = []
    return cachedRules
  }

  const files = readdirSync(actionsDir).filter(
    (f) => extname(f) === '.yaml' || extname(f) === '.yml'
  )

  const allRules: ActionRule[] = []

  for (const file of files) {
    const filePath = join(actionsDir, file)
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data = yaml.load(raw)

      const result = validateActionRuleFile(data)
      if (!result.valid) {
        const details = result.errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')
        console.warn(`Invalid action rule file ${file}:\n${details}`)
        continue
      }

      const ruleFile = data as ActionRuleFile
      for (const rule of ruleFile.rules) {
        allRules.push(rule)
      }
    } catch (err) {
      console.warn(`Failed to load action rule file ${file}:`, err)
    }
  }

  cachedRules = allRules
  return cachedRules
}

/**
 * Clear the action rule cache (for testing or profile reload).
 */
export function clearActionRuleCache(): void {
  cachedRules = null
}

// ---------------------------------------------------------------------------
// Condition evaluators
// ---------------------------------------------------------------------------

/**
 * Evaluate a single condition against the target context.
 * Returns the matched entity (e.g. the specific Service) or true/false.
 * The matched entity is used for template variable resolution.
 */
function evaluateCondition(
  condition: ActionCondition,
  ctx: TargetContext
): { match: boolean; service?: Service; credential?: Credential; vuln?: Vulnerability; finding?: Finding } {
  switch (condition.type) {
    case 'no_scans':
      return { match: ctx.scans.length === 0 }

    case 'service_exists': {
      const svc = ctx.services.find(
        (s) =>
          s.state === 'open' &&
          s.service_name?.toLowerCase() === condition.service_name.toLowerCase()
      )
      return { match: !!svc, service: svc }
    }

    case 'port_open': {
      const proto = condition.protocol ?? 'tcp'
      const svc = ctx.services.find(
        (s) => s.port === condition.port && s.protocol === proto && s.state === 'open'
      )
      return { match: !!svc, service: svc }
    }

    case 'port_range': {
      const proto = condition.protocol ?? 'tcp'
      const svc = ctx.services.find(
        (s) =>
          s.port >= condition.min &&
          s.port <= condition.max &&
          s.protocol === proto &&
          s.state === 'open'
      )
      return { match: !!svc, service: svc }
    }

    case 'os_matches': {
      if (!ctx.target.os_guess) return { match: false }
      try {
        const regex = new RegExp(condition.pattern, 'i')
        return { match: regex.test(ctx.target.os_guess) }
      } catch {
        return { match: false }
      }
    }

    case 'vuln_found': {
      let vulns = ctx.vulnerabilities
      if (condition.severity) {
        const sevOrder = ['info', 'low', 'medium', 'high', 'critical']
        const minIdx = sevOrder.indexOf(condition.severity.toLowerCase())
        if (minIdx >= 0) {
          vulns = vulns.filter((v) => sevOrder.indexOf(v.severity) >= minIdx)
        }
      }
      if (condition.cve) {
        vulns = vulns.filter((v) => v.cve === condition.cve)
      }
      const vuln = vulns[0]
      return { match: vulns.length > 0, vuln }
    }

    case 'credential_found': {
      let creds = ctx.credentials
      if (condition.service_name) {
        // Match credential source against service name (source contains the tool/service)
        const svcName = condition.service_name.toLowerCase()
        // Check if any credential was found for a service with this name
        const svcIds = ctx.services
          .filter((s) => s.service_name?.toLowerCase() === svcName)
          .map((s) => s.id)
        creds = creds.filter((c) => c.service_id !== null && svcIds.includes(c.service_id))
      }
      const cred = creds[0]
      return { match: creds.length > 0, credential: cred }
    }

    case 'scan_completed': {
      const hasRun = ctx.scans.some(
        (s) => s.tool_id === condition.tool && s.status === 'completed'
      )
      const result = condition.negate ? !hasRun : hasRun
      return { match: result }
    }

    case 'product_version': {
      try {
        const productRe = new RegExp(condition.product, 'i')
        const versionRe = new RegExp(condition.version, 'i')
        const svc = ctx.services.find(
          (s) =>
            s.product !== null &&
            productRe.test(s.product) &&
            s.service_version !== null &&
            versionRe.test(s.service_version)
        )
        return { match: !!svc, service: svc }
      } catch {
        return { match: false }
      }
    }

    case 'web_path_found': {
      let paths = ctx.webPaths
      if (condition.status_code !== undefined) {
        paths = paths.filter((p) => p.status_code === condition.status_code)
      }
      if (condition.path_pattern) {
        try {
          const regex = new RegExp(condition.path_pattern, 'i')
          paths = paths.filter((p) => regex.test(p.path))
        } catch {
          return { match: false }
        }
      }
      return { match: paths.length > 0 }
    }

    case 'finding_exists': {
      const found = ctx.findings.find(
        (f) => f.type.toLowerCase() === condition.finding_type.toLowerCase()
      )
      return { match: !!found, finding: found }
    }

    case 'technology_detected': {
      try {
        const regex = new RegExp(condition.technology, 'i')
        const found = ctx.findings.find(
          (f) => f.type === 'technology' && regex.test(f.title)
        )
        return { match: !!found, finding: found }
      } catch {
        return { match: false }
      }
    }

    // ── Generic condition types ──

    case 'entity_exists': {
      const entities = getEntityArray(ctx, condition.entity)
      if (!entities) return { match: false }
      const matched = condition.match
        ? entities.find((e) => matchesFilters(e, condition.match!))
        : entities[0]
      const result = condition.match ? !!matched : entities.length > 0
      return {
        match: result,
        service: condition.entity === 'service' ? matched as unknown as Service : undefined,
        credential: condition.entity === 'credential' ? matched as unknown as Credential : undefined,
        vuln: condition.entity === 'vulnerability' ? matched as unknown as Vulnerability : undefined,
        finding: condition.entity === 'finding' ? matched as unknown as Finding : undefined
      }
    }

    case 'entity_count': {
      const entities = getEntityArray(ctx, condition.entity)
      if (!entities) return { match: false }
      const filtered = condition.match
        ? entities.filter((e) => matchesFilters(e, condition.match!))
        : entities
      const count = filtered.length
      const result = compareOp(count, condition.op, condition.value)
      return { match: result }
    }

    case 'field_matches': {
      const entities = getEntityArray(ctx, condition.entity)
      if (!entities) return { match: false }
      try {
        const regex = new RegExp(condition.pattern, 'i')
        // For the primary entity (target), check the target directly
        if (condition.entity === 'target' || condition.entity === ctx.target.type) {
          const val = (ctx.target as unknown as Record<string, unknown>)[condition.field]
          return { match: val !== null && val !== undefined && regex.test(String(val)) }
        }
        const matched = entities.find((e) => {
          const val = (e as unknown as Record<string, unknown>)[condition.field]
          return val !== null && val !== undefined && regex.test(String(val))
        })
        return { match: !!matched }
      } catch {
        return { match: false }
      }
    }

    case 'entity_field_range': {
      const entities = getEntityArray(ctx, condition.entity)
      if (!entities) return { match: false }
      const matched = entities.find((e) => {
        const val = Number((e as unknown as Record<string, unknown>)[condition.field])
        if (isNaN(val)) return false
        if (condition.min !== undefined && val < condition.min) return false
        if (condition.max !== undefined && val > condition.max) return false
        return true
      })
      return {
        match: !!matched,
        service: condition.entity === 'service' ? matched as unknown as Service : undefined
      }
    }

    default:
      return { match: false }
  }
}

// ---------------------------------------------------------------------------
// Generic condition helpers
// ---------------------------------------------------------------------------

/** Map entity type names to TargetContext arrays */
function getEntityArray(ctx: TargetContext, entityType: string): unknown[] | null {
  switch (entityType) {
    case 'service': return ctx.services
    case 'vulnerability': return ctx.vulnerabilities
    case 'credential': return ctx.credentials
    case 'web_path': return ctx.webPaths
    case 'finding': return ctx.findings
    case 'scan': return ctx.scans
    case 'target': return [ctx.target]
    default: return null
  }
}

/** Check if an entity matches a set of field filters */
function matchesFilters(entity: unknown, filters: Record<string, unknown>): boolean {
  const obj = entity as Record<string, unknown>
  for (const [key, val] of Object.entries(filters)) {
    const entityVal = obj[key]
    if (typeof val === 'string' && typeof entityVal === 'string') {
      if (entityVal.toLowerCase() !== val.toLowerCase()) return false
    } else if (entityVal !== val) {
      return false
    }
  }
  return true
}

/** Compare a number using the given operator */
function compareOp(a: number, op: string, b: number): boolean {
  switch (op) {
    case '==': return a === b
    case '!=': return a !== b
    case '>': return a > b
    case '<': return a < b
    case '>=': return a >= b
    case '<=': return a <= b
    default: return false
  }
}

// ---------------------------------------------------------------------------
// Template variable resolution
// ---------------------------------------------------------------------------

/**
 * Resolve template variables in a string using `${...}` syntax.
 * Supports: target.*, service.*, credential.*, vuln.*, finding.*
 */
function resolveTemplate(template: string, tplCtx: TemplateContext): string {
  return template.replace(/\$\{([^}]+)\}/g, (fullMatch, expr: string) => {
    const parts = expr.trim().split('.')
    if (parts.length !== 2) return fullMatch

    const [ns, field] = parts
    let source: Record<string, unknown> | undefined

    switch (ns) {
      case 'target':
        source = tplCtx.target as unknown as Record<string, unknown>
        break
      case 'service':
        source = tplCtx.service as unknown as Record<string, unknown>
        break
      case 'credential':
        source = tplCtx.credential as unknown as Record<string, unknown>
        break
      case 'vuln':
        source = tplCtx.vuln as unknown as Record<string, unknown>
        break
      case 'finding':
        source = tplCtx.finding as unknown as Record<string, unknown>
        break
      default:
        return fullMatch
    }

    if (!source) return fullMatch

    const value = source[field]
    if (value === undefined || value === null) return ''
    return String(value)
  })
}

/**
 * Resolve auto_args template values for a matched action.
 */
function resolveAutoArgs(
  autoArgs: Record<string, string> | undefined,
  tplCtx: TemplateContext
): Record<string, unknown> {
  if (!autoArgs) return {}

  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(autoArgs)) {
    resolved[key] = resolveTemplate(value, tplCtx)
  }
  return resolved
}

// ---------------------------------------------------------------------------
// Main evaluation function
// ---------------------------------------------------------------------------

/**
 * Evaluate all loaded action rules against a target's current state.
 * Returns a list of EvaluatedAction objects sorted by priority (lower first).
 */
export function evaluateActions(
  rules: ActionRule[],
  ctx: TargetContext
): EvaluatedAction[] {
  const results: EvaluatedAction[] = []

  for (const rule of rules) {
    // All conditions must match (AND logic)
    let allMatch = true
    let matchedService: Service | undefined
    let matchedCredential: Credential | undefined
    let matchedVuln: Vulnerability | undefined
    let matchedFinding: Finding | undefined

    for (const condition of rule.conditions) {
      const evalResult = evaluateCondition(condition, ctx)
      if (!evalResult.match) {
        allMatch = false
        break
      }
      // Capture matched entities for template resolution
      if (evalResult.service) matchedService = evalResult.service
      if (evalResult.credential) matchedCredential = evalResult.credential
      if (evalResult.vuln) matchedVuln = evalResult.vuln
      if (evalResult.finding) matchedFinding = evalResult.finding
    }

    if (!allMatch) continue

    // Build template context from matched entities
    const tplCtx: TemplateContext = {
      target: ctx.target,
      service: matchedService,
      credential: matchedCredential,
      vuln: matchedVuln,
      finding: matchedFinding
    }

    // Produce an EvaluatedAction for each action in the rule
    for (const action of rule.actions) {
      results.push({
        ruleId: rule.id,
        actionId: action.id,
        title: resolveTemplate(action.title, tplCtx),
        description: resolveTemplate(action.description ?? rule.description, tplCtx),
        tool: action.tool,
        riskLevel: action.risk_level,
        autoArgs: resolveAutoArgs(action.auto_args, tplCtx),
        explanation: resolveTemplate(action.explanation, tplCtx),
        oneClick: action.one_click ?? false,
        priority: rule.priority ?? 50,
        category: rule.category
      })
    }
  }

  // Sort by priority (lower = more important = shown first)
  results.sort((a, b) => a.priority - b.priority)

  return results
}

/**
 * Build a TargetContext from a TargetDetail (which includes all related entities).
 */
export function buildContextFromDetail(detail: TargetDetail): TargetContext {
  return {
    target: {
      id: detail.id,
      type: detail.type,
      value: detail.value,
      label: detail.label,
      os_guess: detail.os_guess,
      scope_status: detail.scope_status,
      tags: detail.tags,
      notes: detail.notes,
      status: detail.status,
      created_at: detail.created_at,
      updated_at: detail.updated_at
    },
    services: detail.services,
    vulnerabilities: detail.vulnerabilities,
    credentials: detail.credentials,
    webPaths: detail.web_paths,
    findings: detail.findings,
    scans: detail.scans
  }
}

/**
 * High-level convenience: given a TargetDetail, load rules and evaluate.
 */
export function getActionsForTarget(
  actionsDir: string,
  detail: TargetDetail
): EvaluatedAction[] {
  const rules = loadActionRules(actionsDir)
  const ctx = buildContextFromDetail(detail)
  return evaluateActions(rules, ctx)
}
