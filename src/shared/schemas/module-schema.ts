// Module YAML validation

import {
  type ValidationResult,
  type ValidationError,
  requireString,
  optionalString,
  requireArray,
  requireObject,
  requireEnum,
  optionalEnum,
  optionalBoolean,
  optionalNumber,
  makeResult
} from './validate'

const EXECUTION_MODES = ['spawn', 'reference', 'interactive']
const OUTPUT_TYPES = ['raw', 'xml', 'json', 'jsonl', 'csv', 'regex', 'lines', 'greppable', 'custom']
const ARGUMENT_TYPES = [
  'text',
  'number',
  'select',
  'multiselect',
  'toggle',
  'target',
  'file',
  'directory',
  'password',
  'wordlist',
  'hidden',
  'textarea',
  'port',
  'ip',
  'range',
  'positional',
  'flag'
]
const FLAG_SEPARATORS = ['space', 'equals', 'none']
// Entity types are profile-defined — validation only checks that the field is a string.
// The actual type names come from profile/schema.yaml and are validated at schema load time.

function validateArgument(
  arg: unknown,
  path: string,
  errors: ValidationError[]
): void {
  if (typeof arg !== 'object' || arg === null) {
    errors.push({ path, message: 'Argument must be an object' })
    return
  }
  const a = arg as Record<string, unknown>

  requireString(a, 'id', path, errors)
  requireString(a, 'name', path, errors)
  requireString(a, 'help', path, errors)
  requireEnum(a, 'type', ARGUMENT_TYPES, path, errors)

  optionalString(a, 'flag', path, errors)
  optionalEnum(a, 'flag_separator', FLAG_SEPARATORS, path, errors)
  optionalBoolean(a, 'required', path, errors)
  optionalString(a, 'placeholder', path, errors)
  optionalBoolean(a, 'raw', path, errors)
  optionalString(a, 'separator', path, errors)
  optionalBoolean(a, 'requires_root', path, errors)
  optionalString(a, 'group', path, errors)

  // Validate options for select/multiselect
  if (Array.isArray(a.options)) {
    for (let i = 0; i < a.options.length; i++) {
      const opt = a.options[i]
      const optPath = `${path}.options[${i}]`
      if (typeof opt !== 'object' || opt === null) {
        errors.push({ path: optPath, message: 'Option must be an object' })
        continue
      }
      const o = opt as Record<string, unknown>
      // Option value may be an empty string (means "no flag / default / skip").
      // The command builder already treats '' as a no-op, so we only need to
      // verify the field exists and is a string — not that it is non-empty.
      if (typeof o.value !== 'string') {
        errors.push({ path: `${optPath}.value`, message: 'Required string field "value" is missing or not a string' })
      }
      requireString(o, 'label', optPath, errors)
      optionalString(o, 'help', optPath, errors)
    }
  }

  // Validate depends_on
  if (a.depends_on !== undefined) {
    if (typeof a.depends_on !== 'object' || a.depends_on === null) {
      errors.push({ path: `${path}.depends_on`, message: 'depends_on must be an object' })
    } else {
      const dep = a.depends_on as Record<string, unknown>
      requireString(dep, 'field', `${path}.depends_on`, errors)
    }
  }

  // Validate validation object
  if (a.validation !== undefined) {
    if (typeof a.validation !== 'object' || a.validation === null) {
      errors.push({ path: `${path}.validation`, message: 'validation must be an object' })
    } else {
      const v = a.validation as Record<string, unknown>
      optionalString(v, 'pattern', `${path}.validation`, errors)
      optionalString(v, 'message', `${path}.validation`, errors)
      optionalNumber(v, 'min', `${path}.validation`, errors)
      optionalNumber(v, 'max', `${path}.validation`, errors)
      optionalNumber(v, 'min_length', `${path}.validation`, errors)
      optionalNumber(v, 'max_length', `${path}.validation`, errors)
    }
  }
}

