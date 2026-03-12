/**
 * Report engine — generates Markdown, HTML, and PDF reports from workspace data.
 *
 * Gathers targets, services, vulnerabilities, credentials, scans, and findings
 * from the active workspace database and renders them into structured reports
 * using a template system. Three report types are supported:
 *   - Executive Summary: high-level overview for stakeholders
 *   - Technical: detailed findings for technical reviewers
 *   - Vulnerability: focused list of all discovered vulnerabilities
 *
 * PDF generation uses Electron's built-in printToPDF on a hidden BrowserWindow.
 */

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { marked } from 'marked'
import { getDatabase } from './workspace-manager'
import type { Target, Service } from '@shared/types/target'
import type { Vulnerability, Credential, WebPath, Finding, Severity } from '@shared/types/results'
import type { Scan } from '@shared/types/scan'
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
  stats: {
    targets: number
    services: number
    vulnerabilities: number
    credentials: number
    scans: number
    findings: number
    webPaths: number
  }
  targets: TargetReportData[]
}

interface TargetReportData {
  target: Target
  services: Service[]
  vulnerabilities: Vulnerability[]
  credentials: Credential[]
  webPaths: WebPath[]
  findings: Finding[]
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
  includeCredentials?: boolean
  includeWebPaths?: boolean
  title?: string
  author?: string
}): ReportData {
  const db = getDatabase()
  const allStats = db.stats()

  // Get targets — either specific ones or all
  let targets: Target[]
  if (opts.targetIds && opts.targetIds.length > 0) {
    targets = opts.targetIds
      .map((id) => db.getTarget(id))
      .filter((t): t is Target => t !== undefined)
  } else {
    targets = db.listTargets()
  }

  const targetData: TargetReportData[] = targets.map((target) => ({
    target,
    services: db.listServices(target.id),
    vulnerabilities: db.listVulnerabilities(target.id),
    credentials: opts.includeCredentials !== false ? db.listCredentials(target.id) : [],
    webPaths: opts.includeWebPaths !== false ? db.listWebPaths(target.id) : [],
    findings: db.listFindings(target.id),
    scans: opts.includeScans !== false ? db.listScans({ targetId: target.id }) : []
  }))

  return {
    title: opts.title || 'Assessment Report',
    author: opts.author || 'Security Team',
    generatedAt: new Date().toISOString(),
    stats: allStats,
    targets: targetData
  }
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4
}

function sortBySeverity<T extends { severity: Severity }>(items: T[]): T[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

function countBySeverity(vulns: Vulnerability[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const v of vulns) {
    if (v.severity in counts) counts[v.severity]++
  }
  return counts
}

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
// Markdown templates
// ---------------------------------------------------------------------------

function renderExecutiveSummary(data: ReportData): string {
  const allVulns = data.targets.flatMap((t) => t.vulnerabilities)
  const severity = countBySeverity(allVulns)
  const allCreds = data.targets.flatMap((t) => t.credentials)
  const criticalFindings = allVulns.filter((v) => v.severity === 'critical' || v.severity === 'high')

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
    `This assessment covered **${data.targets.length}** target(s) and discovered ` +
      `**${allVulns.length}** vulnerabilities across **${data.stats.services}** services.`,
    '',
    '## Severity Distribution',
    '',
    '| Severity | Count |',
    '|----------|-------|',
    `| Critical | ${severity.critical} |`,
    `| High | ${severity.high} |`,
    `| Medium | ${severity.medium} |`,
    `| Low | ${severity.low} |`,
    `| Informational | ${severity.info} |`,
    ''
  ]

  if (criticalFindings.length > 0) {
    lines.push('## Critical and High Severity Findings', '')
    for (const v of sortBySeverity(criticalFindings)) {
      const target = data.targets.find((t) => t.target.id === v.target_id)
      lines.push(
        `### [${v.severity.toUpperCase()}] ${v.title}`,
        '',
        `**Target:** ${target?.target.value || 'Unknown'}  `,
        v.cve ? `**CVE:** ${v.cve}  ` : '',
        v.description ? `**Description:** ${v.description}` : '',
        ''
      )
      if (v.remediation) {
        lines.push(`**Remediation:** ${v.remediation}`, '')
      }
    }
  }

  if (allCreds.length > 0) {
    lines.push(
      '## Credentials Discovered',
      '',
      `A total of **${allCreds.length}** credential(s) were discovered during the assessment.`,
      ''
    )
  }

  lines.push(
    '## Targets Summary',
    '',
    '| Target | Type | Services | Vulnerabilities | Status |',
    '|--------|------|----------|-----------------|--------|'
  )
  for (const td of data.targets) {
    lines.push(
      `| ${escapeForTable(td.target.value)} | ${td.target.type} | ${td.services.length} | ${td.vulnerabilities.length} | ${td.target.status} |`
    )
  }
  lines.push('')

  return lines.filter((l) => l !== undefined).join('\n')
}

