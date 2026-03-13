/**
 * Report engine — generates Markdown, HTML, and PDF reports from workspace data.
 *
 * Uses the generic entity system to gather schema-driven data from the active
 * workspace database and renders it into structured reports. Three report types
 * are supported:
 *   - Executive Summary: high-level overview for stakeholders
 *   - Technical: detailed entity data for technical reviewers
 *   - Vulnerability: focused entity report using technical layout
 *
 * PDF generation uses Electron's built-in printToPDF on a hidden BrowserWindow.
 */

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { marked } from 'marked'
import { getDatabase } from './workspace-manager'
import { getEntitySchema } from './profile-loader'
import type { Scan } from '@shared/types/scan'
import type { ResolvedSchema, ResolvedEntityDef, EntityRecord } from '@shared/types/entity'
import type {
  ReportType,
  ReportFormat,
  ReportGenerateRequest,
  ReportExportRequest,
  ReportGenerateResponse,
  ReportExportResponse,
  ReportTemplate
} from '@shared/types/ipc'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportData {
  title: string
  author: string
  generatedAt: string
  stats: Record<string, number>
  /** Schema-driven generic data */
  generic: GenericReportData | null
}

/** Schema-driven report data — used when entity schema is available */
interface GenericReportData {
  schema: ResolvedSchema
  primaryEntities: EntityRecord[]
  /** Children grouped by primary entity ID, then by child type */
  childrenByEntity: Map<number, Record<string, EntityRecord[]>>
  scans: Scan[]
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Summary',
    description: 'High-level overview with severity statistics and key findings for stakeholders'
  },
  {
    id: 'technical',
    name: 'Technical Report',
    description: 'Detailed technical report with all services, vulnerabilities, credentials, and scan history'
  },
  {
    id: 'vulnerability',
    name: 'Vulnerability Report',
    description: 'Focused list of all discovered vulnerabilities organized by severity'
  }
]

// ---------------------------------------------------------------------------
// Data gathering
// ---------------------------------------------------------------------------

function gatherReportData(opts: {
  targetIds?: number[]
  includeScans?: boolean
  title?: string
  author?: string
}): ReportData {
  const db = getDatabase()

  // Use generic entity stats when schema is available, otherwise just scan count
  let stats: Record<string, number>
  try {
    stats = db.entityStats()
  } catch {
    stats = {}
  }

  // Gather generic data if schema is available
  const schema = getEntitySchema()
  let generic: GenericReportData | null = null
  if (schema && db.getEntitySchema()) {
    generic = gatherGenericData(db, schema, opts.targetIds, opts.includeScans !== false)
  }

  return {
    title: opts.title || 'Report',
    author: opts.author || 'Team',
    generatedAt: new Date().toISOString(),
    stats,
    generic
  }
}

/** Schema-driven data gathering — uses generic entity CRUD */
function gatherGenericData(
  db: import('./database').WorkspaceDatabase,
  schema: ResolvedSchema,
  targetIds?: number[],
  includeScans = true
): GenericReportData {
  const primaryType = schema.primaryEntity
  let primaryEntities: EntityRecord[]

  if (targetIds && targetIds.length > 0) {
    primaryEntities = targetIds
      .map((id) => db.entityGet(primaryType, id))
      .filter((e): e is EntityRecord => e !== undefined)
  } else {
    primaryEntities = db.entityList(primaryType)
  }

  const childrenByEntity = new Map<number, Record<string, EntityRecord[]>>()
  const primaryDef = schema.entities[primaryType]

  for (const entity of primaryEntities) {
    const children: Record<string, EntityRecord[]> = {}
    for (const childType of primaryDef.childTypes) {
      children[childType] = db.entityListChildren(childType, entity.id)
    }
    childrenByEntity.set(entity.id, children)
  }

  const scans = includeScans ? db.listScans({}) : []

  return { schema, primaryEntities, childrenByEntity, scans }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function escapeForTable(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

// ---------------------------------------------------------------------------
// Generic (schema-driven) renderers
// ---------------------------------------------------------------------------

/** Get the display-role field value from a generic entity */
function entityDisplay(entity: EntityRecord, def: ResolvedEntityDef): string {
  for (const [key, field] of Object.entries(def.fields)) {
    if (field.role === 'display') return String(entity[key] ?? '')
  }
  return String(entity.value ?? entity.name ?? entity.title ?? entity.id ?? '')
}

/** Get the status-role field value */
function entityStatus(entity: EntityRecord, def: ResolvedEntityDef): string | null {
  for (const [key, field] of Object.entries(def.fields)) {
    if (field.role === 'status') return entity[key] != null ? String(entity[key]) : null
  }
  return null
}

/** Get the category-role field value */
function entityCategory(entity: EntityRecord, def: ResolvedEntityDef): string | null {
  for (const [key, field] of Object.entries(def.fields)) {
    if (field.role === 'category') return entity[key] != null ? String(entity[key]) : null
  }
  return null
}

/** Get visible fields for table rendering (skip json, references, FK columns) */
function entityVisibleFields(def: ResolvedEntityDef): { key: string; label: string }[] {
  return Object.entries(def.fields)
    .filter(([key, field]) => {
      if (field.references) return false
      if (field.kind === 'json') return false
      if (key === def.parentFkColumn) return false
      return true
    })
    .map(([key]) => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }))
}

