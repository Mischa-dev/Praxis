// Scan types — maps to scans and command_history database tables

export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Scan {
  id: number
  target_id: number | null
  tool_id: string // Module ID
  command: string // Full CLI command
  args: string // JSON string of arguments
  status: ScanStatus
  exit_code: number | null
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  raw_output_path: string | null
  parsed_results: string | null // JSON string
  error_output: string | null
  created_at: string
}

export interface CommandHistoryEntry {
  id: number
  scan_id: number | null
  command: string
  tool_id: string | null
  target_id: number | null
  exit_code: number | null
  duration_ms: number | null
  created_at: string
}
