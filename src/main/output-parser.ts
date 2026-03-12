/**
 * Output parser engine — parses raw tool output into structured entities
 * using module-defined parsing rules (XML, JSON, JSONL, CSV, regex, greppable, raw).
 *
 * This module is domain-agnostic. All parsing configuration comes from
 * the module YAML's `output` block. The engine applies generic parsing
 * strategies based on output type and entity extraction rules.
 */

import { readFileSync } from 'fs'
import { XMLParser } from 'fast-xml-parser'
import type { ModuleOutput, OutputPattern } from '@shared/types/module'
import type { ParsedResults } from '@shared/types/results'
import type { ServiceProtocol, ServiceState } from '@shared/types/target'
import { extractEntities, type ExtractedEntity } from './entity-extractor'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse raw tool output using the module's output configuration.
 *
 * @param rawOutput - The raw stdout/stderr text from the tool
 * @param moduleOutput - The module's `output` block from YAML
 * @param outputFilePath - Optional path to a file the tool wrote (for file_output)
 * @returns Parsed results with extracted entities
 */
export function parseOutput(
  rawOutput: string,
  moduleOutput: ModuleOutput,
  outputFilePath?: string
): ParsedResults {
  const results: ParsedResults = {
    entities: {
      hosts: [],
      services: [],
      vulnerabilities: [],
      credentials: [],
      webPaths: [],
      findings: []
    },
    raw: rawOutput,
    summary: ''
  }

  // If the tool writes to a file, read from that instead
  let textToParse = rawOutput
  if (moduleOutput.file_output && outputFilePath) {
    try {
      textToParse = readFileSync(outputFilePath, { encoding: (moduleOutput.encoding || 'utf-8') as BufferEncoding })
    } catch {
      // Fall back to raw output if file read fails
    }
  }

  if (!textToParse || textToParse.trim().length === 0) {
    results.summary = 'No output to parse'
    return results
  }

  // Dispatch to the appropriate parser based on output type
  switch (moduleOutput.type) {
    case 'xml':
      parseXml(textToParse, moduleOutput, results)
      break
    case 'json':
      parseJson(textToParse, moduleOutput, results)
      break
    case 'jsonl':
      parseJsonl(textToParse, moduleOutput, results)
      break
    case 'csv':
      parseCsv(textToParse, moduleOutput, results)
      break
    case 'regex':
      parseRegex(textToParse, moduleOutput, results)
      break
    case 'greppable':
      parseGreppable(textToParse, results)
      break
    case 'raw':
    default:
      // No structured parsing — just extract entities from raw text
      break
  }

  // Always run entity extraction on raw output for enrichment
  const extracted = extractEntities(rawOutput)
  mergeExtractedEntities(extracted, results)

  // Generate summary
  results.summary = buildSummary(results)

  return results
}

// ---------------------------------------------------------------------------
// XML Parser (for nmap XML, etc.)
// ---------------------------------------------------------------------------

function parseXml(text: string, config: ModuleOutput, results: ParsedResults): void {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: true,
    trimValues: true
  })

  let doc: Record<string, unknown>
  try {
    doc = parser.parse(text)
  } catch {
    return // Invalid XML, skip parsing
  }

  if (!config.entities) return

  for (const entityDef of config.entities) {
    const nodes = evaluateXPath(doc, entityDef.extract)
    for (const node of nodes) {
      const fields = extractFields(node, entityDef.fields, 'xpath')
      addEntityToResults(entityDef.type, fields, results)
    }
  }
}

/**
 * Simplified XPath-like evaluator for fast-xml-parser output.
 * Supports: //element, //parent/child, attribute access via @_attr
 */