function renderTechnicalReport(data: ReportData): string {
  const lines: string[] = [
    `# ${data.title}`,
    '',
    `**Report Type:** Technical Report  `,
    `**Author:** ${data.author}  `,
    `**Generated:** ${formatDate(data.generatedAt)}  `,
    '',
    '---',
    '',
    '## Project Statistics',
    '',
    '| Metric | Count |',
    '|--------|-------|',
    `| Targets | ${data.stats.targets} |`,
    `| Services | ${data.stats.services} |`,
    `| Vulnerabilities | ${data.stats.vulnerabilities} |`,
    `| Credentials | ${data.stats.credentials} |`,
    `| Web Paths | ${data.stats.webPaths} |`,
    `| Findings | ${data.stats.findings} |`,
    `| Scans | ${data.stats.scans} |`,
    ''
  ]

  for (const td of data.targets) {
    lines.push(
      `## Target: ${td.target.value}`,
      '',
      `**Type:** ${td.target.type}  `,
      `**Status:** ${td.target.status}  `,
      td.target.os_guess ? `**OS:** ${td.target.os_guess}  ` : '',
      td.target.label ? `**Label:** ${td.target.label}  ` : '',
      ''
    )

    // Services
    if (td.services.length > 0) {
      lines.push(
        '### Services',
        '',
        '| Port | Protocol | State | Service | Product | Version |',
        '|------|----------|-------|---------|---------|---------|'
      )
      for (const s of td.services) {
        lines.push(
          `| ${s.port} | ${s.protocol} | ${s.state} | ${escapeForTable(s.service_name)} | ${escapeForTable(s.product)} | ${escapeForTable(s.service_version)} |`
        )
      }
      lines.push('')
    }

    // Vulnerabilities
    if (td.vulnerabilities.length > 0) {
      lines.push('### Vulnerabilities', '')
      for (const v of sortBySeverity(td.vulnerabilities)) {
        lines.push(
          `#### [${v.severity.toUpperCase()}] ${v.title}`,
          '',
          v.cve ? `**CVE:** ${v.cve}  ` : '',
          v.description ? `${v.description}` : '',
          ''
        )
        if (v.evidence) {
          lines.push('**Evidence:**', '', '```', v.evidence, '```', '')
        }
        if (v.explanation) {
          lines.push(`**Explanation:** ${v.explanation}`, '')
        }
        if (v.remediation) {
          lines.push(`**Remediation:** ${v.remediation}`, '')
        }
      }
    }

    // Credentials
    if (td.credentials.length > 0) {
      lines.push(
        '### Credentials',
        '',
        '| Username | Password/Hash | Status | Source |',
        '|----------|---------------|--------|--------|'
      )
      for (const c of td.credentials) {
        const secret = c.password
          ? escapeForTable(c.password)
          : c.hash
            ? `[${c.hash_type || 'hash'}]`
            : 'N/A'
        lines.push(
          `| ${escapeForTable(c.username)} | ${secret} | ${c.status} | ${escapeForTable(c.source)} |`
        )
      }
      lines.push('')
    }

    // Web paths
    if (td.webPaths.length > 0) {
      lines.push(
        '### Discovered Web Paths',
        '',
        '| Path | Status | Size | Title |',
        '|------|--------|------|-------|'
      )
      for (const wp of td.webPaths) {
        lines.push(
          `| ${escapeForTable(wp.path)} | ${wp.status_code} | ${wp.content_length ?? ''} | ${escapeForTable(wp.title)} |`
        )
      }
      lines.push('')
    }

    // Findings
    if (td.findings.length > 0) {
      lines.push(
        '### Additional Findings',
        '',
        '| Type | Title | Severity | Description |',
        '|------|-------|----------|-------------|'
      )
      for (const f of sortBySeverity(td.findings)) {
        lines.push(
          `| ${escapeForTable(f.type)} | ${escapeForTable(f.title)} | ${f.severity} | ${escapeForTable(f.description)} |`
        )
      }
      lines.push('')
    }

    // Scan history
    if (td.scans.length > 0) {
      lines.push(
        '### Scan History',
        '',
        '| Tool | Command | Status | Duration | Date |',
        '|------|---------|--------|----------|------|'
      )
      for (const s of td.scans) {
        const cmd = s.command.length > 60 ? s.command.slice(0, 57) + '...' : s.command
        const dur = s.duration_ms ? `${(s.duration_ms / 1000).toFixed(1)}s` : 'N/A'
        lines.push(
          `| ${escapeForTable(s.tool_id)} | \`${escapeForTable(cmd)}\` | ${s.status} | ${dur} | ${formatDate(s.created_at)} |`
        )
      }
      lines.push('')
    }

    lines.push('---', '')
  }

  return lines.filter((l) => l !== undefined).join('\n')
}

