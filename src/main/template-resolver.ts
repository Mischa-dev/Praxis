/**
 * Template resolver — shared template expression resolution used by both
 * the workflow engine and the pipeline engine.
 *
 * Resolves ${...} template expressions against target data, step/node results,
 * and extracted variables. Supports pipe functions for data transformation.
 *
 * Domain-agnostic: no tool names or pentest concepts.
 */

import type { Target } from '@shared/types/target'
import type { ParsedResults } from '@shared/types/results'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StepResultData {
  scanId: number
  status: 'completed' | 'failed' | 'cancelled'
  parsedResults: ParsedResults | null
}

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

/**
 * Resolve template expressions like ${target.value}, ${steps.port_scan.open_ports},
 * ${nodes.port_scan.results.services}, and pipe functions like | join(',').
 *
 * Accepts both `steps.*` and `nodes.*` prefixes for referencing prior results.
 */
export function resolveTemplate(
  template: string,
  target: Target,
  stepResults: Map<string, StepResultData>,
  stepExtracted: Map<string, Record<string, unknown>>,
  item?: unknown
): unknown {
  // Match ${...} expressions
  const singleExpr = /^\$\{(.+)\}$/.exec(template.trim())

  // If the entire value is a single expression, return the raw value (could be array/object)
  if (singleExpr) {
    return evaluateExpression(singleExpr[1].trim(), target, stepResults, stepExtracted, item)
  }

  // Otherwise, interpolate multiple expressions within the string
  return template.replace(/\$\{([^}]+)\}/g, (_, expr: string) => {
    const val = evaluateExpression(expr.trim(), target, stepResults, stepExtracted, item)
    if (Array.isArray(val)) return val.join(',')
    if (val === null || val === undefined) return ''
    return String(val)
  })
}

export function evaluateExpression(
  expr: string,
  target: Target,
  stepResults: Map<string, StepResultData>,
  stepExtracted: Map<string, Record<string, unknown>>,
  item?: unknown
): unknown {
  // Split by pipe for pipe functions: "steps.x.open_ports | join(',')"
  const pipeParts = expr.split('|').map((s) => s.trim())
  const basePath = pipeParts[0]

  let value = resolveBasePath(basePath, target, stepResults, stepExtracted, item)

  // Apply pipe functions
  for (let i = 1; i < pipeParts.length; i++) {
    value = applyPipeFunction(pipeParts[i], value)
  }

  return value
}

export function resolveBasePath(
  path: string,
  target: Target,
  stepResults: Map<string, StepResultData>,
  stepExtracted: Map<string, Record<string, unknown>>,
  item?: unknown
): unknown {
  // item reference (for for_each iterations)
  if (path === 'item') return item
  if (path.startsWith('item.')) {
    return getNestedValue(item, path.slice(5))
  }

  // target.* references
  if (path.startsWith('target.')) {
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
    if (!stepData?.parsedResults) return undefined

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

  // has_service('name')
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

  // Comparison operators for conditions: "> N", "== N", etc.
  const cmpMatch = /^([><=!]+)\s*(\d+)$/.exec(funcStr)
  if (cmpMatch) {
    const num = typeof value === 'number' ? value : 0
    const target = parseInt(cmpMatch[2], 10)
    switch (cmpMatch[1]) {
      case '>':
        return num > target
      case '>=':
        return num >= target
      case '<':
        return num < target
      case '<=':
        return num <= target
      case '==':
        return num === target
      case '!=':
        return num !== target
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
  target: Target,
  stepResults: Map<string, StepResultData>,
  stepExtracted: Map<string, Record<string, unknown>>
): boolean {
  try {
    const result = evaluateExpression(condition, target, stepResults, stepExtracted)
    // Truthy check: non-empty arrays, truthy booleans/numbers/strings
    if (Array.isArray(result)) return result.length > 0
    return Boolean(result)
  } catch {
    return false
  }
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
