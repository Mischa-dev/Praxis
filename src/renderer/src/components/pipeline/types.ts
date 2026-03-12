// Node data interfaces for React Flow rendering

import type { Module } from '@shared/types'
import type {
  PipelineNodeStatus,
  StepFailureAction
} from '@shared/types/pipeline'

/** Base data shared by all node types */
export interface BaseNodeData {
  configured: boolean
  status?: PipelineNodeStatus
}

/** Tool node — existing node type, moved here */
export interface ToolNodeData extends BaseNodeData {
  label: string
  toolId: string
  module?: Module
  args: Record<string, unknown>
  onFailure?: StepFailureAction
  timeout?: number
}

/** Condition node — expression-based branching */
export interface ConditionNodeData extends BaseNodeData {
  expression: string
  label?: string
}

/** ForEach node — iterates over a collection */
export interface ForEachNodeData extends BaseNodeData {
  expression: string
  itemVariable: string
  parallel: boolean
}

/** Delay node — waits for N seconds */
export interface DelayNodeData extends BaseNodeData {
  seconds: number
  reason?: string
}

/** Note node — non-connectable annotation */
export interface NoteNodeData extends BaseNodeData {
  content: string
  color: 'default' | 'yellow' | 'blue' | 'red' | 'green'
}

/** Start node — pipeline entry point */
export interface StartNodeData extends BaseNodeData {
  targetSource: 'selected' | 'all-in-scope'
  targetId?: number
  targetLabel?: string
  label?: string
}

/** Union of all node data types */
export type AnyNodeData =
  | ToolNodeData
  | ConditionNodeData
  | ForEachNodeData
  | DelayNodeData
  | NoteNodeData
  | StartNodeData
