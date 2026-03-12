// UI routing and view state types

/** Engine-provided view IDs */
export type EngineViewId =
  | 'home'
  | 'targets'
  | 'target-detail'
  | 'entities'
  | 'entity-detail-view'
  | 'tool-form'
  | 'scan-results'
  | 'workflow-view'
  | 'workflow-run'
  | 'pipeline-builder'
  | 'history'
  | 'settings'

/** ViewId is extensible — profile views contribute additional IDs at runtime */
export type ViewId = EngineViewId | (string & {})

export interface ViewHistoryEntry {
  view: ViewId
  params: Record<string, unknown>
}

export interface ViewState {
  activeView: ViewId
  viewParams: Record<string, unknown>
  viewHistory: ViewHistoryEntry[]
  sidebarSection: string
}

/** Parameter shapes for engine views */
export interface ViewParamsMap {
  home: Record<string, never>
  targets: Record<string, never>
  'target-detail': { targetId: number }
  entities: Record<string, never>
  'entity-detail-view': { entityType: string; entityId: number }
  'tool-form': { toolId: string; targetId?: number; autoArgs?: Record<string, unknown> }
  'scan-results': { scanId: number }
  'workflow-view': { workflowId: string }
  'workflow-run': { runId: string }
  'pipeline-builder': { pipelineId?: number }
  history: { filter?: { toolId?: string; targetId?: number } }
  settings: Record<string, never>
}
