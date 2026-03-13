// Action rule types — loaded from profile action YAML files

export type RiskLevel = 'passive' | 'active' | 'intrusive'

/** Generic condition types */
export type ConditionType =
  | 'entity_exists'
  | 'entity_count'
  | 'field_matches'
  | 'entity_field_range'

export interface ActionConditionBase {
  type: ConditionType
}

// ── Generic Condition Types ──

export interface EntityExistsCondition extends ActionConditionBase {
  type: 'entity_exists'
  entity: string // Entity type from schema (e.g., 'service', 'vulnerability')
  match?: Record<string, unknown> // Field filters (e.g., { service_name: 'ssh', state: 'open' })
}

export interface EntityCountCondition extends ActionConditionBase {
  type: 'entity_count'
  entity: string
  match?: Record<string, unknown>
  op: '==' | '!=' | '>' | '<' | '>=' | '<='
  value: number
}

export interface FieldMatchesCondition extends ActionConditionBase {
  type: 'field_matches'
  entity: string
  field: string
  pattern: string // Regex pattern
}

export interface EntityFieldRangeCondition extends ActionConditionBase {
  type: 'entity_field_range'
  entity: string
  field: string
  min?: number
  max?: number
}

export type ActionCondition =
  | EntityExistsCondition
  | EntityCountCondition
  | FieldMatchesCondition
  | EntityFieldRangeCondition

export interface ActionSuggestion {
  id: string
  title: string
  description?: string
  tool: string // Module ID
  risk_level: RiskLevel
  auto_args?: Record<string, string>
  explanation: string
  one_click?: boolean
}

export interface ActionRule {
  id: string
  name: string
  description: string
  priority?: number
  category?: string
  conditions: ActionCondition[]
  actions: ActionSuggestion[]
}

/** Action rule file can contain multiple rules */
export interface ActionRuleFile {
  rules: ActionRule[]
}

/** Evaluated action ready for display in the UI */
export interface EvaluatedAction {
  ruleId: string
  actionId: string
  title: string
  description: string
  tool: string
  riskLevel: RiskLevel
  autoArgs: Record<string, unknown>
  explanation: string
  oneClick: boolean
  priority: number
  category?: string
}