function evaluateXPath(doc: unknown, xpath: string): unknown[] {
  // Strip leading // and split path
  const path = xpath.replace(/^\/\//, '')
  const segments = path.split('/')

  return findNodes(doc, segments, 0)
}

function findNodes(node: unknown, segments: string[], depth: number): unknown[] {
  if (node === null || node === undefined) return []
  if (depth >= segments.length) return [node]

  const segment = segments[depth]
  const results: unknown[] = []

  if (typeof node === 'object' && node !== null) {
    const obj = node as Record<string, unknown>

    // Check if this node has the target element
    if (segment in obj) {
      const child = obj[segment]
      if (Array.isArray(child)) {
        for (const item of child) {
          results.push(...findNodes(item, segments, depth + 1))
        }
      } else {
        results.push(...findNodes(child, segments, depth + 1))
      }
    }

    // Recurse into all child objects for // semantics (depth-first search)
    if (depth === 0) {
      for (const [key, val] of Object.entries(obj)) {
        if (key === segment) continue // Already handled above
        if (typeof val === 'object' && val !== null) {
          if (Array.isArray(val)) {
            for (const item of val) {
              results.push(...findNodes(item, segments, depth))
            }
          } else {
            results.push(...findNodes(val, segments, depth))
          }
        }
      }
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// JSON Parser
// ---------------------------------------------------------------------------

function parseJson(text: string, config: ModuleOutput, results: ParsedResults): void {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return // Invalid JSON, skip
  }

  if (!config.entities) return

  for (const entityDef of config.entities) {
    const nodes = evaluateJsonPath(data, entityDef.extract)
    for (const node of nodes) {
      const fields = extractFields(node, entityDef.fields, 'jsonpath')
      addEntityToResults(entityDef.type, fields, results)
    }
  }
}

// ---------------------------------------------------------------------------
// JSONL Parser (JSON Lines — one JSON object per line)
// ---------------------------------------------------------------------------

function parseJsonl(text: string, config: ModuleOutput, results: ParsedResults): void {
  if (!config.entities) return

  const lines = text.split('\n').filter((l) => l.trim().length > 0)

  for (const line of lines) {
    let data: unknown
    try {
      data = JSON.parse(line)
    } catch {
      continue // Skip invalid lines
    }

    for (const entityDef of config.entities) {
      // For JSONL, if extract is "$" or empty, the whole line is the entity
      if (entityDef.extract === '$' || !entityDef.extract) {
        const fields = extractFields(data, entityDef.fields, 'jsonpath')
        addEntityToResults(entityDef.type, fields, results)
      } else {
        const nodes = evaluateJsonPath(data, entityDef.extract)
        for (const node of nodes) {
          const fields = extractFields(node, entityDef.fields, 'jsonpath')
          addEntityToResults(entityDef.type, fields, results)
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

function parseCsv(text: string, config: ModuleOutput, results: ParsedResults): void {
  if (!config.entities) return

  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return

  // First line is header
  const headers = parseCsvLine(lines[0])

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const row: Record<string, string> = {}

    for (let j = 0; j < headers.length && j < values.length; j++) {
      row[headers[j]] = values[j]
    }

    for (const entityDef of config.entities) {
      const fields = extractFields(row, entityDef.fields, 'csv')
      if (hasNonEmptyField(fields)) {
        addEntityToResults(entityDef.type, fields, results)
      }
    }
  }
}

/** Parse a single CSV line, handling quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

// ---------------------------------------------------------------------------
// Regex Parser
// ---------------------------------------------------------------------------

function parseRegex(text: string, config: ModuleOutput, results: ParsedResults): void {
  if (!config.patterns) return

  for (const pattern of config.patterns) {
    applyRegexPattern(text, pattern, results)
  }
}

function applyRegexPattern(text: string, pattern: OutputPattern, results: ParsedResults): void {
  // Convert Python-style named groups (?P<name>...) to JS-style (?<name>...)
  const jsPattern = pattern.pattern.replace(/\(\?P</g, '(?<')

  // Build flags
  const flags = pattern.flags || 'gm'
  let regex: RegExp
  try {
    regex = new RegExp(jsPattern, flags)
  } catch {
    console.warn(`Invalid regex pattern "${pattern.name}": ${pattern.pattern}`)
    return
  }

  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (!match.groups) continue

    const fields: Record<string, string> = {}
    for (const [fieldName, fieldExpr] of Object.entries(pattern.fields)) {
      fields[fieldName] = resolveFieldExpression(fieldExpr, match.groups)
    }

    addEntityToResults(pattern.entity_type, fields, results)

    // Prevent infinite loops on zero-length matches
    if (match[0].length === 0) regex.lastIndex++
  }
}

// ---------------------------------------------------------------------------
// Greppable Parser (nmap -oG format)
// ---------------------------------------------------------------------------

function parseGreppable(text: string, results: ParsedResults): void {
  const lines = text.split('\n')

  for (const line of lines) {
    // Skip comments and status lines
    if (line.startsWith('#') || !line.includes('Ports:')) continue

    // Format: Host: <ip> (<hostname>)\tPorts: <port>/<state>/<proto>/<ignored>/<service>/<product>/<extrainfo>/
    const hostMatch = line.match(/Host:\s+(\S+)\s*(?:\(([^)]*)\))?/)
    const portsSection = line.match(/Ports:\s+(.+?)(?:\t|$)/)

    if (!hostMatch) continue

    if (portsSection) {
      const portEntries = portsSection[1].split(',')
      for (const entry of portEntries) {
        const parts = entry.trim().split('/')
        if (parts.length < 7) continue

        const [portStr, state, protocol, , serviceName, product, version] = parts
        const port = parseInt(portStr, 10)

        if (isNaN(port) || state !== 'open') continue

        addEntityToResults('service', {
          port: String(port),
          protocol: protocol || 'tcp',
          state: state,
          service_name: serviceName || undefined,
          product: product || undefined,
          service_version: version || undefined
        }, results)
      }
    }

    // Check for OS info
    const osMatch = line.match(/OS:\s+(.+?)(?:\t|$)/)
    if (osMatch) {
      addEntityToResults('os', { os_guess: osMatch[1] }, results)
    }
  }
}

// ---------------------------------------------------------------------------
// JSONPath evaluator (simplified)
// ---------------------------------------------------------------------------

/**
 * Evaluate a simplified JSONPath expression against data.
 * Supports: $.key, $.key[*], $.key.nested, $.key[0]
 */
function evaluateJsonPath(data: unknown, path: string): unknown[] {
  if (!path || path === '$') return [data]

  // Remove leading $. if present
  const normalizedPath = path.replace(/^\$\.?/, '')
  if (!normalizedPath) return [data]

  const segments = parseJsonPathSegments(normalizedPath)
  return resolveJsonPath(data, segments)
}

function parseJsonPathSegments(path: string): string[] {
  const segments: string[] = []
  let current = ''

  for (let i = 0; i < path.length; i++) {
    const ch = path[i]
    if (ch === '.') {
      if (current) segments.push(current)
      current = ''
    } else if (ch === '[') {
      if (current) segments.push(current)
      current = ''
      // Find closing bracket
      const end = path.indexOf(']', i)
      if (end === -1) break
      segments.push(path.slice(i, end + 1))
      i = end
    } else {
      current += ch
    }
  }
  if (current) segments.push(current)
  return segments
}

function resolveJsonPath(data: unknown, segments: string[]): unknown[] {
  if (segments.length === 0) return data === undefined ? [] : [data]
  if (data === null || data === undefined) return []

  const [segment, ...rest] = segments

  // Array wildcard: [*]
  if (segment === '[*]') {
    if (!Array.isArray(data)) return []
    const results: unknown[] = []
    for (const item of data) {
      results.push(...resolveJsonPath(item, rest))
    }
    return results
  }

  // Array index: [0], [1], etc.
  const indexMatch = segment.match(/^\[(\d+)\]$/)
  if (indexMatch) {
    if (!Array.isArray(data)) return []
    const idx = parseInt(indexMatch[1], 10)
    if (idx >= data.length) return []
    return resolveJsonPath(data[idx], rest)
  }

  // Object key
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>
    const value = obj[segment]
    if (value === undefined) return []
    return resolveJsonPath(value, rest)
  }

  return []
}

// ---------------------------------------------------------------------------
// Field extraction helpers
// ---------------------------------------------------------------------------

type ExtractionMode = 'xpath' | 'jsonpath' | 'csv'

/**
 * Extract field values from a node using the field mapping definitions.
 */
function extractFields(
  node: unknown,
  fieldDefs: Record<string, string>,
  mode: ExtractionMode
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}

  for (const [fieldName, expression] of Object.entries(fieldDefs)) {
    result[fieldName] = resolveFieldFromNode(node, expression, mode)
  }

  return result
}

function resolveFieldFromNode(
  node: unknown,
  expression: string,
  mode: ExtractionMode
): string | undefined {
  // Literal value: "'some value'"
  if (expression.startsWith("'") && expression.endsWith("'")) {
    return expression.slice(1, -1)
  }

  if (mode === 'xpath') {
    return resolveXpathField(node, expression)
  }

  if (mode === 'jsonpath' || mode === 'csv') {
    return resolveJsonField(node, expression)
  }

  return undefined
}

/**
 * Resolve an XPath-like field expression against a fast-xml-parser node.
 * Supports: @attr (maps to @_attr), child/@attr, child/text
 */
function resolveXpathField(node: unknown, expression: string): string | undefined {
  if (node === null || node === undefined) return undefined

  const parts = expression.split('/')
  let current: unknown = node

  for (const part of parts) {
    if (current === null || current === undefined) return undefined

    if (part.startsWith('@')) {
      // Attribute access — fast-xml-parser stores attributes as @_attrname
      const attrName = `@_${part.slice(1)}`
      if (typeof current === 'object' && current !== null) {
        const val = (current as Record<string, unknown>)[attrName]
        return val !== undefined && val !== null ? String(val) : undefined
      }
      return undefined
    }

    // Navigate to child element
    if (typeof current === 'object' && current !== null) {
      const obj = current as Record<string, unknown>
      current = obj[part]
      // If the child is an array, take the first element
      if (Array.isArray(current)) {
        current = current[0]
      }
    } else {
      return undefined
    }
  }

  // If we ended up at a primitive, return its string value
  if (current !== null && current !== undefined && typeof current !== 'object') {
    return String(current)
  }

  // If it's an object with a text value (#text from fast-xml-parser)
  if (typeof current === 'object' && current !== null) {
    const obj = current as Record<string, unknown>
    if ('#text' in obj) return String(obj['#text'])
  }

  return undefined
}

/**
 * Resolve a JSON field path (dot notation with optional array index).
 * Supports: "key", "nested.key", "arr[0].key"
 */
function resolveJsonField(node: unknown, expression: string): string | undefined {
  if (node === null || node === undefined) return undefined

  const segments = parseJsonPathSegments(expression)
  let current: unknown = node

  for (const seg of segments) {
    if (current === null || current === undefined) return undefined

    const indexMatch = seg.match(/^\[(\d+)\]$/)
    if (indexMatch) {
      if (!Array.isArray(current)) return undefined
      current = current[parseInt(indexMatch[1], 10)]
      continue
    }

    if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[seg]
    } else {
      return undefined
    }
  }

  if (current === null || current === undefined) return undefined
  return typeof current === 'object' ? JSON.stringify(current) : String(current)
}

// ---------------------------------------------------------------------------
// Regex field resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a field expression using regex named group matches.
 *
 * Supports:
 * - Direct group reference: "username" → match.groups.username
 * - Literal value: "'some text'" → "some text"
 * - Template interpolation: "'DNS ${name} -> ${ip}'" → "DNS example.com -> 1.2.3.4"
 */
function resolveFieldExpression(
  expression: string,
  groups: Record<string, string>
): string {
  // Literal with potential template interpolation
  if (expression.startsWith("'") && expression.endsWith("'")) {
    const literal = expression.slice(1, -1)
    // Replace ${var} references with group values
    return literal.replace(/\$\{(\w+)\}/g, (_, name) => groups[name] ?? '')
  }

  // Direct named group reference
  return groups[expression] ?? ''
}

// ---------------------------------------------------------------------------
// Entity → Results mapping
// ---------------------------------------------------------------------------

function addEntityToResults(
  entityType: string,
  fields: Record<string, string | undefined>,
  results: ParsedResults
): void {
  switch (entityType) {
    case 'service': {
      const port = parseInt(fields.port ?? '0', 10)
      if (port <= 0 || port > 65535) break
      results.entities.services.push({
        id: 0, // placeholder — DB assigns real ID
        target_id: 0,
        port,
        protocol: (fields.protocol || 'tcp') as ServiceProtocol,
        state: (fields.state || 'open') as ServiceState,
        service_name: fields.service_name || null,
        product: fields.product || null,
        service_version: fields.service_version || null,
        banner: fields.banner || null,
        tunnel: fields.tunnel || null,
        confidence: parseInt(fields.confidence ?? '0', 10) || 0,
        discovered_by: '',
        created_at: ''
      })
      break
    }

    case 'vulnerability': {
      const title = fields.title
      if (!title) break
      results.entities.vulnerabilities.push({
        id: 0,
        target_id: 0,
        service_id: null,
        title,
        severity: normalizeSeverity(fields.severity),
        cve: fields.cve || null,
        description: fields.description || null,
        evidence: fields.evidence || null,
        explanation: null,
        remediation: fields.remediation || null,
        discovered_by: '',
        created_at: ''
      })
      break
    }

    case 'credential': {
      const username = fields.username
      if (!username) break
      results.entities.credentials.push({
        id: 0,
        target_id: 0,
        service_id: null,
        username,
        password: fields.password || null,
        hash: fields.hash || null,
        hash_type: fields.hash_type || null,
        status: 'found',
        source: '',
        created_at: ''
      })
      break
    }

    case 'web_path': {
      const path = fields.path
      if (!path) break
      results.entities.webPaths.push({
        id: 0,
        target_id: 0,
        path,
        status_code: parseInt(fields.status_code ?? '0', 10) || 0,
        content_length: fields.content_length ? parseInt(fields.content_length, 10) : null,
        title: fields.title || null,
        redirect_url: fields.redirect_url || null,
        discovered_by: '',
        created_at: ''
      })
      break
    }

    case 'finding':
    case 'dns_record': {
      const title = fields.title
      if (!title) break
      results.entities.findings.push({
        id: 0,
        target_id: 0,
        scan_id: null,
        type: entityType === 'dns_record' ? 'dns' : (fields.type || 'generic'),
        title,
        description: fields.description || null,
        severity: normalizeSeverity(fields.severity),
        data: fields.data || null,
        created_at: ''
      })
      break
    }

    case 'host': {
      // Host entities are noted but not auto-created here (handled by the
      // integration layer which has access to the target context)
      break
    }

    case 'os': {
      // OS guesses are stored as findings for now and applied to the target
      // by the integration layer
      if (fields.os_guess) {
        results.entities.findings.push({
          id: 0,
          target_id: 0,
          scan_id: null,
          type: 'os_detection',
          title: `OS Detection: ${fields.os_guess}`,
          description: fields.os_guess,
          severity: 'info',
          data: JSON.stringify({ os_guess: fields.os_guess }),
          created_at: ''
        })
      }
      break
    }
  }
}

function normalizeSeverity(s: string | undefined): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  if (!s) return 'info'
  const lower = s.toLowerCase()
  if (lower === 'critical' || lower === 'crit') return 'critical'
  if (lower === 'high') return 'high'
  if (lower === 'medium' || lower === 'med') return 'medium'
  if (lower === 'low') return 'low'
  return 'info'
}

// ---------------------------------------------------------------------------
// Merge extracted entities (from entity-extractor) into results
// ---------------------------------------------------------------------------

function mergeExtractedEntities(entities: ExtractedEntity[], results: ParsedResults): void {
  // We only add IP-based host findings and CVE findings from raw extraction
  // Services and other structured entities come from the module parser
  for (const entity of entities) {
    if (entity.type === 'cve') {
      // Check if this CVE is already captured by structured parsing
      const exists = results.entities.vulnerabilities.some(
        (v) => v.cve?.toLowerCase() === entity.value.toLowerCase()
      )
      if (!exists) {
        results.entities.findings.push({
          id: 0,
          target_id: 0,
          scan_id: null,
          type: 'cve_reference',
          title: entity.value,
          description: `CVE reference found in output: ${entity.value}`,
          severity: 'info',
          data: null,
          created_at: ''
        })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(results: ParsedResults): string {
  const parts: string[] = []
  const { services, vulnerabilities, credentials, webPaths, findings } = results.entities

  if (services.length > 0) {
    parts.push(`${services.length} service(s)`)
  }
  if (vulnerabilities.length > 0) {
    parts.push(`${vulnerabilities.length} vulnerability(ies)`)
  }
  if (credentials.length > 0) {
    parts.push(`${credentials.length} credential(s)`)
  }
  if (webPaths.length > 0) {
    parts.push(`${webPaths.length} web path(s)`)
  }
  if (findings.length > 0) {
    parts.push(`${findings.length} finding(s)`)
  }

  if (parts.length === 0) return 'No structured data extracted'
  return `Found: ${parts.join(', ')}`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasNonEmptyField(fields: Record<string, string | undefined>): boolean {
  return Object.values(fields).some((v) => v !== undefined && v !== '')
}
