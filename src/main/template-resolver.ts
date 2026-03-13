/**
 * Template resolver — shared template expression resolution used by both
 * the workflow engine and the pipeline engine.
 *
 * Resolves ${...} template expressions against target data, step/node results,
 * extracted variables, and pipeline variables. Supports pipe functions for
 * data transformation and compound conditions with logical operators.
 *
 * Domain-agnostic — all domain knowledge lives in the profile.
 */

import type { EntityRecord } from '@shared/types/entity'
import type { ParsedResults } from '@shared/types/results'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StepResultData {
  scanId: number
  status: 'completed' | 'failed' | 'cancelled'
  parsedResults: ParsedResults | null
  output?: string
}

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

/**
 * Resolve template expressions like ${target.value}, ${steps.port_scan.open_ports},
 * ${nodes.port_scan.results.services}, ${vars.my_variable}, and pipe functions
 * like | join(',').
 *
 * Accepts both `steps.*` and `nodes.*` prefixes for referencing prior results.
 */
export function resolveTemplate(
  template: string,
  target: EntityRecord | null,
  stepResults: Map<string, StepResultData>,
  stepExtracted: Map<string, Record<string, unknown>>,
  item?: unknown,
  variables?: Map<string, unknown>
): unknown {
  // Match ${...} expressions
  const singleExpr = /^\$\{(.+)\}$/.exec(template.trim())

  // If the entire value is a single expression, return the raw value (could be array/object)
  if (singleExpr) {
    return evaluateExpression(singleExpr[1].trim(), target, stepResults, stepExtracted, item, variables)
  }

  // Otherwise, interpolate multiple expressions within the string
  return template.replace(/\$\{([^}]+)\}/g, (_, expr: string) => {
    const val = evaluateExpression(expr.trim(), target, stepResults, stepExtracted, item, variables)
    if (Array.isArray(val)) return val.join(',')
    if (val === null || val === undefined) return ''
    return String(val)
  })
}

export function evaluateExpression(
  expr: string,
  target: EntityRecord | null,
  stepResults: Map<string, StepResultData>,
  stepExtracted: Map<string, Record<string, unknown>>,
  item?: unknown,
  variables?: Map<string, unknown>
): unknown {
  // Split by pipe for pipe functions: "steps.x.open_ports | join(',')"
  const pipeParts = expr.split('|').map((s) => s.trim())
  const basePath = pipeParts[0]

  let value = resolveBasePath(basePath, target, stepResults, stepExtracted, item, variables)

  // Apply pipe functions
  for (let i = 1; i < pipeParts.length; i++) {
    value = applyPipeFunction(pipeParts[i], value)
  }

  return value
}

export function resolveBasePath(
  path: string,
  target: EntityRecord | null,
  stepResults: Map<string, StepResultData>,
  stepExtracted: Map<string, Record<string, unknown>>,
  item?: unknown,
  variables?: Map<string, unknown>
): unknown {
  // item reference (for for_each iterations)
  if (path === 'item') return item
  if (path.startsWith('item.')) {
    return getNestedValue(item, path.slice(5))
  }

  // vars.* references (pipeline variables)
  if (path === 'vars') {
    return variables ? Object.fromEntries(variables) : undefined
  }
  if (path.startsWith('vars.')) {
    return variables?.get(path.slice(5))
  }

  // target.* references — graceful when target is null
  if (path.startsWith('target.')) {
    if (!target) return undefined
    const field = path.slice(7)
    return getNestedValue(target, field)
  }

  // steps.<id>.* or nodes.<id>.* references
  const stepsMatch = /^(?:steps|nodes)\.([^.]+)\.(.+)$/.exec(path)
  if (stepsMatch) {
    const [, stepId, remainder] = stepsMatch

    // Check extracted variables first
    const extracted = stepExtracted.get(stepId)
    if (extracted) {
      const extractedVal = getNestedValue(extracted, remainder)
      if (extractedVal !== undefined) return extractedVal
    }

    // Fall back to step results
    const stepData = stepResults.get(stepId)
    if (!stepData) return undefined

    // "output" accessor for raw stdout
    if (remainder === 'output') {
      return stepData.output
    }

    if (!stepData.parsedResults && remainder !== 'status' && remainder !== 'scanId') {
      return undefined
    }

    // "results.*" paths access parsed results
    if (remainder.startsWith('results.')) {
      return getNestedValue(stepData.parsedResults, remainder.slice(8))
    }

    return getNestedValue(stepData, remainder)
  }

  return undefined
}

