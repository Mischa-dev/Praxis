// IPC channel names and typed message/response pairs

import type { Target, TargetType, TargetDetail, Note } from './target'
import type { Scan, ScanStatus, CommandHistoryEntry } from './scan'
import type { ParsedResults } from './results'
import type { Module } from './module'
import type { Workspace } from './workspace'
import type { EvaluatedAction } from './action'
import type { Workflow, WorkflowRun as WorkflowRunType, Pipeline, PipelineRun } from './pipeline'
import type { ProfileManifest } from './profile'
import type { GlossaryTerm } from './glossary'
import type { AppSettings } from './settings'
import type {
  ResolvedSchema,
  EntityRecord,
  EntityDetail as GenericEntityDetail,
  EntityFilter
} from './entity'

// ---------- Tool Execution ----------

export interface ToolExecuteRequest {
  toolId: string
  args: Record<string, unknown>
  targetId?: number
}

export interface ToolExecuteResponse {
  scanId: number
}

export interface ToolOutputEvent {
  scanId: number
  data: string
  stream: 'stdout' | 'stderr'
}

export interface ToolStatusEvent {
  scanId: number
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  exitCode?: number
  error?: string
}

export interface ToolCancelRequest {
  scanId: number
}

// ---------- Targets ----------

export interface TargetAddRequest {
  type: TargetType
  value: string
  label?: string
}

export interface TargetRemoveRequest {
  targetId: number
}

export interface TargetUpdateRequest {
  targetId: number
  updates: Partial<Pick<Target, 'label' | 'notes' | 'tags' | 'status' | 'os_guess'>>
}

export type TargetListRequest = Record<string, never>

export interface TargetGetRequest {
  targetId: number
}

export interface TargetActionsRequest {
  targetId: number
}

// ---------- Scope ----------

export interface ScopeCheckRequest {
  target: string
}

export interface ScopeCheckResult {
  inScope: boolean
  cloudProvider?: {
    name: string
    description: string
    authPolicyUrl: string
  }
  warnings: string[]
}

export interface ScopeSetRequest {
  inScope: string[]
  outOfScope: string[]
}

// ---------- Workspace ----------

export interface WorkspaceCreateRequest {
  name: string
  description?: string
  type?: string
  scope?: { inScope: string[]; outOfScope: string[] }
}

export interface WorkspaceLoadRequest {
  workspaceId: string
}

export type WorkspaceListRequest = Record<string, never>

export interface WorkspaceDeleteRequest {
  workspaceId: string
}

export interface WorkspaceUpdateRequest {
  workspaceId: string
  updates: {
    name?: string
    description?: string
    type?: string
    scope?: { inScope: string[]; outOfScope: string[] }
  }
}

export interface WorkspaceExportRequest {
  workspaceId: string
  format: 'zip'
}

// ---------- Scans ----------

export interface ScanListRequest {
  targetId?: number
  status?: ScanStatus
  toolId?: string
  limit?: number
  offset?: number
}

export interface ScanGetRequest {
  scanId: number
}

export interface ScanResultsRequest {
  scanId: number
}

// ---------- Workflows ----------

export interface WorkflowExecuteRequest {
  workflowId: string
  targetId?: number
  options?: {
    disabledSteps?: string[]
    argOverrides?: Record<string, Record<string, unknown>>
  }
}

export interface WorkflowCancelRequest {
  runId: string
}

// ---------- Pipelines ----------

export interface PipelineAddRequest {
  name: string
  description?: string
  definition: string // JSON string of PipelineDefinition
}

export interface PipelineGetRequest {
  pipelineId: number
}

export interface PipelineUpdateRequest {
  pipelineId: number
  updates: Partial<Pick<Pipeline, 'name' | 'description' | 'definition'>>
}

export interface PipelineRemoveRequest {
  pipelineId: number
}

export type PipelineListRequest = Record<string, never>

// ---------- Pipeline Prompt ----------

export interface PipelinePromptEvent {
  runId: string
  nodeId: string
  message: string
  type: 'confirm' | 'text' | 'select'
  options?: string[]
  default?: string
}

export interface PipelinePromptResponse {
  runId: string
  nodeId: string
  value: string | boolean
}

// ---------- Pipeline Execution ----------

export interface PipelineExecuteRequest {
  pipelineId: number
  targetId?: number
}

export interface PipelineExecuteResponse {
  runId: string
}

export interface PipelineCancelRunRequest {
  runId: string
}

export interface PipelineRunStatusRequest {
  runId: string
}

// ---------- Command History ----------

export interface HistoryListRequest {
  toolId?: string
  targetId?: number
  exitCode?: number
  fromDate?: string
  toDate?: string
  search?: string
  limit?: number
  offset?: number
}

