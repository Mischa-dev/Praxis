/**
 * Action engine — loads action rule YAML files from profile/actions/,
 * evaluates conditions against entity state, resolves template variables,
 * and returns matching EvaluatedAction[].
 *
 * This engine is fully generic: it evaluates YAML conditions against
 * EntityRecord objects and never hardcodes any domain-specific logic.
 * All domain knowledge lives in the profile action YAML files.
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
import type { EntityRecord } from '@shared/types/entity'

// ---------------------------------------------------------------------------
// Types for the entity context used during condition evaluation
// ---------------------------------------------------------------------------

/** All the data needed to evaluate action rules for an entity */
export interface EntityContext {
  primaryEntity: EntityRecord
  /** The entity type name of the primary entity (e.g., 'host', 'target') */
  primaryType: string
  /** Child entities keyed by entity type (e.g., { service: [...], vulnerability: [...] }) */
  children: Record<string, EntityRecord[]>
  /** Scans associated with this entity (from the engine scans table) */
  scans: Array<{ id: number; tool_id: string; status: string }>
}

/** Template variable context built from matched entities */
interface TemplateContext {
  /** All entity records available for template resolution, keyed by type name */
  entities: Record<string, EntityRecord | undefined>
  /** The primary entity, also accessible by its type name */
  primary: EntityRecord
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
 * Get the entity array for a given entity type from the context.
 * If the type matches the primary entity, returns a single-element array.
 * Otherwise returns the children array for that type.
 */
function getEntityArray(ctx: EntityContext, entityType: string): EntityRecord[] {
  if (entityType === ctx.primaryType || entityType === 'primary') {
    return [ctx.primaryEntity]
  }
  return ctx.children[entityType] ?? []
}

/** Check if an entity matches a set of field filters */
function matchesFilters(entity: EntityRecord, filters: Record<string, unknown>): boolean {
  for (const [key, val] of Object.entries(filters)) {
    const entityVal = entity[key]
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

/**
 * Evaluate a single condition against the entity context.
 * Returns whether the condition matched, and any matched entity for template resolution.
 */
function evaluateCondition(
  condition: ActionCondition,
  ctx: EntityContext
): { match: boolean; matchedType?: string; matchedEntity?: EntityRecord } {
  switch (condition.type) {
    case 'entity_exists': {
      const entities = getEntityArray(ctx, condition.entity)
      if (condition.match) {
        const matched = entities.find((e) => matchesFilters(e, condition.match!))
        return { match: !!matched, matchedType: condition.entity, matchedEntity: matched }
      }
      return {
        match: entities.length > 0,
        matchedType: condition.entity,
        matchedEntity: entities[0]
      }
    }

    case 'entity_count': {
      const entities = getEntityArray(ctx, condition.entity)
      const filtered = condition.match
        ? entities.filter((e) => matchesFilters(e, condition.match!))
        : entities
      const result = compareOp(filtered.length, condition.op, condition.value)
      return { match: result }
    }

    case 'field_matches': {
      const entities = getEntityArray(ctx, condition.entity)
      try {
        const regex = new RegExp(condition.pattern, 'i')
        const matched = entities.find((e) => {
          const val = e[condition.field]
          return val !== null && val !== undefined && regex.test(String(val))
        })
        return { match: !!matched, matchedType: condition.entity, matchedEntity: matched }
      } catch {
        return { match: false }
      }
    }

    case 'entity_field_range': {
      const entities = getEntityArray(ctx, condition.entity)
      const matched = entities.find((e) => {
        const val = Number(e[condition.field])
        if (isNaN(val)) return false
        if (condition.min !== undefined && val < condition.min) return false
        if (condition.max !== undefined && val > condition.max) return false
        return true
      })
      return { match: !!matched, matchedType: condition.entity, matchedEntity: matched }
    }

    default:
      return { match: false }
  }
}

// ---------------------------------------------------------------------------
// Template variable resolution
// ---------------------------------------------------------------------------

/**
 * Resolve template variables in a string using `${...}` syntax.
 * Supports: ${entityType.fieldName} where entityType is the entity type name
 * (e.g., ${host.value}, ${service.port}, ${primary.value}).
 * The primary entity is accessible both by its type name and as "primary".
 */
function resolveTemplate(template: string, tplCtx: TemplateContext): string {
  return template.replace(/\$\{([^}]+)\}/g, (fullMatch, expr: string) => {
    const parts = expr.trim().split('.')
    if (parts.length !== 2) return fullMatch

    const [ns, field] = parts
    let source: EntityRecord | undefined

    if (ns === 'primary') {
      source = tplCtx.primary
    } else {
      source = tplCtx.entities[ns]
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
 * Evaluate all loaded action rules against an entity's current state.
 * Returns a list of EvaluatedAction objects sorted by priority (lower first).
 */
export function evaluateActions(
  rules: ActionRule[],
  ctx: EntityContext
): EvaluatedAction[] {
  const results: EvaluatedAction[] = []

  for (const rule of rules) {
    // All conditions must match (AND logic)
    let allMatch = true
    // Collect matched entities by type for template resolution
    const matchedEntities: Record<string, EntityRecord> = {}

    for (const condition of rule.conditions) {
      const evalResult = evaluateCondition(condition, ctx)
      if (!evalResult.match) {
        allMatch = false
        break
      }
      // Capture matched entities for template resolution
      if (evalResult.matchedType && evalResult.matchedEntity) {
        matchedEntities[evalResult.matchedType] = evalResult.matchedEntity
      }
    }

    if (!allMatch) continue

    // Build template context from matched entities
    // The primary entity is available both as its type name and as "primary"
    const entityMap: Record<string, EntityRecord | undefined> = {
      ...matchedEntities,
      [ctx.primaryType]: ctx.primaryEntity,
      primary: ctx.primaryEntity
    }

    const tplCtx: TemplateContext = {
      entities: entityMap,
      primary: ctx.primaryEntity
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
 * Build an EntityContext from a primary entity record and its children.
 */
export function buildEntityContext(
  primaryType: string,
  primaryEntity: EntityRecord,
  children: Record<string, EntityRecord[]>,
  scans?: Array<{ id: number; tool_id: string; status: string }>
): EntityContext {
  return {
    primaryEntity,
    primaryType,
    children,
    scans: scans ?? []
  }
}

/**
 * High-level convenience: given an entity and its children, load rules and evaluate.
 */
export function getActionsForEntity(
  actionsDir: string,
  primaryType: string,
  primaryEntity: EntityRecord,
  children: Record<string, EntityRecord[]>,
  scans?: Array<{ id: number; tool_id: string; status: string }>
): EvaluatedAction[] {
  const rules = loadActionRules(actionsDir)
  const ctx = buildEntityContext(primaryType, primaryEntity, children, scans)
  return evaluateActions(rules, ctx)
}