export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined

  const segments = path.split('.')
  let current: unknown = obj

  for (const seg of segments) {
    if (current === null || current === undefined) return undefined

    // Handle array filter notation: "services[state=='open']"
    const filterMatch = /^(\w+)\[(\w+)==['"]([^'"]+)['"]\]$/.exec(seg)
    if (filterMatch) {
      const [, arrayField, filterKey, filterVal] = filterMatch
      const arr = (current as Record<string, unknown>)[arrayField]
      if (!Array.isArray(arr)) return []
      current = arr.filter(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          String((item as Record<string, unknown>)[filterKey]) === filterVal
      )
      continue
    }

    // Handle array wildcard: "hosts[*]"
    const wildcardMatch = /^(\w+)\[\*\]$/.exec(seg)
    if (wildcardMatch) {
      const arr = (current as Record<string, unknown>)[wildcardMatch[1]]
      if (!Array.isArray(arr)) return []
      current = arr
      continue
    }

    // Standard property access
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[seg]
    } else {
      return undefined
    }
  }

  return current
}

// ---------------------------------------------------------------------------
// Pipe functions
// ---------------------------------------------------------------------------

export function applyPipeFunction(funcStr: string, value: unknown): unknown {
  // join('separator')
  const joinMatch = /^join\(['"]([^'"]*)['"]\)$/.exec(funcStr)
  if (joinMatch) {
    if (!Array.isArray(value)) return String(value ?? '')
    return value.map(String).join(joinMatch[1])
  }

  // where('field', 'value')
  const whereMatch = /^where\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)$/.exec(funcStr)
  if (whereMatch) {
    if (!Array.isArray(value)) return []
    const [, field, expected] = whereMatch
    return value.filter(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        String((item as Record<string, unknown>)[field]) === expected
    )
  }

  // has_service('name') — filters array items where `service_name` matches a given value
  const hasServiceMatch = /^has_service\(['"]([^'"]+)['"]\)$/.exec(funcStr)
  if (hasServiceMatch) {
    if (!Array.isArray(value)) return false
    const name = hasServiceMatch[1]
    return value.some(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        String((item as Record<string, unknown>)['service_name']) === name
    )
  }

  // count
  if (funcStr === 'count') {
    if (Array.isArray(value)) return value.length
    return 0
  }

  // first
  if (funcStr === 'first') {
    if (Array.isArray(value) && value.length > 0) return value[0]
    return undefined
  }

  // pluck('field')
  const pluckMatch = /^pluck\(['"]([^'"]+)['"]\)$/.exec(funcStr)
  if (pluckMatch) {
    if (!Array.isArray(value)) return []
    const field = pluckMatch[1]
    return value.map((item) => {
      if (typeof item === 'object' && item !== null) {
        return (item as Record<string, unknown>)[field]
      }
      return undefined
    })
  }

  // unique
  if (funcStr === 'unique') {
    if (!Array.isArray(value)) return value
    return [...new Set(value.map(String))]
  }

  // trim
  if (funcStr === 'trim') {
    return typeof value === 'string' ? value.trim() : String(value ?? '')
  }

  // upper / lower
  if (funcStr === 'upper') {
    return typeof value === 'string' ? value.toUpperCase() : String(value ?? '').toUpperCase()
  }
  if (funcStr === 'lower') {
    return typeof value === 'string' ? value.toLowerCase() : String(value ?? '').toLowerCase()
  }

  // length
  if (funcStr === 'length') {
    if (Array.isArray(value)) return value.length
    if (typeof value === 'string') return value.length
    return 0
  }

  // toNumber / toString / toBool
  if (funcStr === 'toNumber') {
    const n = Number(value)
    return isNaN(n) ? 0 : n
  }
  if (funcStr === 'toString') {
    return String(value ?? '')
  }
  if (funcStr === 'toBool') {
    if (typeof value === 'string') return value.toLowerCase() !== 'false' && value !== '0' && value !== ''
    return Boolean(value)
  }

  // exists
  if (funcStr === 'exists') {
    return value !== null && value !== undefined
  }

  // split('delim')
  const splitMatch = /^split\(['"]([^'"]*)['"]\)$/.exec(funcStr)
  if (splitMatch) {
    if (typeof value !== 'string') return [String(value ?? '')]
    return value.split(splitMatch[1])
  }

  // replace('old','new')
  const replaceMatch = /^replace\(['"]([^'"]*)['"],\s*['"]([^'"]*)['"]\)$/.exec(funcStr)
  if (replaceMatch) {
    if (typeof value !== 'string') return value
    return value.replace(new RegExp(replaceMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replaceMatch[2])
  }

  // startsWith('prefix') / endsWith('suffix') / contains('str')
  const startsWithMatch = /^startsWith\(['"]([^'"]*)['"]\)$/.exec(funcStr)
  if (startsWithMatch) {
    return typeof value === 'string' && value.startsWith(startsWithMatch[1])
  }
  const endsWithMatch = /^endsWith\(['"]([^'"]*)['"]\)$/.exec(funcStr)
  if (endsWithMatch) {
    return typeof value === 'string' && value.endsWith(endsWithMatch[1])
  }
  const containsMatch = /^contains\(['"]([^'"]*)['"]\)$/.exec(funcStr)
  if (containsMatch) {
    return typeof value === 'string' && value.includes(containsMatch[1])
  }

  // matches('regex')
  const matchesMatch = /^matches\(['"]([^'"]*)['"]\)$/.exec(funcStr)
  if (matchesMatch) {
    if (typeof value !== 'string') return false
    try { return new RegExp(matchesMatch[1]).test(value) } catch { return false }
  }

  // default('fallback')
  const defaultMatch = /^default\(['"]([^'"]*)['"]\)$/.exec(funcStr)
  if (defaultMatch) {
    return (value === null || value === undefined) ? defaultMatch[1] : value
  }

  // String comparison operators: == 'value', != 'value'
  const strCmpMatch = /^([!=]=)\s*['"]([^'"]*)['"]\s*$/.exec(funcStr)
  if (strCmpMatch) {
    const strVal = String(value ?? '')
    switch (strCmpMatch[1]) {
      case '==': return strVal === strCmpMatch[2]
      case '!=': return strVal !== strCmpMatch[2]
      default: return false
    }
  }

  // Numeric comparison operators: > N, == N, etc.
  const cmpMatch = /^([><=!]+)\s*(-?\d+(?:\.\d+)?)$/.exec(funcStr)
  if (cmpMatch) {
    const num = typeof value === 'number' ? value : Number(value)
    const cmpTarget = parseFloat(cmpMatch[2])
    if (isNaN(num)) return false
    switch (cmpMatch[1]) {
      case '>':
        return num > cmpTarget
      case '>=':
        return num >= cmpTarget
      case '<':
        return num < cmpTarget
      case '<=':
        return num <= cmpTarget
      case '==':
        return num === cmpTarget
      case '!=':
        return num !== cmpTarget
      default:
        return false
    }
  }

  return value
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

export function evaluateCondition(
  condition: string,
  target: EntityRecord | null,
  stepResults: Map<string, StepResultData>,
  stepExtracted: Map<string, Record<string, unknown>>,
  variables?: Map<string, unknown>
): boolean {
  try {
    const result = evaluateCompoundCondition(condition, target, stepResults, stepExtracted, variables)
    return result
  } catch {
    return false
  }
}

/**
 * Evaluate compound conditions with && and || operators, ! negation,
 * and parentheses for grouping.
 */
function evaluateCompoundCondition(
  condition: string,
  target: EntityRecord | null,
  stepResults: Map<string, StepResultData>,
  stepExtracted: Map<string, Record<string, unknown>>,
  variables?: Map<string, unknown>
): boolean {
  const trimmed = condition.trim()

  // Handle negation
  if (trimmed.startsWith('!')) {
    return !evaluateCompoundCondition(trimmed.slice(1), target, stepResults, stepExtracted, variables)
  }

  // Handle parenthesized groups — find top-level || first (lowest precedence)
  const orParts = splitAtTopLevel(trimmed, '||')
  if (orParts.length > 1) {
    return orParts.some((part) => evaluateCompoundCondition(part, target, stepResults, stepExtracted, variables))
  }

  // Then handle top-level &&
  const andParts = splitAtTopLevel(trimmed, '&&')
  if (andParts.length > 1) {
    return andParts.every((part) => evaluateCompoundCondition(part, target, stepResults, stepExtracted, variables))
  }

  // Strip outer parens if the entire string is wrapped
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(1, -1)
    // Verify these are matching parens (not nested groups)
    let depth = 0
    let isWrapped = true
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '(') depth++
      if (inner[i] === ')') depth--
      if (depth < 0) { isWrapped = false; break }
    }
    if (isWrapped && depth === 0) {
      return evaluateCompoundCondition(inner, target, stepResults, stepExtracted, variables)
    }
  }

  // Base case: single expression
  const result = evaluateExpression(trimmed, target, stepResults, stepExtracted, undefined, variables)
  if (Array.isArray(result)) return result.length > 0
  return Boolean(result)
}

