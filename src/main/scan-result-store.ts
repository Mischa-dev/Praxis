/**
 * Scan result store — bridges the output parser with the database.
 *
 * After a scan completes, this module reads the raw output, runs the
 * module's output parser, and stores extracted entities in the database.
 * It also updates the scan record with the parsed results JSON.
 */

import { readFileSync } from 'fs'
import { parseOutput } from './output-parser'
import { getModule } from './module-loader'
import { getDatabase } from './workspace-manager'
import type { ParsedResults } from '@shared/types/results'
import type { Scan } from '@shared/types/scan'

/**
 * Parse a completed scan's output and store results in the database.
 *
 * Called by the process manager after a tool process exits successfully.
 * Reads the raw output file, applies the module's parser, and inserts
 * extracted entities into the appropriate database tables.
 *
 * @param scanId - The scan ID to parse results for
 */
export async function parseAndStoreScanResults(scanId: number): Promise<void> {
  const db = getDatabase()
  const scan = db.getScan(scanId)
  if (!scan) return

  // Only parse completed scans
  if (scan.status !== 'completed') return

  // Look up the module for parser configuration
  const mod = await getModule(scan.tool_id)
  if (!mod) return

  // Skip raw output type — nothing to structurally parse
  if (mod.output.type === 'raw') return

  // Read the raw output
  const rawOutput = readRawOutput(scan)
  if (!rawOutput) return

  // Determine the file output path if the tool wrote to a file
  const fileOutputPath = resolveFileOutputPath(mod.output.file_output, scan)

  // Parse the output
  let parsed: ParsedResults
  try {
    parsed = parseOutput(rawOutput, mod.output, fileOutputPath)
  } catch (err) {
    console.error(`Failed to parse output for scan ${scanId}:`, err)
    return
  }

  // Store extracted entities in the database
  storeEntities(scan, parsed, mod.id)

  // Update the scan record with parsed results JSON
  try {
    db.updateScan(scanId, {
      parsed_results: JSON.stringify(parsed)
    })
  } catch (err) {
    console.error(`Failed to store parsed results for scan ${scanId}:`, err)
  }
}

/**
 * Get parsed results for a scan. Reads from the database's parsed_results
 * JSON field. If not yet parsed, attempts to parse on-demand.
 */
export async function getScanParsedResults(scanId: number): Promise<ParsedResults | null> {
  const db = getDatabase()
  const scan = db.getScan(scanId)
  if (!scan) return null

  // If already parsed, return from database
  if (scan.parsed_results) {
    try {
      return JSON.parse(scan.parsed_results) as ParsedResults
    } catch {
      // Corrupted JSON — re-parse below
    }
  }

  // Attempt on-demand parsing for completed scans
  if (scan.status === 'completed') {
    await parseAndStoreScanResults(scanId)
    const updated = db.getScan(scanId)
    if (updated?.parsed_results) {
      try {
        return JSON.parse(updated.parsed_results) as ParsedResults
      } catch {
        return null
      }
    }
  }

  // Return minimal results with just raw output for non-completed scans
  const rawOutput = readRawOutput(scan)
  return {
    entities: {
      hosts: [],
      services: [],
      vulnerabilities: [],
      credentials: [],
      webPaths: [],
      findings: []
    },
    entityRecords: {},
    raw: rawOutput || '',
    summary: scan.status === 'running' ? 'Scan in progress...' : 'No results available'
  }
}

// ---------------------------------------------------------------------------
// Internal — read raw output
// ---------------------------------------------------------------------------

function readRawOutput(scan: Scan): string | null {
  if (!scan.raw_output_path) return null
  try {
    return readFileSync(scan.raw_output_path, 'utf-8')
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Internal — resolve file output path templates
// ---------------------------------------------------------------------------

function resolveFileOutputPath(
  template: string | undefined,
  scan: Scan
): string | undefined {
  if (!template) return undefined
  const resolved = template
    .replace(/\{scanId\}/g, String(scan.id))
    .replace(/\{targetValue\}/g, '')
    .replace(/\{timestamp\}/g, new Date().toISOString().replace(/[:.]/g, '-'))

  // Guard against path traversal — reject paths containing ..
  if (resolved.includes('..')) {
    console.warn(`Rejected file_output path with traversal: ${resolved}`)
    return undefined
  }
  return resolved
}

// ---------------------------------------------------------------------------
// Internal — store extracted entities in database
// ---------------------------------------------------------------------------

function storeEntities(scan: Scan, parsed: ParsedResults, toolId: string): void {
  const db = getDatabase()
  const targetId = scan.target_id

  // Can't store entities without a target
  if (!targetId) return

  // Generic entity storage requires the entity schema
  const schema = db.getEntitySchema()
  if (!schema) {
    console.warn('Entity schema not loaded — cannot store parsed entities from scan', scan.id)
    return
  }

  storeEntitiesGeneric(db, schema, scan, parsed, toolId, targetId)
}

/** Generic entity storage using schema-driven CRUD */
function storeEntitiesGeneric(
  db: import('./database').WorkspaceDatabase,
  schema: import('@shared/types/entity').ResolvedSchema,
  scan: Scan,
  parsed: ParsedResults,
  toolId: string,
  targetId: number
): void {
  // Map legacy entity slots to schema entity types
  const entityMapping: Record<string, Record<string, unknown>[]> = {
    service: parsed.entities.services.map((s) => ({ ...s, discovered_by: toolId })),
    vulnerability: parsed.entities.vulnerabilities.map((v) => ({ ...v, discovered_by: toolId })),
    credential: parsed.entities.credentials.map((c) => ({ ...c, source: toolId })),
    web_path: parsed.entities.webPaths.map((w) => ({ ...w, discovered_by: toolId })),
    finding: parsed.entities.findings.map((f) => ({ ...f }))
  }

  // Also include any generic entityRecords from the parser
  if (parsed.entityRecords) {
    for (const [entityType, records] of Object.entries(parsed.entityRecords)) {
      if (!entityMapping[entityType]) {
        entityMapping[entityType] = records
      } else {
        entityMapping[entityType].push(...records)
      }
    }
  }

  for (const [entityType, records] of Object.entries(entityMapping)) {
    const entityDef = schema.entities[entityType]
    if (!entityDef) continue

    for (const record of records) {
      try {
        // Auto-inject parent ID and scan_id
        const data: Record<string, unknown> = { ...record }

        // Remove placeholder IDs (id: 0) from parsed results
        delete data.id
        delete data.target_id
        delete data.scan_id

        // Add parent FK
        if (entityDef.parentFkColumn) {
          data[entityDef.parentFkColumn] = targetId
        }

        // Add scan_id if the entity has that field
        if (entityDef.fields.scan_id) {
          data.scan_id = scan.id
        }

        // Remove empty string values and created_at (let DB default)
        delete data.created_at
        for (const [key, val] of Object.entries(data)) {
          if (val === '') data[key] = null
        }

        db.entityCreate(entityType, data)
      } catch (err) {
        console.warn(`Failed to store ${entityType} from scan ${scan.id}:`, err)
      }
    }
  }

  // Update target OS guess from os_detection findings
  const osFindings = parsed.entities.findings.filter((f) => f.type === 'os_detection')
  if (osFindings.length > 0 && osFindings[0].description) {
    try {
      db.entityUpdate(schema.primaryEntity, targetId, { os_guess: osFindings[0].description })
    } catch {
      // Non-critical — OS guess is supplementary
    }
  }
}

