// Workflow YAML validation

import {
  type ValidationResult,
  type ValidationError,
  requireString,
  optionalString,
  optionalNumber,
  optionalBoolean,
  requireArray,
  optionalEnum,
  makeResult
} from './validate'

const FAILURE_ACTIONS = ['skip', 'abort', 'retry']

function validateStep(
  step: unknown,
  path: string,
  errors: ValidationError[]
): void {
  if (typeof step !== 'object' || step === null) {
    errors.push({ path, message: 'Step must be an object' })
    return
  }
  const s = step as Record<string, unknown>

  requireString(s, 'id', path, errors)
  requireString(s, 'name', path, errors)
  requireString(s, 'tool', path, errors)
  optionalString(s, 'description', path, errors)
  optionalString(s, 'condition', path, errors)
  optionalBoolean(s, 'optional', path, errors)
  optionalBoolean(s, 'parallel', path, errors)
  optionalString(s, 'for_each', path, errors)
  optionalNumber(s, 'timeout', path, errors)
  optionalEnum(s, 'on_failure', FAILURE_ACTIONS, path, errors)

  // depends_on can be string or string[]
  if ('depends_on' in s && s.depends_on !== undefined) {
    const dep = s.depends_on
    if (typeof dep !== 'string' && !Array.isArray(dep)) {
      errors.push({
        path: `${path}.depends_on`,
        message: 'depends_on must be a string or array of strings'
      })
    }
  }

  // args must be an object if present
  if ('args' in s && s.args !== undefined) {
    if (typeof s.args !== 'object' || s.args === null || Array.isArray(s.args)) {
      errors.push({ path: `${path}.args`, message: 'args must be an object' })
    }
  }

  // extract must be an object if present
  if ('extract' in s && s.extract !== undefined) {
    if (typeof s.extract !== 'object' || s.extract === null || Array.isArray(s.extract)) {
      errors.push({ path: `${path}.extract`, message: 'extract must be an object' })
    }
  }
}

export function validateWorkflow(data: unknown): ValidationResult {
  const errors: ValidationError[] = []
  const root = 'workflow'

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push({ path: root, message: 'Workflow must be an object' })
    return makeResult(errors)
  }

  const obj = data as Record<string, unknown>

  // Required fields
  requireString(obj, 'id', root, errors)
  requireString(obj, 'name', root, errors)
  requireString(obj, 'description', root, errors)

  // Optional metadata
  optionalString(obj, 'category', root, errors)
  optionalString(obj, 'icon', root, errors)
  optionalString(obj, 'estimated_duration', root, errors)
  optionalBoolean(obj, 'requires_root', root, errors)

  // Steps
  requireArray(obj, 'steps', root, errors)
  if (Array.isArray(obj.steps)) {
    if (obj.steps.length === 0) {
      errors.push({ path: `${root}.steps`, message: 'Workflow must have at least one step' })
    }
    for (let i = 0; i < obj.steps.length; i++) {
      validateStep(obj.steps[i], `${root}.steps[${i}]`, errors)
    }
  }

  return makeResult(errors)
}
