// Parsed result types — maps to vulnerabilities, credentials, web_paths, findings tables

import type { Target } from './target'
import type { Service } from './target'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type CredentialStatus = 'found' | 'valid' | 'invalid'

export interface Vulnerability {
  id: number
  target_id: number
  service_id: number | null
  title: string
  severity: Severity
  cve: string | null
  description: string | null
  evidence: string | null
  explanation: string | null // Educational explanation
  remediation: string | null
  discovered_by: string
  created_at: string
}

export interface Credential {
  id: number
  target_id: number
  service_id: number | null
  username: string
  password: string | null
  hash: string | null
  hash_type: string | null
  status: CredentialStatus
  source: string // How found: tool module ID
  created_at: string
}

export interface WebPath {
  id: number
  target_id: number
  path: string
  status_code: number
  content_length: number | null
  title: string | null
  redirect_url: string | null
  discovered_by: string
  created_at: string
}

export interface Finding {
  id: number
  target_id: number
  scan_id: number | null
  type: string // "dns", "technology", "misconfiguration", etc.
  title: string
  description: string | null
  severity: Severity
  data: string | null // JSON string
  created_at: string
}

/** Structured output from parsing a scan's results */
export interface ParsedResults {
  entities: {
    hosts: Target[]
    services: Service[]
    vulnerabilities: Vulnerability[]
    credentials: Credential[]
    webPaths: WebPath[]
    findings: Finding[]
  }
  raw: string
  summary: string
}
