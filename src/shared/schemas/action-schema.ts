// Action rule YAML validation

import {
  type ValidationResult,
  type ValidationError,
  requireString,
  optionalString,
  optionalNumber,
  optionalBoolean,
  requireArray,
  requireEnum,
  makeResult
} from './validate'

const RISK_LEVELS = ['passive', 'active', 'intrusive']
const CONDITION_TYPES = [
  'entity_exists',
  'entity_count',
  'field_matches',
  'entity_field_range'
]

function validateCondition(
  cond: unknown,
  path: string,
  errors: ValidationError[]
): void {
  if (typeof cond !== 'object' || cond === null) {
    errors.push({ path, message: 'Condition must be an object' })
    return
  }
  const c = cond as Record<string, unknown>

  requireEnum(c, 'type', CONDITION_TYPES, path, errors)

  const type = c.type as string
  switch (type) {
    case 'entity_exists':
      requireString(c, 'entity', path, errors)
      break
    case 'entity_count':
      requireString(c, 'entity', path, errors)
      if (typeof c.op !== 'string') {
        errors.push({ path: `${path}.op`, message: 'entity_count requires op (==, !=, >, <, >=, <=)' })
      }
      if (typeof c.value !== 'number') {
        errors.push({ path: `${path}.value`, message: 'entity_count requires numeric value' })
      }
      break
    case 'field_matches':
      requireString(c, 'entity', path, errors)
      requireString(c, 'field', path, errors)
      requireString(c, 'pattern', path, errors)
      break
    case 'entity_field_range':
      requireString(c, 'entity', path, errors)
      requireString(c, 'field', path, errors)
      break
  }
}

function validateAction(
  action: unknown,
  path: string,
  errors: ValidationError[]
): void {
  if (typeof action !== 'object' || action === null) {
    errors.push({ path, message: 'Action must be an object' })
    return
  }
  const a = action as Record<string, unknown>

  requireString(a, 'id', path, errors)
  requireString(a, 'title', path, errors)
  requireString(a, 'tool', path, errors)
  requireString(a, 'explanation', path, errors)
  requireEnum(a, 'risk_level', RISK_LEVELS, path, errors)
  optionalString(a, 'description', path, errors)
  optionalBoolean(a, 'one_click', path, errors)
}

export function validateActionRule(data: unknown): ValidationResult {
  const errors: ValidationError[] = []
  const root = 'action_rule'

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push({ path: root, message: 'Action rule must be an object' })
    return makeResult(errors)
  }

  const obj = data as Record<string, unknown>

  requireString(obj, 'id', root, errors)
  requireString(obj, 'name', root, errors)
  requireString(obj, 'description', root, errors)
  optionalNumber(obj, 'priority', root, errors)
  optionalString(obj, 'category', root, errors)

  // Conditions
  requireArray(obj, 'conditions', root, errors)
  if (Array.isArray(obj.conditions)) {
    for (let i = 0; i < obj.conditions.length; i++) {
      validateCondition(obj.conditions[i], `${root}.conditions[${i}]`, errors)
    }
  }

  // Actions
  requireArray(obj, 'actions', root, errors)
  if (Array.isArray(obj.actions)) {
    for (let i = 0; i < obj.actions.length; i++) {
      validateAction(obj.actions[i], `${root}.actions[${i}]`, errors)
    }
  }

  return makeResult(errors)
}

/** Validate a multi-rule action file (rules: [...]) */
export function validateActionRuleFile(data: unknown): ValidationResult {
  const errors: ValidationError[] = []

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push({ path: 'file', message: 'Action rule file must be an object' })
    return makeResult(errors)
  }

  const obj = data as Record<string, unknown>
  requireArray(obj, 'rules', 'file', errors)

  if (Array.isArray(obj.rules)) {
    for (let i = 0; i < obj.rules.length; i++) {
      const result = validateActionRule(obj.rules[i])
      for (const e of result.errors) {
        errors.push({ path: `file.rules[${i}].${e.path}`, message: e.message })
      }
    }
  }

  return makeResult(errors)
}