// ---------- Database / Search ----------

export interface DbQueryRequest {
  table: string
  filters?: Record<string, unknown>
  sort?: { column: string; direction: 'asc' | 'desc' }
  limit?: number
  offset?: number
}

export interface DbStatsResponse {
  targets: number
  services: number
  scans: number
  vulnerabilities: number
  credentials: number
  webPaths: number
  findings: number
}

export interface DbSearchRequest {
  query: string
}

export interface SearchResults {
  targets: Target[]
  services: import('./target').Service[]
  vulnerabilities: import('./results').Vulnerability[]
  credentials: import('./results').Credential[]
  findings: import('./results').Finding[]
  scans: Scan[]
  notes: import('./target').Note[]
  webPaths: import('./results').WebPath[]
}

// ---------- Notes ----------

export interface NoteAddRequest {
  targetId: number
  content: string
  title?: string
}

export interface NoteUpdateRequest {
  noteId: number
  updates: { title?: string; content?: string }
}

export interface NoteRemoveRequest {
  noteId: number
}

export interface NoteListRequest {
  targetId: number
}

// ---------- Credentials ----------

export interface CredentialListAllRequest {
  /** No params — returns all credentials across all targets */
}

export interface CredentialUpdateStatusRequest {
  credentialId: number
  status: import('./results').CredentialStatus
}

export interface CredentialDeleteRequest {
  credentialId: number
}

export type CredentialWithContext = import('./results').Credential & {
  target_value: string
  target_type: string
  service_name: string | null
  port: number | null
}

// ---------- Reports ----------

export type ReportType = 'executive' | 'technical' | 'vulnerability'
export type ReportFormat = 'markdown' | 'html' | 'pdf'

export interface ReportGenerateRequest {
  type: ReportType
  targetIds?: number[] // undefined = all targets
  includeScans?: boolean
  includeCredentials?: boolean
  includeWebPaths?: boolean
  title?: string
  author?: string
}

export interface ReportGenerateResponse {
  markdown: string
  html: string
}

export interface ReportExportRequest {
  type: ReportType
  format: ReportFormat
  targetIds?: number[]
  includeScans?: boolean
  includeCredentials?: boolean
  includeWebPaths?: boolean
  title?: string
  author?: string
}

export interface ReportExportResponse {
  path: string
  format: ReportFormat
}

export interface ReportTemplate {
  id: ReportType
  name: string
  description: string
}

// ---------- Generic Entity System ----------

export interface EntitySchemaRequest {
  /** No params — returns the full resolved schema */
}

export interface EntityCreateRequest {
  entityType: string
  data: Record<string, unknown>
}

export interface EntityGetRequest {
  entityType: string
  id: number
}

export interface EntityListRequest {
  entityType: string
  filter?: EntityFilter
}

export interface EntityUpdateRequest {
  entityType: string
  id: number
  updates: Record<string, unknown>
}

export interface EntityDeleteRequest {
  entityType: string
  id: number
}

export interface EntityDetailRequest {
  entityType: string
  id: number
}

export interface EntitySearchRequest {
  query: string
}

export interface EntityActionsRequest {
  entityType: string
  id: number
}

// ---------- Settings ----------

export interface SettingsSetRequest {
  settings: Partial<AppSettings>
}

// ---------- IPC Channel Map ----------

/** Request-response channels (ipcMain.handle / ipcRenderer.invoke) */
export interface IpcChannelMap {
  // Tool execution
  'tool:execute': { request: ToolExecuteRequest; response: ToolExecuteResponse }
  'tool:cancel': { request: ToolCancelRequest; response: void }

  // Targets
  'target:add': { request: TargetAddRequest; response: Target }
  'target:remove': { request: TargetRemoveRequest; response: void }
  'target:update': { request: TargetUpdateRequest; response: Target }
  'target:list': { request: TargetListRequest; response: Target[] }
  'target:get': { request: TargetGetRequest; response: TargetDetail }
  'target:actions': { request: TargetActionsRequest; response: EvaluatedAction[] }

  // Scope
  'scope:check': { request: ScopeCheckRequest; response: ScopeCheckResult }
  'scope:set': { request: ScopeSetRequest; response: void }

  // Workspace
  'workspace:create': { request: WorkspaceCreateRequest; response: Workspace }
  'workspace:load': { request: WorkspaceLoadRequest; response: Workspace }
  'workspace:list': { request: WorkspaceListRequest; response: Workspace[] }
  'workspace:delete': { request: WorkspaceDeleteRequest; response: void }
  'workspace:update': { request: WorkspaceUpdateRequest; response: Workspace }
  'workspace:export': { request: WorkspaceExportRequest; response: string }
  'workspace:current': { request: Record<string, never>; response: Workspace | null }

