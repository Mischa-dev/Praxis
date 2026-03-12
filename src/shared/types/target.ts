// Target and service types — maps to database tables

export type TargetType = 'ip' | 'cidr' | 'hostname' | 'domain' | 'url' | 'email'

export type ScopeStatus = 'in-scope' | 'out-of-scope' | 'unchecked'

export type TargetStatus = 'new' | 'scanning' | 'scanned' | 'compromised'

export interface Target {
  id: number
  type: TargetType
  value: string
  label: string | null
  os_guess: string | null
  scope_status: ScopeStatus
  tags: string // JSON array string
  notes: string | null
  status: TargetStatus
  created_at: string
  updated_at: string
}

export type ServiceProtocol = 'tcp' | 'udp'

export type ServiceState = 'open' | 'closed' | 'filtered'

export interface Service {
  id: number
  target_id: number
  port: number
  protocol: ServiceProtocol
  state: ServiceState
  service_name: string | null
  product: string | null
  service_version: string | null
  banner: string | null
  tunnel: string | null // "ssl" if TLS-wrapped
  confidence: number
  discovered_by: string
  created_at: string
}

export interface Note {
  id: number
  target_id: number
  title: string | null
  content: string
  created_at: string
  updated_at: string
}

// Forward-import types used in TargetDetail
import type { Vulnerability, Credential, WebPath, Finding } from './results'
import type { Scan } from './scan'

export interface TargetDetail extends Target {
  services: Service[]
  vulnerabilities: Vulnerability[]
  credentials: Credential[]
  web_paths: WebPath[]
  findings: Finding[]
  scans: Scan[]
  notes_list: Note[]
}