/**
 * Split a condition string at a top-level operator (&&, ||),
 * respecting parentheses grouping.
 */
function splitAtTopLevel(expr: string, operator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''

  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '(') depth++
    else if (expr[i] === ')') depth--

    if (depth === 0 && expr.substring(i, i + operator.length) === operator) {
      parts.push(current.trim())
      current = ''
      i += operator.length - 1
    } else {
      current += expr[i]
    }
  }
  parts.push(current.trim())

  return parts.filter((p) => p.length > 0)
}

// ---------------------------------------------------------------------------
// Extract variables from step results
// ---------------------------------------------------------------------------

export function extractVariables(
  extractConfig: Record<string, string>,
  parsedResults: ParsedResults | null,
  stepId: string
): Record<string, unknown> {
  const extracted: Record<string, unknown> = {}
  if (!parsedResults) return extracted

  for (const [varName, path] of Object.entries(extractConfig)) {
    try {
      extracted[varName] = getNestedValue(parsedResults, path)
    } catch {
      console.warn(`Failed to extract "${varName}" from step "${stepId}" results`)
    }
  }

  return extracted
}

// ---------------------------------------------------------------------------
// Output capture
// ---------------------------------------------------------------------------

export function captureOutputValue(
  output: string,
  mode: 'full' | 'last_line' | 'regex' | 'json',
  pattern?: string
): unknown {
  switch (mode) {
    case 'full':
      return output
    case 'last_line': {
      const lines = output.split('\n').filter((l) => l.trim().length > 0)
      return lines.length > 0 ? lines[lines.length - 1].trim() : ''
    }
    case 'regex': {
      if (!pattern) return output
      try {
        const match = new RegExp(pattern).exec(output)
        return match ? (match[1] ?? match[0]) : ''
      } catch {
        return ''
      }
    }
    case 'json': {
      try {
        const parsed = JSON.parse(output)
        if (pattern) return getNestedValue(parsed, pattern)
        return parsed
      } catch {
        return output
      }
    }
    default:
      return output
  }
}
