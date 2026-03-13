// Pipeline and workflow types

export type StepFailureAction = 'skip' | 'abort' | 'retry'

export type WorkflowStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export type WorkflowRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

/** Step definition as parsed from workflow YAML */
export interface WorkflowStepDefinition {
  id: string
  name: string
  description?: string
  tool: string // Module ID
  args?: Record<string, unknown>
  depends_on?: string | string[]
  condition?: string
  optional?: boolean
  on_failure?: StepFailureAction
  parallel?: boolean
  for_each?: string
  timeout?: number
  extract?: Record<string, string>
}

/** Workflow definition as parsed from YAML */
export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  category?: string
  icon?: string
  estimated_duration?: string
  requires_root?: boolean
  steps: WorkflowStepDefinition[]
}

/** Resolved workflow ready for UI display */
export interface Workflow {
  id: string
  name: string
  description: string
  category?: string
  icon?: string
  estimatedDuration?: string
  requiresRoot: boolean
  steps: WorkflowStepDefinition[]
}

/** Runtime status of a single step in a running workflow */
export interface WorkflowStepRun {
  id: string
  status: WorkflowStepStatus
  scanId?: number
  error?: string
}

/** Runtime status of an entire workflow execution */
export interface WorkflowRun {
  runId: string
  workflowId: string
  status: WorkflowRunStatus
  currentStepId: string | null
  steps: WorkflowStepRun[]
  startedAt: string
  completedAt?: string
}

/** Saved pipeline (stored in database) */
export interface Pipeline {
  id: number
  name: string
  description: string | null
  definition: string // JSON string of PipelineDefinition
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Pipeline Node Types (v2 discriminated union)
// ---------------------------------------------------------------------------

export type PipelineNodeType = 'tool' | 'condition' | 'for-each' | 'delay' | 'note' | 'start' | 'shell' | 'prompt' | 'set-variable'

/** Tool node — executes a CLI tool module */
export interface ToolNodeConfig {
  toolId: string
  args: Record<string, unknown>
  onFailure?: StepFailureAction
  timeout?: number
  captureOutput?: { variable: string; mode: 'full' | 'last_line' | 'regex' | 'json'; pattern?: string }
}

/** Condition node — evaluates expression and routes to true/false branch */
export interface ConditionNodeConfig {
  expression: string
  label?: string
}

/** ForEach node — iterates a collection from upstream results */
export interface ForEachNodeConfig {
  expression: string
  itemVariable?: string
  parallel?: boolean
}

/** Delay node — waits for specified seconds */
export interface DelayNodeConfig {
  seconds: number
  reason?: string
}

/** Note node — non-executable annotation on the canvas */
export interface NoteNodeConfig {
  content: string
  color?: 'default' | 'yellow' | 'blue' | 'red' | 'green'
}

/** Start node — entry point that sets target context */
export interface StartNodeConfig {
  targetSource?: 'selected' | 'all-in-scope'
  targetId?: number
  label?: string
}

/** Shell node — runs an arbitrary shell command */
export interface ShellNodeConfig {
  command: string
  cwd?: string
  timeout?: number
  onFailure?: StepFailureAction
  captureOutput?: { variable: string; mode: 'full' | 'last_line' | 'regex' | 'json'; pattern?: string }
}

/** Prompt node — pauses execution to ask user for input */
export interface PromptNodeConfig {
  message: string
  type: 'confirm' | 'text' | 'select'
  options?: string[]
  default?: string
  variable: string
  timeout?: number
}

/** Set-variable node — sets a variable in the execution context */
export interface SetVariableNodeConfig {
  variable: string
  value: string
}

/** Map of node type to its config interface */
export interface PipelineNodeConfigMap {
  tool: ToolNodeConfig
  condition: ConditionNodeConfig
  'for-each': ForEachNodeConfig
  delay: DelayNodeConfig
  note: NoteNodeConfig
  start: StartNodeConfig
  shell: ShellNodeConfig
  prompt: PromptNodeConfig
  'set-variable': SetVariableNodeConfig
}

/** V2 pipeline node with discriminated type field */
export interface PipelineNodeV2<T extends PipelineNodeType = PipelineNodeType> {
  id: string
  type: T
  config: PipelineNodeConfigMap[T]
  position: { x: number; y: number }
}

/**
 * V1 pipeline node (legacy — flat tool-only format).
 * Kept for backwards compatibility with saved pipelines.
 */
export interface PipelineNodeV1 {
  id: string
  toolId: string
  args: Record<string, unknown>
  position: { x: number; y: number }
}

/** Union of V1 and V2 node formats for deserialization */
export type PipelineNode = PipelineNodeV1 | PipelineNodeV2

/** Data mapping entry for edge-level data flow */
export interface DataMappingEntry {
  sourceExpression: string
  targetArg: string
}

/** Edge connecting two pipeline nodes */
export interface PipelineEdge {
  id: string
  source: string
  target: string
  sourceHandle?: 'true' | 'false'
  dataMapping?: Record<string, string>
  dataMappings?: DataMappingEntry[]
}

/** Full pipeline definition for the visual builder */
export interface PipelineDefinition {
  version?: 1 | 2
  nodes: PipelineNode[]
  edges: PipelineEdge[]
}

// ---------------------------------------------------------------------------
// Pipeline Execution State
// ---------------------------------------------------------------------------

export type PipelineNodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export type PipelineRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

/** Runtime status of a single node in a running pipeline */
export interface PipelineNodeRun {
  nodeId: string
  status: PipelineNodeStatus
  scanId?: number
  error?: string
  startedAt?: string
  completedAt?: string
}

/** Runtime status of an entire pipeline execution */
export interface PipelineRun {
  runId: string
  pipelineId: number | string
  pipelineName: string
  targetId?: number
  status: PipelineRunStatus
  nodes: PipelineNodeRun[]
  startedAt: string
  completedAt?: string
  variables?: Record<string, unknown>
}