function renderVulnerabilityReport(data: ReportData): string {
  const allVulns = data.targets.flatMap((td) =>
    td.vulnerabilities.map((v) => ({ ...v, targetValue: td.target.value }))
  )
  const sorted = sortBySeverity(allVulns)
  const severity = countBySeverity(allVulns)

  const lines: string[] = [
    `# ${data.title}`,
    '',
    `**Report Type:** Vulnerability Report  `,
    `**Author:** ${data.author}  `,
    `**Generated:** ${formatDate(data.generatedAt)}  `,
    '',
    '---',
    '',
    '## Summary',
    '',
    `Total vulnerabilities: **${allVulns.length}**`,
    '',
    '| Severity | Count |',
    '|----------|-------|',
    `| Critical | ${severity.critical} |`,
    `| High | ${severity.high} |`,
    `| Medium | ${severity.medium} |`,
    `| Low | ${severity.low} |`,
    `| Informational | ${severity.info} |`,
    '',
    '---',
    ''
  ]

  if (sorted.length === 0) {
    lines.push('*No vulnerabilities discovered.*', '')
    return lines.join('\n')
  }

  // Group by severity
  const severities: Severity[] = ['critical', 'high', 'medium', 'low', 'info']
  for (const sev of severities) {
    const group = sorted.filter((v) => v.severity === sev)
    if (group.length === 0) continue

    lines.push(`## ${sev.charAt(0).toUpperCase() + sev.slice(1)} (${group.length})`, '')

    for (const v of group) {
      lines.push(
        `### ${v.title}`,
        '',
        `**Target:** ${v.targetValue}  `,
        v.cve ? `**CVE:** ${v.cve}  ` : '',
        `**Severity:** ${v.severity.toUpperCase()}  `,
        v.discovered_by ? `**Discovered By:** ${v.discovered_by}  ` : '',
        v.description ? `\n${v.description}` : '',
        ''
      )
      if (v.evidence) {
        lines.push('**Evidence:**', '', '```', v.evidence, '```', '')
      }
      if (v.explanation) {
        lines.push(`**Explanation:** ${v.explanation}`, '')
      }
      if (v.remediation) {
        lines.push(`**Remediation:** ${v.remediation}`, '')
      }
    }
  }

  return lines.filter((l) => l !== undefined).join('\n')
}

// ---------------------------------------------------------------------------
// Rendering dispatch
// ---------------------------------------------------------------------------

function renderMarkdown(type: ReportType, data: ReportData): string {
  switch (type) {
    case 'executive':
      return renderExecutiveSummary(data)
    case 'technical':
      return renderTechnicalReport(data)
    case 'vulnerability':
      return renderVulnerabilityReport(data)
  }
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
    includeCredentials: req.includeCredentials,
    includeWebPaths: req.includeWebPaths,
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
    includeCredentials: req.includeCredentials,
    includeWebPaths: req.includeWebPaths,
    title: req.title,
    author: req.author
  })

  const dir = getExportDir()
  mkdirSync(dir, { recursive: true })
  const filename = buildFilename(req.title || 'Assessment_Report', req.type, req.format)
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