/** Render a generic entity table in Markdown */
function renderEntityTable(entities: EntityRecord[], def: ResolvedEntityDef): string[] {
  if (entities.length === 0) return []
  const cols = entityVisibleFields(def)
  const lines: string[] = [
    '| ' + cols.map((c) => c.label).join(' | ') + ' |',
    '| ' + cols.map(() => '---').join(' | ') + ' |'
  ]
  for (const e of entities) {
    lines.push('| ' + cols.map((c) => escapeForTable(String(e[c.key] ?? ''))).join(' | ') + ' |')
  }
  lines.push('')
  return lines
}

function renderGenericTechnical(data: ReportData): string | null {
  const g = data.generic
  if (!g) return null
  const { schema, primaryEntities, childrenByEntity } = g
  const primaryDef = schema.entities[schema.primaryEntity]

  const lines: string[] = [
    `# ${data.title}`,
    '',
    `**Report Type:** Technical Report  `,
    `**Author:** ${data.author}  `,
    `**Generated:** ${formatDate(data.generatedAt)}  `,
    '',
    '---',
    '',
    '## Statistics',
    '',
    '| Entity Type | Count |',
    '|-------------|-------|',
  ]

  for (const [key, val] of Object.entries(data.stats)) {
    const def = schema.entities[key]
    const label = def ? def.label_plural : key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    lines.push(`| ${label} | ${val} |`)
  }
  lines.push('')

  for (const entity of primaryEntities) {
    const display = entityDisplay(entity, primaryDef)
    const status = entityStatus(entity, primaryDef)
    const category = entityCategory(entity, primaryDef)

    lines.push(`## ${primaryDef.label}: ${display}`, '')
    if (category) lines.push(`**Type:** ${category}  `)
    if (status) lines.push(`**Status:** ${status}  `)
    lines.push('')

    const children = childrenByEntity.get(entity.id) ?? {}
    for (const childType of primaryDef.childTypes) {
      const childDef = schema.entities[childType]
      if (!childDef) continue
      const childEntities = children[childType] ?? []
      if (childEntities.length === 0) continue

      lines.push(`### ${childDef.label_plural} (${childEntities.length})`, '')
      lines.push(...renderEntityTable(childEntities, childDef))
    }

    lines.push('---', '')
  }

  return lines.filter((l) => l !== undefined).join('\n')
}

function renderGenericExecutive(data: ReportData): string | null {
  const g = data.generic
  if (!g) return null
  const { schema, primaryEntities, childrenByEntity } = g
  const primaryDef = schema.entities[schema.primaryEntity]

  const lines: string[] = [
    `# ${data.title}`,
    '',
    `**Report Type:** Executive Summary  `,
    `**Author:** ${data.author}  `,
    `**Generated:** ${formatDate(data.generatedAt)}  `,
    '',
    '---',
    '',
    '## Overview',
    '',
    `This assessment covered **${primaryEntities.length}** ${primaryDef.label_plural.toLowerCase()}.`,
    '',
    '## Statistics',
    '',
    '| Metric | Count |',
    '|--------|-------|',
  ]

  for (const [key, val] of Object.entries(data.stats)) {
    const def = schema.entities[key]
    const label = def ? def.label_plural : key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    lines.push(`| ${label} | ${val} |`)
  }
  lines.push('')

  // Summary table of primary entities
  lines.push(
    `## ${primaryDef.label_plural} Summary`,
    '',
  )

  // Build header from visible fields + child counts
  const visCols = entityVisibleFields(primaryDef).slice(0, 4)
  const childLabels = primaryDef.childTypes
    .map((t) => schema.entities[t]?.label_plural)
    .filter(Boolean) as string[]

  lines.push(
    '| ' + visCols.map((c) => c.label).join(' | ') + (childLabels.length > 0 ? ' | ' + childLabels.join(' | ') : '') + ' |',
    '| ' + visCols.map(() => '---').join(' | ') + (childLabels.length > 0 ? ' | ' + childLabels.map(() => '---').join(' | ') : '') + ' |'
  )

  for (const entity of primaryEntities) {
    const vals = visCols.map((c) => escapeForTable(String(entity[c.key] ?? '')))
    const children = childrenByEntity.get(entity.id) ?? {}
    const childCounts = primaryDef.childTypes.map((t) => String((children[t] ?? []).length))
    lines.push('| ' + vals.join(' | ') + (childCounts.length > 0 ? ' | ' + childCounts.join(' | ') : '') + ' |')
  }
  lines.push('')

  return lines.filter((l) => l !== undefined).join('\n')
}

// ---------------------------------------------------------------------------
// Rendering dispatch
// ---------------------------------------------------------------------------

