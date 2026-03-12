// Barrel export for all shared types

export type {
  ProfileManifest,
  ProfileBranding,
  ProfileTheme,
  TargetTypeConfig,
  CategoryConfig,
  ScopeConfig,
  ProfilePaths,
  ProfileViewConfig,
  LayoutConfig,
  SidebarLayoutConfig,
  ContextPanelLayoutConfig,
  ContextPanelSectionConfig,
  TerminalLayoutConfig,
  TitleBarLayoutConfig,
  StatusBarLayoutConfig,
  EffectsConfig
} from './profile'

export type {
  ExecutionMode,
  ArgumentType,
  FlagSeparator,
  OutputType,
  EntityType,
  ModuleArgumentOption,
  ModuleArgumentDependency,
  ModuleArgumentValidation,
  ModuleArgumentFileFilter,
  ModuleArgument,
  OutputEntityExtraction,
  OutputPattern,
  ModuleOutput,
  ModuleSuggestion,
  ModuleTransferCommand,
  ModuleDefinition,
  Module
} from './module'

export type {
  TargetType,
  ScopeStatus,
  TargetStatus,
  Target,
  ServiceProtocol,
  ServiceState,
  Service,
  Note,
  TargetDetail
} from './target'

export type { ScanStatus, Scan, CommandHistoryEntry } from './scan'

export type {
  Severity,
  CredentialStatus,
  Vulnerability,
  Credential,
  WebPath,
  Finding,
  ParsedResults
} from './results'

export type { WorkspaceType, Workspace, WorkspaceScope } from './workspace'

export type {
  RiskLevel,
  ConditionType,
  ActionCondition,
  ActionSuggestion,
  ActionRule,
  ActionRuleFile,
  EvaluatedAction,
  NoScansCondition,
  ServiceExistsCondition,
  PortOpenCondition,
  PortRangeCondition,
  OsMatchesCondition,
  VulnFoundCondition,
  CredentialFoundCondition,
  ScanCompletedCondition,
  ProductVersionCondition,
  WebPathFoundCondition,
  FindingExistsCondition,
  TechnologyDetectedCondition,
  LegacyConditionType,
  GenericConditionType,
  EntityExistsCondition,
  EntityCountCondition,
  FieldMatchesCondition,
  EntityFieldRangeCondition
} from './action'

export type {
  StepFailureAction,
  WorkflowStepStatus,
  WorkflowRunStatus,
  WorkflowStepDefinition,
  WorkflowDefinition,
  Workflow,
  WorkflowStepRun,
  WorkflowRun,
  Pipeline,
  PipelineNodeType,
  ToolNodeConfig,
  ConditionNodeConfig,
  ForEachNodeConfig,
  DelayNodeConfig,
  NoteNodeConfig,
  StartNodeConfig,
  PipelineNodeConfigMap,
  PipelineNodeV2,
  PipelineNodeV1,
  PipelineNode,
  DataMappingEntry,
  PipelineEdge,
  PipelineDefinition,
  PipelineNodeStatus,
  PipelineRunStatus,
  PipelineNodeRun,
  PipelineRun
} from './pipeline'

export type {
  ToolExecuteRequest,
  ToolExecuteResponse,
  ToolOutputEvent,
  ToolStatusEvent,
  ToolCancelRequest,
  TargetAddRequest,
  TargetRemoveRequest,
  TargetUpdateRequest,
  TargetListRequest,
  TargetGetRequest,
  TargetActionsRequest,
  ScopeCheckRequest,
  ScopeCheckResult,
  ScopeSetRequest,
  WorkspaceCreateRequest,
  WorkspaceLoadRequest,
  WorkspaceListRequest,
  WorkspaceExportRequest,
  ScanListRequest,
  ScanGetRequest,
  ScanResultsRequest,
  WorkflowExecuteRequest,
  WorkflowCancelRequest,
  DbQueryRequest,
  DbSearchRequest,
  SearchResults,
  IpcChannelMap,
  IpcEventMap,
  IpcRequest,
  IpcResponse,
  CredentialWithContext,
  EntitySchemaRequest,
  EntityCreateRequest,
  EntityGetRequest,
  EntityListRequest,
  EntityUpdateRequest,
  EntityDeleteRequest,
  EntityDetailRequest,
  EntitySearchRequest,
  EntityActionsRequest
} from './ipc'

export type {
  EngineViewId,
  ViewId,
  ViewHistoryEntry,
  ViewState,
  ViewParamsMap
} from './ui'

export type { GlossaryTerm } from './glossary'

export type {
  FieldKind,
  FieldRole,
  FieldDef,
  AutoDetectRule,
  OnConflictConfig,
  EntityDef,
  ExtractionPattern,
  EntitySchema,
  ResolvedEntityDef,
  ResolvedSchema,
  EntityRecord,
  EntityDetail,
  EntityFilter
} from './entity'

export type {
  ThemeId,
  ScopeEnforcement,
  SudoMethod,
  AppSettings
} from './settings'
export { DEFAULT_SETTINGS } from './settings'