function validateOutput(
  output: unknown,
  path: string,
  errors: ValidationError[]
): void {
  if (typeof output !== 'object' || output === null) {
    errors.push({ path, message: 'Output must be an object' })
    return
  }
  const o = output as Record<string, unknown>

  optionalEnum(o, 'type', OUTPUT_TYPES, path, errors)
  optionalString(o, 'parser', path, errors)
  optionalString(o, 'encoding', path, errors)
  optionalString(o, 'file_output', path, errors)

  // Validate entities
  if (Array.isArray(o.entities)) {
    for (let i = 0; i < o.entities.length; i++) {
      const entity = o.entities[i]
      const ePath = `${path}.entities[${i}]`
      if (typeof entity !== 'object' || entity === null) {
        errors.push({ path: ePath, message: 'Entity extraction must be an object' })
        continue
      }
      const e = entity as Record<string, unknown>
      requireString(e, 'type', ePath, errors)
      requireString(e, 'extract', ePath, errors)
    }
  }

  // Validate patterns (for regex output type)
  if (Array.isArray(o.patterns)) {
    for (let i = 0; i < o.patterns.length; i++) {
      const pat = o.patterns[i]
      const pPath = `${path}.patterns[${i}]`
      if (typeof pat !== 'object' || pat === null) {
        errors.push({ path: pPath, message: 'Pattern must be an object' })
        continue
      }
      const p = pat as Record<string, unknown>
      requireString(p, 'name', pPath, errors)
      requireString(p, 'pattern', pPath, errors)
      optionalString(p, 'entity_type', pPath, errors)
      // fields can be an array of names or an object mapping
      if (p.fields !== undefined && !Array.isArray(p.fields) && (typeof p.fields !== 'object' || p.fields === null)) {
        errors.push({ path: `${pPath}.fields`, message: 'fields must be an array or object' })
      }
      optionalString(p, 'flags', pPath, errors)
    }
  }
}

export function validateModule(data: unknown): ValidationResult {
  const errors: ValidationError[] = []
  const root = 'module'

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push({ path: root, message: 'Module must be an object' })
    return makeResult(errors)
  }

  const obj = data as Record<string, unknown>

  // Required fields
  requireString(obj, 'id', root, errors)
  requireString(obj, 'name', root, errors)
  requireString(obj, 'description', root, errors)
  requireString(obj, 'category', root, errors)
  requireString(obj, 'binary', root, errors)

  // Optional metadata
  optionalString(obj, 'version', root, errors)
  optionalString(obj, 'icon', root, errors)
  optionalString(obj, 'install_check', root, errors)
  optionalString(obj, 'install_command', root, errors)
  optionalString(obj, 'documentation_url', root, errors)
  optionalString(obj, 'author', root, errors)
  optionalString(obj, 'license', root, errors)

  // Execution
  optionalEnum(obj, 'execution_mode', EXECUTION_MODES, root, errors)
  optionalBoolean(obj, 'interactive', root, errors)
  optionalBoolean(obj, 'requires_root', root, errors)
  optionalBoolean(obj, 'root_optional', root, errors)
  optionalNumber(obj, 'timeout', root, errors)
  optionalString(obj, 'working_directory', root, errors)
  optionalBoolean(obj, 'shell', root, errors)
  optionalString(obj, 'pre_command', root, errors)
  optionalString(obj, 'post_command', root, errors)
  optionalString(obj, 'run_command', root, errors)

  // Tags
  if ('tags' in obj && obj.tags !== undefined) {
    if (!Array.isArray(obj.tags)) {
      errors.push({ path: `${root}.tags`, message: 'tags must be an array' })
    }
  }

  // Transfer commands
  if (Array.isArray(obj.transfer_commands)) {
    for (let i = 0; i < obj.transfer_commands.length; i++) {
      const tc = obj.transfer_commands[i]
      const tcPath = `${root}.transfer_commands[${i}]`
      if (typeof tc !== 'object' || tc === null) {
        errors.push({ path: tcPath, message: 'Transfer command must be an object' })
        continue
      }
      const t = tc as Record<string, unknown>
      requireString(t, 'label', tcPath, errors)
      requireString(t, 'command', tcPath, errors)
    }
  }

  // Arguments
  requireArray(obj, 'arguments', root, errors)
  if (Array.isArray(obj.arguments)) {
    for (let i = 0; i < obj.arguments.length; i++) {
      validateArgument(obj.arguments[i], `${root}.arguments[${i}]`, errors)
    }
  }

  // Output
  requireObject(obj, 'output', root, errors)
  if (typeof obj.output === 'object' && obj.output !== null && !Array.isArray(obj.output)) {
    validateOutput(obj.output, `${root}.output`, errors)
  }

  // Suggestions
  if (Array.isArray(obj.suggestions)) {
    for (let i = 0; i < obj.suggestions.length; i++) {
      const sug = obj.suggestions[i]
      const sPath = `${root}.suggestions[${i}]`
      if (typeof sug !== 'object' || sug === null) {
        errors.push({ path: sPath, message: 'Suggestion must be an object' })
        continue
      }
      const s = sug as Record<string, unknown>
      requireString(s, 'condition', sPath, errors)
      optionalString(s, 'suggest', sPath, errors)
      optionalString(s, 'suggest_tool', sPath, errors)
      optionalString(s, 'message', sPath, errors)
      optionalString(s, 'text', sPath, errors)
      optionalNumber(s, 'priority', sPath, errors)
    }
  }

  return makeResult(errors)
}