function renderMarkdown(type: ReportType, data: ReportData): string {
  if (data.generic) {
    const generic = type === 'technical'
      ? renderGenericTechnical(data)
      : type === 'executive'
        ? renderGenericExecutive(data)
        : renderGenericTechnical(data) // vulnerability report uses technical layout generically
    if (generic) return generic
  }

  // No entity schema available — return a minimal report
  const lines: string[] = [
    `# ${data.title}`,
    '',
    `**Report Type:** ${type}  `,
    `**Author:** ${data.author}  `,
    `**Generated:** ${formatDate(data.generatedAt)}  `,
    '',
    '---',
    '',
    '*No entity schema loaded. Unable to generate detailed report.*',
    ''
  ]
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// HTML wrapper
// ---------------------------------------------------------------------------

function wrapHtml(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #111118;
      --border: #1e1e2e;
      --text: #e0e0e8;
      --text-muted: #8888a0;
      --accent: #00ff41;
      --critical: #ff3333;
      --high: #ff6b35;
      --medium: #ffb000;
      --low: #0088ff;
      --info: #737373;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem 3rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    h1 {
      color: var(--accent);
      font-size: 2rem;
      border-bottom: 2px solid var(--accent);
      padding-bottom: 0.5rem;
      margin-bottom: 1rem;
    }
    h2 {
      color: var(--accent);
      font-size: 1.4rem;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.3rem;
    }
    h3 {
      color: var(--text);
      font-size: 1.15rem;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }
    h4 {
      color: var(--text-muted);
      font-size: 1rem;
      margin-top: 1rem;
      margin-bottom: 0.4rem;
    }
    p { margin-bottom: 0.6rem; }
    strong { color: var(--text); }
    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 1.5rem 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    th {
      background: var(--surface);
      color: var(--accent);
      text-align: left;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      font-weight: 600;
    }
    td {
      padding: 0.4rem 0.75rem;
      border: 1px solid var(--border);
      vertical-align: top;
    }
    tr:nth-child(even) { background: var(--surface); }
    code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      background: var(--surface);
      padding: 0.15rem 0.3rem;
      border-radius: 3px;
      font-size: 0.85em;
    }
    pre {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
      margin-bottom: 1rem;
    }
    pre code {
      background: none;
      padding: 0;
    }
    @media print {
      body { background: white; color: #1a1a1a; padding: 1rem; }
      h1, h2 { color: #1a1a1a; border-color: #333; }
      h3, h4 { color: #333; }
      th { background: #f0f0f0; color: #1a1a1a; border-color: #ccc; }
      td { border-color: #ccc; }
      tr:nth-child(even) { background: #f8f8f8; }
      code, pre { background: #f4f4f4; }
      pre { border-color: #ccc; }
      :root {
        --accent: #1a1a1a;
        --border: #ccc;
        --surface: #f8f8f8;
      }
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}

// ---------------------------------------------------------------------------
// PDF generation via hidden BrowserWindow
// ---------------------------------------------------------------------------

async function generatePdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
    webPreferences: {
      offscreen: true
    }
  })

  try {
    // Load HTML content directly
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    // Wait for content to render
    await new Promise((resolve) => setTimeout(resolve, 500))

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      margins: {
        marginType: 'custom',
        top: 0.75,
        bottom: 0.75,
        left: 0.5,
        right: 0.5
      }
    })

    return Buffer.from(pdfBuffer)
  } finally {
    win.destroy()
  }
}

// ---------------------------------------------------------------------------
// Export directory
// ---------------------------------------------------------------------------

function getExportDir(): string {
  return app.getPath('downloads')
}

function buildFilename(title: string, type: ReportType, format: ReportFormat): string {
  const safe = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${safe}_${type}_${timestamp}.${format === 'markdown' ? 'md' : format}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getReportTemplates(): ReportTemplate[] {
  return REPORT_TEMPLATES
}

export function generateReport(req: ReportGenerateRequest): ReportGenerateResponse {
  const data = gatherReportData({
    targetIds: req.targetIds,
    includeScans: req.includeScans,
    title: req.title,
    author: req.author
  })

  const markdown = renderMarkdown(req.type, data)
  const bodyHtml = marked.parse(markdown) as string
  const html = wrapHtml(bodyHtml, data.title)

  return { markdown, html }
}

export async function exportReport(req: ReportExportRequest): Promise<ReportExportResponse> {
  const { markdown, html } = generateReport({
    type: req.type,
    targetIds: req.targetIds,
    includeScans: req.includeScans,
    title: req.title,
    author: req.author
  })

  const dir = getExportDir()
  mkdirSync(dir, { recursive: true })
  const filename = buildFilename(req.title || 'Report', req.type, req.format)
  const filepath = join(dir, filename)

  switch (req.format) {
    case 'markdown':
      writeFileSync(filepath, markdown, 'utf-8')
      break
    case 'html':
      writeFileSync(filepath, html, 'utf-8')
      break
    case 'pdf': {
      const pdfBuffer = await generatePdf(html)
      writeFileSync(filepath, pdfBuffer)
      break
    }
  }

  return { path: filepath, format: req.format }
}
