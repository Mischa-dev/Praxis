/**
 * Database layer — SQLite via better-sqlite3.
 *
 * Each workspace gets its own database file. This module handles:
 *   - Schema creation and migrations
 *   - CRUD for every entity (targets, services, scans, etc.)
 *   - Compound queries (target detail with all related entities)
 */

import Database from 'better-sqlite3'
import { chmodSync } from 'fs'
import type {
  Target,
  TargetType,
  Service,
  Note,
  TargetDetail
} from '@shared/types/target'
import type { Scan, ScanStatus, CommandHistoryEntry } from '@shared/types/scan'
import type {
  Vulnerability,
  Credential,
  WebPath,
  Finding,
  Severity
} from '@shared/types/results'
import type { Pipeline } from '@shared/types/pipeline'

// ---------------------------------------------------------------------------
// Schema version — bump when adding migrations
// ---------------------------------------------------------------------------
const SCHEMA_VERSION = 1

// ---------------------------------------------------------------------------
// Schema DDL
// ---------------------------------------------------------------------------
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('ip','cidr','hostname','domain','url','email')),
  value TEXT NOT NULL UNIQUE,
  label TEXT,
  os_guess TEXT,
  scope_status TEXT NOT NULL DEFAULT 'unchecked',
  tags TEXT DEFAULT '[]',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  port INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  state TEXT NOT NULL DEFAULT 'open',
  service_name TEXT,
  product TEXT,
  service_version TEXT,
  banner TEXT,
  tunnel TEXT,
  confidence INTEGER DEFAULT 0,
  discovered_by TEXT DEFAULT 'manual',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(target_id, port, protocol)
);

CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER REFERENCES targets(id),
  tool_id TEXT NOT NULL,
  command TEXT NOT NULL,
  args TEXT DEFAULT '{}',
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed','cancelled')),
  exit_code INTEGER,
  started_at DATETIME,
  completed_at DATETIME,
  duration_ms INTEGER,
  raw_output_path TEXT,
  parsed_results TEXT,
  error_output TEXT,
  workflow_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vulnerabilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  scan_id INTEGER REFERENCES scans(id),
  service_id INTEGER REFERENCES services(id),
  title TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('critical','high','medium','low','info')),
  cve TEXT,
  description TEXT,
  evidence TEXT,
  explanation TEXT,
  remediation TEXT,
  discovered_by TEXT,
  verified BOOLEAN DEFAULT 0,
  false_positive BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER REFERENCES targets(id),
  scan_id INTEGER REFERENCES scans(id),
  service_id INTEGER REFERENCES services(id),
  username TEXT,
  password TEXT,
  hash TEXT,
  hash_type TEXT,
  status TEXT DEFAULT 'found',
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS web_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  scan_id INTEGER REFERENCES scans(id),
  path TEXT NOT NULL,
  status_code INTEGER,
  content_length INTEGER,
  title TEXT,
  redirect_url TEXT,
  discovered_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(target_id, path)
);

CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER REFERENCES targets(id),
  scan_id INTEGER REFERENCES scans(id),
  type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS command_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER REFERENCES scans(id),
  command TEXT NOT NULL,
  tool_id TEXT,
  target_id INTEGER REFERENCES targets(id),
  exit_code INTEGER,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pipelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  definition TEXT NOT NULL,
  is_builtin BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER REFERENCES targets(id),
  title TEXT,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`

// ---------------------------------------------------------------------------
// Migration registry
// ---------------------------------------------------------------------------
interface Migration {
  version: number
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  // Future migrations go here. Example:
  // { version: 2, up: (db) => { db.exec('ALTER TABLE targets ADD COLUMN ...') } }
]

// ---------------------------------------------------------------------------
// Database class
// ---------------------------------------------------------------------------

export class WorkspaceDatabase {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.init()

    // Restrict database file permissions — credentials and scan data are sensitive
    try {
      chmodSync(dbPath, 0o600)
    } catch {
      // Non-fatal: may fail on some filesystems
    }
  }

  /** Create tables and run pending migrations */
  private init(): void {
    this.db.exec(SCHEMA_SQL)

    const row = this.db.prepare('SELECT version FROM schema_version').get() as
      | { version: number }
      | undefined

    if (!row) {
      this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION)
    } else {
      this.runMigrations(row.version)
    }
  }

  private runMigrations(currentVersion: number): void {
    const pending = migrations
      .filter((m) => m.version > currentVersion)
      .sort((a, b) => a.version - b.version)

    if (pending.length === 0) return

    const migrate = this.db.transaction(() => {
      for (const m of pending) {
        m.up(this.db)
      }
      this.db.prepare('UPDATE schema_version SET version = ?').run(
        pending[pending.length - 1].version
      )
    })
    migrate()
  }

  /** Close the database connection */
  close(): void {
    this.db.close()
  }

  // =========================================================================
  // TARGETS
  // =========================================================================

  addTarget(type: TargetType, value: string, label?: string): Target {
    const stmt = this.db.prepare(
      `INSERT INTO targets (type, value, label) VALUES (?, ?, ?)
       RETURNING *`
    )
    return stmt.get(type, value, label ?? null) as Target
  }

  getTarget(id: number): Target | undefined {
    return this.db.prepare('SELECT * FROM targets WHERE id = ?').get(id) as Target | undefined
  }

  listTargets(): Target[] {
    return this.db.prepare('SELECT * FROM targets ORDER BY created_at DESC').all() as Target[]
  }

  updateTarget(
    id: number,
    updates: Partial<
      Pick<Target, 'label' | 'notes' | 'tags' | 'status' | 'os_guess' | 'scope_status'>
    >
  ): Target | undefined {
    const fields: string[] = []
    const values: unknown[] = []

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        fields.push(`${key} = ?`)
        values.push(val)
      }
    }

    if (fields.length === 0) return this.getTarget(id)

    fields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id)

    this.db
      .prepare(`UPDATE targets SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values)

    return this.getTarget(id)
  }

  removeTarget(id: number): void {
    this.db.prepare('DELETE FROM targets WHERE id = ?').run(id)
  }

  /** Get a target with all related entities */
  getTargetDetail(id: number): TargetDetail | undefined {
    const target = this.getTarget(id)
    if (!target) return undefined

    return {
      ...target,
      services: this.listServices(id),
      vulnerabilities: this.listVulnerabilities(id),
      credentials: this.listCredentials(id),
      web_paths: this.listWebPaths(id),
      findings: this.listFindings(id),
      scans: this.listScans({ targetId: id }),
      notes_list: this.listNotes(id)
    }
  }

  // =========================================================================
  // SERVICES
  // =========================================================================

  addService(data: {
    target_id: number
    port: number
    protocol?: string
    state?: string
    service_name?: string
    product?: string
    service_version?: string
    banner?: string
    tunnel?: string
    confidence?: number
    discovered_by?: string
  }): Service {
    const stmt = this.db.prepare(
      `INSERT INTO services (target_id, port, protocol, state, service_name, product,
        service_version, banner, tunnel, confidence, discovered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(target_id, port, protocol) DO UPDATE SET
         state = excluded.state,
         service_name = COALESCE(excluded.service_name, services.service_name),
         product = COALESCE(excluded.product, services.product),
         service_version = COALESCE(excluded.service_version, services.service_version),
         banner = COALESCE(excluded.banner, services.banner),
         tunnel = COALESCE(excluded.tunnel, services.tunnel),
         confidence = MAX(excluded.confidence, services.confidence),
         discovered_by = excluded.discovered_by
       RETURNING *`
    )
    return stmt.get(
      data.target_id,
      data.port,
      data.protocol ?? 'tcp',
      data.state ?? 'open',
      data.service_name ?? null,
      data.product ?? null,
      data.service_version ?? null,
      data.banner ?? null,
      data.tunnel ?? null,
      data.confidence ?? 0,
      data.discovered_by ?? 'manual'
    ) as Service
  }

  getService(id: number): Service | undefined {
    return this.db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Service | undefined
  }

  listServices(targetId: number): Service[] {
    return this.db
      .prepare('SELECT * FROM services WHERE target_id = ? ORDER BY port ASC')
      .all(targetId) as Service[]
  }

  removeService(id: number): void {
    this.db.prepare('DELETE FROM services WHERE id = ?').run(id)
  }

  // =========================================================================
  // SCANS
  // =========================================================================

  addScan(data: {
    tool_id: string
    command: string
    target_id?: number
    args?: string
    status?: ScanStatus
    workflow_id?: string
  }): Scan {
    const stmt = this.db.prepare(
      `INSERT INTO scans (tool_id, command, target_id, args, status, workflow_id)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    return stmt.get(
      data.tool_id,
      data.command,
      data.target_id ?? null,
      data.args ?? '{}',
      data.status ?? 'queued',
      data.workflow_id ?? null
    ) as Scan
  }

  getScan(id: number): Scan | undefined {
    return this.db.prepare('SELECT * FROM scans WHERE id = ?').get(id) as Scan | undefined
  }

  listScans(filters?: {
    targetId?: number
    status?: ScanStatus
    toolId?: string
    limit?: number
    offset?: number
  }): Scan[] {
    const conditions: string[] = []
    const params: unknown[] = []

    if (filters?.targetId !== undefined) {
      conditions.push('target_id = ?')
      params.push(filters.targetId)
    }
    if (filters?.status) {
      conditions.push('status = ?')
      params.push(filters.status)
    }
    if (filters?.toolId) {
      conditions.push('tool_id = ?')
      params.push(filters.toolId)
    }

    let sql = 'SELECT * FROM scans'
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY created_at DESC'

    if (filters?.limit) {
      sql += ' LIMIT ?'
      params.push(filters.limit)
    }
    if (filters?.offset) {
      sql += ' OFFSET ?'
      params.push(filters.offset)
    }

    return this.db.prepare(sql).all(...params) as Scan[]
  }

  updateScan(
    id: number,
    updates: Partial<
      Pick<
        Scan,
        | 'status'
        | 'exit_code'
        | 'started_at'
        | 'completed_at'
        | 'duration_ms'
        | 'raw_output_path'
        | 'parsed_results'
        | 'error_output'
      >
    >
  ): Scan | undefined {
    const fields: string[] = []
    const values: unknown[] = []

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        fields.push(`${key} = ?`)
        values.push(val)
      }
    }

    if (fields.length === 0) return this.getScan(id)

    values.push(id)
    this.db.prepare(`UPDATE scans SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    return this.getScan(id)
  }

  // =========================================================================
  // VULNERABILITIES
  // =========================================================================

  addVulnerability(data: {
    target_id: number
    title: string
    severity: Severity
    scan_id?: number
    service_id?: number
    cve?: string
    description?: string
    evidence?: string
    explanation?: string
    remediation?: string
    discovered_by?: string
  }): Vulnerability {
    const stmt = this.db.prepare(
      `INSERT INTO vulnerabilities (target_id, scan_id, service_id, title, severity,
        cve, description, evidence, explanation, remediation, discovered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    return stmt.get(
      data.target_id,
      data.scan_id ?? null,
      data.service_id ?? null,
      data.title,
      data.severity,
      data.cve ?? null,
      data.description ?? null,
      data.evidence ?? null,
      data.explanation ?? null,
      data.remediation ?? null,
      data.discovered_by ?? null
    ) as Vulnerability
  }

  getVulnerability(id: number): Vulnerability | undefined {
    return this.db.prepare('SELECT * FROM vulnerabilities WHERE id = ?').get(id) as
      | Vulnerability
      | undefined
  }

  listVulnerabilities(targetId: number): Vulnerability[] {
    return this.db
      .prepare('SELECT * FROM vulnerabilities WHERE target_id = ? ORDER BY created_at DESC')
      .all(targetId) as Vulnerability[]
  }

  // =========================================================================
  // CREDENTIALS
  // =========================================================================

  addCredential(data: {
    target_id: number
    username: string
    password?: string
    hash?: string
    hash_type?: string
    status?: string
    source?: string
    scan_id?: number
    service_id?: number
  }): Credential {
    const stmt = this.db.prepare(
      `INSERT INTO credentials (target_id, scan_id, service_id, username, password,
        hash, hash_type, status, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    return stmt.get(
      data.target_id,
      data.scan_id ?? null,
      data.service_id ?? null,
      data.username,
      data.password ?? null,
      data.hash ?? null,
      data.hash_type ?? null,
      data.status ?? 'found',
      data.source ?? null
    ) as Credential
  }

  listCredentials(targetId: number): Credential[] {
    return this.db
      .prepare('SELECT * FROM credentials WHERE target_id = ? ORDER BY created_at DESC')
      .all(targetId) as Credential[]
  }

  /** List all credentials across all targets, joined with target value for grouping */
  listAllCredentials(): (Credential & { target_value: string; target_type: string; service_name: string | null; port: number | null })[] {
    return this.db
      .prepare(
        `SELECT c.*, t.value AS target_value, t.type AS target_type,
                s.service_name, s.port
         FROM credentials c
         JOIN targets t ON c.target_id = t.id
         LEFT JOIN services s ON c.service_id = s.id
         ORDER BY t.value, c.created_at DESC`
      )
      .all() as (Credential & { target_value: string; target_type: string; service_name: string | null; port: number | null })[]
  }

  /** Update a credential's status (found/valid/invalid) */
  updateCredentialStatus(credentialId: number, status: string): Credential | undefined {
    return this.db
      .prepare('UPDATE credentials SET status = ? WHERE id = ? RETURNING *')
      .get(status, credentialId) as Credential | undefined
  }

  /** Delete a credential by ID */
  deleteCredential(credentialId: number): void {
    this.db.prepare('DELETE FROM credentials WHERE id = ?').run(credentialId)
  }

  // =========================================================================
  // WEB PATHS
  // =========================================================================

  addWebPath(data: {
    target_id: number
    path: string
    status_code?: number
    content_length?: number
    title?: string
    redirect_url?: string
    discovered_by?: string
    scan_id?: number
  }): WebPath {
    const stmt = this.db.prepare(
      `INSERT INTO web_paths (target_id, scan_id, path, status_code, content_length,
        title, redirect_url, discovered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(target_id, path) DO UPDATE SET
         status_code = COALESCE(excluded.status_code, web_paths.status_code),
         content_length = COALESCE(excluded.content_length, web_paths.content_length),
         title = COALESCE(excluded.title, web_paths.title),
         redirect_url = COALESCE(excluded.redirect_url, web_paths.redirect_url)
       RETURNING *`
    )
    return stmt.get(
      data.target_id,
      data.scan_id ?? null,
      data.path,
      data.status_code ?? null,
      data.content_length ?? null,
      data.title ?? null,
      data.redirect_url ?? null,
      data.discovered_by ?? null
    ) as WebPath
  }

  listWebPaths(targetId: number): WebPath[] {
    return this.db
      .prepare('SELECT * FROM web_paths WHERE target_id = ? ORDER BY path ASC')
      .all(targetId) as WebPath[]
  }

  // =========================================================================
  // FINDINGS
  // =========================================================================

  addFinding(data: {
    target_id: number
    title: string
    type?: string
    description?: string
    severity?: Severity
    data?: string
    scan_id?: number
  }): Finding {
    const stmt = this.db.prepare(
      `INSERT INTO findings (target_id, scan_id, type, title, description, severity, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    return stmt.get(
      data.target_id,
      data.scan_id ?? null,
      data.type ?? null,
      data.title,
      data.description ?? null,
      data.severity ?? 'info',
      data.data ?? null
    ) as Finding
  }

  listFindings(targetId: number): Finding[] {
    return this.db
      .prepare('SELECT * FROM findings WHERE target_id = ? ORDER BY created_at DESC')
      .all(targetId) as Finding[]
  }

  // =========================================================================
  // COMMAND HISTORY
  // =========================================================================

  addCommandHistory(data: {
    command: string
    scan_id?: number
    tool_id?: string
    target_id?: number
    exit_code?: number
    duration_ms?: number
  }): CommandHistoryEntry {
    const stmt = this.db.prepare(
      `INSERT INTO command_history (scan_id, command, tool_id, target_id, exit_code, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    return stmt.get(
      data.scan_id ?? null,
      data.command,
      data.tool_id ?? null,
      data.target_id ?? null,
      data.exit_code ?? null,
      data.duration_ms ?? null
    ) as CommandHistoryEntry
  }

  listCommandHistory(opts?: {
    limit?: number
    offset?: number
    toolId?: string
    targetId?: number
    exitCode?: number
    fromDate?: string
    toDate?: string
    search?: string
  }): CommandHistoryEntry[] {
    const conditions: string[] = []
    const params: unknown[] = []

    if (opts?.toolId) {
      conditions.push('tool_id = ?')
      params.push(opts.toolId)
    }
    if (opts?.targetId) {
      conditions.push('target_id = ?')
      params.push(opts.targetId)
    }
    if (opts?.exitCode !== undefined && opts.exitCode !== null) {
      conditions.push('exit_code = ?')
      params.push(opts.exitCode)
    }
    if (opts?.fromDate) {
      conditions.push('created_at >= ?')
      params.push(opts.fromDate)
    }
    if (opts?.toDate) {
      conditions.push('created_at <= ?')
      params.push(opts.toDate)
    }
    if (opts?.search) {
      conditions.push('command LIKE ?')
      params.push(`%${opts.search}%`)
    }

    let sql = 'SELECT * FROM command_history'
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY created_at DESC'

    if (opts?.limit) {
      sql += ' LIMIT ?'
      params.push(opts.limit)
    }
    if (opts?.offset) {
      sql += ' OFFSET ?'
      params.push(opts.offset)
    }

    return this.db.prepare(sql).all(...params) as CommandHistoryEntry[]
  }

  // =========================================================================
  // PIPELINES
  // =========================================================================

  addPipeline(data: {
    name: string
    definition: string
    description?: string
    is_builtin?: boolean
  }): Pipeline {
    const stmt = this.db.prepare(
      `INSERT INTO pipelines (name, description, definition, is_builtin)
       VALUES (?, ?, ?, ?)
       RETURNING *`
    )
    return stmt.get(
      data.name,
      data.description ?? null,
      data.definition,
      data.is_builtin ? 1 : 0
    ) as Pipeline
  }

  getPipeline(id: number): Pipeline | undefined {
    return this.db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id) as Pipeline | undefined
  }

  listPipelines(): Pipeline[] {
    return this.db.prepare('SELECT * FROM pipelines ORDER BY name ASC').all() as Pipeline[]
  }

  updatePipeline(
    id: number,
    updates: Partial<Pick<Pipeline, 'name' | 'description' | 'definition'>>
  ): Pipeline | undefined {
    const fields: string[] = []
    const values: unknown[] = []

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        fields.push(`${key} = ?`)
        values.push(val)
      }
    }

    if (fields.length === 0) return this.getPipeline(id)

    fields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id)
    this.db.prepare(`UPDATE pipelines SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    return this.getPipeline(id)
  }

  removePipeline(id: number): void {
    this.db.prepare('DELETE FROM pipelines WHERE id = ?').run(id)
  }

  // =========================================================================
  // NOTES
  // =========================================================================

  addNote(data: { target_id: number; content: string; title?: string }): Note {
    const stmt = this.db.prepare(
      `INSERT INTO notes (target_id, title, content)
       VALUES (?, ?, ?)
       RETURNING *`
    )
    return stmt.get(data.target_id, data.title ?? null, data.content) as Note
  }

  getNote(id: number): Note | undefined {
    return this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined
  }

  listNotes(targetId: number): Note[] {
    return this.db
      .prepare('SELECT * FROM notes WHERE target_id = ? ORDER BY updated_at DESC')
      .all(targetId) as Note[]
  }

  updateNote(id: number, updates: Partial<Pick<Note, 'title' | 'content'>>): Note | undefined {
    const fields: string[] = []
    const values: unknown[] = []

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        fields.push(`${key} = ?`)
        values.push(val)
      }
    }

    if (fields.length === 0) return this.getNote(id)

    fields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id)
    this.db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    return this.getNote(id)
  }

  removeNote(id: number): void {
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  }

  // =========================================================================
  // GENERIC QUERY
  // =========================================================================

  /** Run a filtered query against any table. Used by the db:query IPC channel. */
  query(opts: {
    table: string
    filters?: Record<string, unknown>
    sort?: { column: string; direction: 'asc' | 'desc' }
    limit?: number
    offset?: number
  }): unknown[] {
    const allowedTables = [
      'targets',
      'services',
      'scans',
      'vulnerabilities',
      'credentials',
      'web_paths',
      'findings',
      'command_history',
      'pipelines',
      'notes'
    ]

    if (!allowedTables.includes(opts.table)) {
      throw new Error(`Query not allowed on table: ${opts.table}`)
    }

    const conditions: string[] = []
    const params: unknown[] = []

    if (opts.filters) {
      for (const [key, val] of Object.entries(opts.filters)) {
        // Only allow simple column = value filters; column names are validated below
        if (!/^[a-z_]+$/.test(key)) {
          throw new Error(`Invalid column name: ${key}`)
        }
        conditions.push(`${key} = ?`)
        params.push(val)
      }
    }

    let sql = `SELECT * FROM ${opts.table}`
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    if (opts.sort) {
      if (!/^[a-z_]+$/.test(opts.sort.column)) {
        throw new Error(`Invalid sort column: ${opts.sort.column}`)
      }
      const dir = opts.sort.direction === 'desc' ? 'DESC' : 'ASC'
      sql += ` ORDER BY ${opts.sort.column} ${dir}`
    }

    if (opts.limit) {
      sql += ' LIMIT ?'
      params.push(opts.limit)
    }
    if (opts.offset) {
      sql += ' OFFSET ?'
      params.push(opts.offset)
    }

    return this.db.prepare(sql).all(...params)
  }

  // =========================================================================
  // SEARCH
  // =========================================================================

  /** Full-text search across multiple tables */
  search(query: string): {
    targets: Target[]
    services: Service[]
    vulnerabilities: Vulnerability[]
    credentials: Credential[]
    findings: Finding[]
    scans: Scan[]
    notes: Note[]
    webPaths: WebPath[]
  } {
    const like = `%${query}%`

    return {
      targets: this.db
        .prepare(
          `SELECT * FROM targets
           WHERE value LIKE ? OR label LIKE ? OR os_guess LIKE ? OR notes LIKE ?`
        )
        .all(like, like, like, like) as Target[],

      services: this.db
        .prepare(
          `SELECT * FROM services
           WHERE service_name LIKE ? OR product LIKE ? OR service_version LIKE ? OR banner LIKE ?`
        )
        .all(like, like, like, like) as Service[],

      vulnerabilities: this.db
        .prepare(
          `SELECT * FROM vulnerabilities
           WHERE title LIKE ? OR cve LIKE ? OR description LIKE ? OR evidence LIKE ?`
        )
        .all(like, like, like, like) as Vulnerability[],

      credentials: this.db
        .prepare(`SELECT * FROM credentials WHERE username LIKE ? OR source LIKE ?`)
        .all(like, like) as Credential[],

      findings: this.db
        .prepare(
          `SELECT * FROM findings
           WHERE title LIKE ? OR description LIKE ? OR type LIKE ?`
        )
        .all(like, like, like) as Finding[],

      scans: this.db
        .prepare(
          `SELECT * FROM scans
           WHERE tool_id LIKE ? OR command LIKE ?`
        )
        .all(like, like) as Scan[],

      notes: this.db
        .prepare(
          `SELECT * FROM notes
           WHERE title LIKE ? OR content LIKE ?`
        )
        .all(like, like) as Note[],

      webPaths: this.db
        .prepare(
          `SELECT * FROM web_paths
           WHERE path LIKE ? OR title LIKE ?`
        )
        .all(like, like) as WebPath[]
    }
  }

  // =========================================================================
  // STATISTICS (useful for dashboard)
  // =========================================================================

  /** Get counts for all entity types */
  stats(): {
    targets: number
    services: number
    scans: number
    vulnerabilities: number
    credentials: number
    webPaths: number
    findings: number
  } {
    const count = (table: string): number => {
      const row = this.db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }
      return row.c
    }

    return {
      targets: count('targets'),
      services: count('services'),
      scans: count('scans'),
      vulnerabilities: count('vulnerabilities'),
      credentials: count('credentials'),
      webPaths: count('web_paths'),
      findings: count('findings')
    }
  }
}
