// Lightweight runtime validation helpers
// No external dependency — just structural checks for parsed YAML

export interface ValidationError {
  path: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

function err(path: string, message: string): ValidationError {
  return { path, message }
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number'
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean'
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v)
}

/** Check a required string field exists and is non-empty */
export function requireString(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  errors: ValidationError[]
): void {
  if (!isString(obj[field]) || obj[field] === '') {
    errors.push(err(`${path}.${field}`, `Required string field "${field}" is missing or empty`))
  }
}

/** Check an optional field is a string if present */
export function optionalString(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  errors: ValidationError[]
): void {
  if (field in obj && obj[field] !== undefined && !isString(obj[field])) {
    errors.push(err(`${path}.${field}`, `Field "${field}" must be a string`))
  }
}

/** Check a required array field exists */
export function requireArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  errors: ValidationError[]
): void {
  if (!isArray(obj[field])) {
    errors.push(err(`${path}.${field}`, `Required array field "${field}" is missing or not an array`))
  }
}

/** Check a required object field exists */
export function requireObject(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  errors: ValidationError[]
): void {
  if (!isObject(obj[field])) {
    errors.push(
      err(`${path}.${field}`, `Required object field "${field}" is missing or not an object`)
    )
  }
}

/** Check a field is one of a set of allowed values */
export function requireEnum(
  obj: Record<string, unknown>,
  field: string,
  allowed: string[],
  path: string,
  errors: ValidationError[]
): void {
  if (!isString(obj[field]) || !allowed.includes(obj[field] as string)) {
    errors.push(
      err(`${path}.${field}`, `Field "${field}" must be one of: ${allowed.join(', ')}`)
    )
  }
}

/** Check an optional field matches one of allowed values if present */
export function optionalEnum(
  obj: Record<string, unknown>,
  field: string,
  allowed: string[],
  path: string,
  errors: ValidationError[]
): void {
  if (field in obj && obj[field] !== undefined) {
    if (!isString(obj[field]) || !allowed.includes(obj[field] as string)) {
      errors.push(
        err(`${path}.${field}`, `Field "${field}" must be one of: ${allowed.join(', ')}`)
      )
    }
  }
}

export function optionalBoolean(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  errors: ValidationError[]
): void {
  if (field in obj && obj[field] !== undefined && !isBoolean(obj[field])) {
    errors.push(err(`${path}.${field}`, `Field "${field}" must be a boolean`))
  }
}

export function optionalNumber(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  errors: ValidationError[]
): void {
  if (field in obj && obj[field] !== undefined && !isNumber(obj[field])) {
    errors.push(err(`${path}.${field}`, `Field "${field}" must be a number`))
  }
}

export function makeResult(errors: ValidationError[]): ValidationResult {
  return { valid: errors.length === 0, errors }
}
