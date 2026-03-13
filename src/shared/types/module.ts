// Module types — loaded from profile module YAML files

export type ExecutionMode = 'spawn' | 'reference' | 'interactive'

export type ArgumentType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'toggle'
  | 'target'
  | 'file'
  | 'directory'
  | 'password'
  | 'wordlist'
  | 'hidden'
  | 'textarea'
  | 'port'
  | 'ip'
  | 'range'
  | 'positional'
  | 'flag'

export type FlagSeparator = 'space' | 'equals' | 'none'

export type OutputType = 'raw' | 'xml' | 'json' | 'jsonl' | 'csv' | 'regex' | 'lines' | 'greppable' | 'custom'

/** Entity type is a string matching an entity defined in profile/schema.yaml */
export type EntityType = string

export interface ModuleArgumentOption {
  value: string
  label: string
  help?: string
}

export interface ModuleArgumentDependency {
  field: string
  value?: unknown
  values?: unknown[]
  not_value?: unknown
}

export interface ModuleArgumentValidation {
  pattern?: string
  message?: string
  min?: number
  max?: number
  min_length?: number
  max_length?: number
}

export interface ModuleArgumentFileFilter {
  extensions: string[]
  description?: string
}

export interface ModuleArgument {
  id: string
  name: string
  type: ArgumentType
  flag?: string
  flag_separator?: FlagSeparator
  required?: boolean
  default?: unknown
  placeholder?: string
  help: string
  position?: string | number
  raw?: boolean
  separator?: string
  value?: unknown
  requires_root?: boolean
  requires_root_for?: unknown[]
  depends_on?: ModuleArgumentDependency
  validation?: ModuleArgumentValidation
  options?: ModuleArgumentOption[]
  file_filter?: ModuleArgumentFileFilter
  group?: string
}

export interface OutputEntityExtraction {
  type: EntityType
  extract: string
  fields: Record<string, string>
}

export interface OutputPattern {
  name: string
  pattern: string
  entity_type: string
  fields: Record<string, string>
  flags?: string
}

export interface ModuleOutput {
  type: OutputType
  parser?: string
  encoding?: string
  file_output?: string
  entities?: OutputEntityExtraction[]
  patterns?: OutputPattern[]
}

export interface ModuleSuggestion {
  condition: string
  suggest: string
  message: string
  auto_args?: Record<string, string>
  priority?: number
}

export interface ModuleTransferCommand {
  label: string
  command: string
}

/** Raw module definition as parsed from YAML */
export interface ModuleDefinition {
  id: string
  name: string
  description: string
  category: string
  binary: string
  version?: string
  icon?: string
  install_check?: string
  install_command?: string
  documentation_url?: string
  author?: string
  license?: string
  tags?: string[]
  execution_mode?: ExecutionMode
  interactive?: boolean
  requires_root?: boolean
  root_optional?: boolean
  timeout?: number
  working_directory?: string
  environment?: Record<string, string>
  shell?: boolean
  pre_command?: string
  post_command?: string
  transfer_commands?: ModuleTransferCommand[]
  run_command?: string
  arguments: ModuleArgument[]
  output: ModuleOutput
  suggestions?: ModuleSuggestion[]
}

/** Resolved module with runtime state (installed check, etc.) */
export interface Module {
  id: string
  name: string
  description: string
  category: string
  binary: string
  icon?: string
  tags?: string[]
  requiresRoot: boolean
  installed: boolean
  installedVersion?: string
  installCommand?: string
  arguments: ModuleArgument[]
  output: ModuleOutput
  suggestions: ModuleSuggestion[]
  executionMode: ExecutionMode
  interactive: boolean
  rootOptional: boolean
  timeout?: number
  workingDirectory?: string
  environment?: Record<string, string>
  shell: boolean
  preCommand?: string
  postCommand?: string
  transferCommands?: ModuleTransferCommand[]
  runCommand?: string
  documentationUrl?: string
}
