// Action rule types — loaded from profile action YAML files

export type RiskLevel = 'passive' | 'active' | 'intrusive'

export type ConditionType =
  | 'no_scans'
  | 'service_exists'
  | 'port_open'
  | 'port_range'
  | 'os_matches'
  | 'vuln_found'
  | 'credential_found'
  | 'scan_completed'
  | 'product_version'
  | 'web_path_found'
  | 'finding_exists'
  | 'technology_detected'

export interface ActionConditionBase {
  type: ConditionType
}

export interface NoScansCondition extends ActionConditionBase {
  type: 'no_scans'
}

export interface ServiceExistsCondition extends ActionConditionBase {
  type: 'service_exists'
  service_name: string
}

export interface PortOpenCondition extends ActionConditionBase {
  type: 'port_open'
  port: number
  protocol?: string
}

export interface PortRangeCondition extends ActionConditionBase {
  type: 'port_range'
  min: number
  max: number
  protocol?: string
}

export interface OsMatchesCondition extends ActionConditionBase {
  type: 'os_matches'
  pattern: string
}

export interface VulnFoundCondition extends ActionConditionBase {
  type: 'vuln_found'
  severity?: string
  cve?: string
}

export interface CredentialFoundCondition extends ActionConditionBase {
  type: 'credential_found'
  service_name?: string
}

export interface ScanCompletedCondition extends ActionConditionBase {
  type: 'scan_completed'
  tool: string
  negate?: boolean
}

export interface ProductVersionCondition extends ActionConditionBase {
  type: 'product_version'
  product: string
  version: string
}

export interface WebPathFoundCondition extends ActionConditionBase {
  type: 'web_path_found'
  status_code?: number
  path_pattern?: string
}

export interface FindingExistsCondition extends ActionConditionBase {
  type: 'finding_exists'
  finding_type: string
}

export interface TechnologyDetectedCondition extends ActionConditionBase {
  type: 'technology_detected'
  technology: string
}

export type ActionCondition =
  | NoScansCondition
  | ServiceExistsCondition
  | PortOpenCondition
  | PortRangeCondition
  | OsMatchesCondition
  | VulnFoundCondition
  | CredentialFoundCondition
  | ScanCompletedCondition
  | ProductVersionCondition
  | WebPathFoundCondition
  | FindingExistsCondition
  | TechnologyDetectedCondition

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