  // Modules
  'module:list': { request: Record<string, never>; response: Module[] }
  'module:get': { request: { moduleId: string }; response: Module }
  'module:check-install': { request: { moduleId: string }; response: boolean }
  'module:reload': { request: Record<string, never>; response: Module[] }

  // Scans
  'scan:list': { request: ScanListRequest; response: Scan[] }
  'scan:get': { request: ScanGetRequest; response: Scan }
  'scan:results': { request: ScanResultsRequest; response: ParsedResults }

  // Workflows
  'workflow:list': { request: Record<string, never>; response: Workflow[] }
  'workflow:get': { request: { workflowId: string }; response: Workflow }
  'workflow:execute': { request: WorkflowExecuteRequest; response: { runId: string } }
  'workflow:cancel': { request: WorkflowCancelRequest; response: void }

  // Notes
  'note:add': { request: NoteAddRequest; response: Note }
  'note:list': { request: NoteListRequest; response: Note[] }
  'note:update': { request: NoteUpdateRequest; response: Note }
  'note:remove': { request: NoteRemoveRequest; response: void }

  // Pipelines
  'pipeline:add': { request: PipelineAddRequest; response: Pipeline }
  'pipeline:get': { request: PipelineGetRequest; response: Pipeline }
  'pipeline:list': { request: PipelineListRequest; response: Pipeline[] }
  'pipeline:update': { request: PipelineUpdateRequest; response: Pipeline }
  'pipeline:remove': { request: PipelineRemoveRequest; response: void }

  // Pipeline Execution
  'pipeline:execute': { request: PipelineExecuteRequest; response: PipelineExecuteResponse }
  'pipeline:cancel-run': { request: PipelineCancelRunRequest; response: void }
  'pipeline:run-status': { request: PipelineRunStatusRequest; response: PipelineRun | null }
  'pipeline:prompt-response': { request: PipelinePromptResponse; response: void }

  // Credentials
  'credential:list-all': { request: CredentialListAllRequest; response: CredentialWithContext[] }
  'credential:update-status': { request: CredentialUpdateStatusRequest; response: import('./results').Credential }
  'credential:delete': { request: CredentialDeleteRequest; response: void }

  // Command History
  'history:list': { request: HistoryListRequest; response: CommandHistoryEntry[] }

  // Database / Search
  'db:query': { request: DbQueryRequest; response: unknown[] }
  'db:search': { request: DbSearchRequest; response: SearchResults }
  'db:stats': { request: Record<string, never>; response: DbStatsResponse }

  // Profile
  'profile:get': { request: Record<string, never>; response: ProfileManifest }

  // Glossary
  'glossary:list': { request: Record<string, never>; response: GlossaryTerm[] }

  // Settings
  'settings:get': { request: Record<string, never>; response: AppSettings }
  'settings:set': { request: SettingsSetRequest; response: AppSettings }

  // Reports
  'report:generate': { request: ReportGenerateRequest; response: ReportGenerateResponse }
  'report:export': { request: ReportExportRequest; response: ReportExportResponse }
  'report:templates': { request: Record<string, never>; response: ReportTemplate[] }

  // Notifications
  'notification:desktop': { request: { title: string; body: string }; response: void }

  // Generic Entity System
  'entity:schema': { request: EntitySchemaRequest; response: ResolvedSchema }
  'entity:create': { request: EntityCreateRequest; response: EntityRecord }
  'entity:get': { request: EntityGetRequest; response: EntityRecord | null }
  'entity:list': { request: EntityListRequest; response: EntityRecord[] }
  'entity:update': { request: EntityUpdateRequest; response: EntityRecord | null }
  'entity:delete': { request: EntityDeleteRequest; response: void }
  'entity:detail': { request: EntityDetailRequest; response: GenericEntityDetail | null }
  'entity:search': { request: EntitySearchRequest; response: Record<string, EntityRecord[]> }
  'entity:stats': { request: Record<string, never>; response: Record<string, number> }
  'entity:actions': { request: EntityActionsRequest; response: EvaluatedAction[] }
}

/** Streaming event channels (webContents.send / ipcRenderer.on) */
export interface IpcEventMap {
  'tool:output': ToolOutputEvent
  'tool:status': ToolStatusEvent
  'workflow:step-status': WorkflowRunType
  'pipeline:node-status': PipelineRun
  'pipeline:prompt': PipelinePromptEvent
}

// Helper type to extract request/response types from the channel map
export type IpcRequest<C extends keyof IpcChannelMap> = IpcChannelMap[C]['request']
export type IpcResponse<C extends keyof IpcChannelMap> = IpcChannelMap[C]['response']
