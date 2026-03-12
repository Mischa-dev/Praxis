/**
 * Entity extractor — recognizes structured entities (IPs, ports, hostnames,
 * URLs, emails, CVEs, hashes) from raw text output.
 *
 * This module is domain-agnostic. It applies generic regex patterns to
 * identify common data types that can be used for enrichment.
 */

// ---------------------------------------------------------------------------
// Entity types
// ---------------------------------------------------------------------------

export interface ExtractedEntity {
  type: ExtractableType
  value: string
  offset: number // character offset in the source text
  length: number
}

export type ExtractableType =
  | 'ip'
  | 'ipv6'
  | 'port'
  | 'hostname'
  | 'url'
  | 'email'
  | 'cve'
  | 'hash_md5'
  | 'hash_sha1'
  | 'hash_sha256'
  | 'mac_address'
  | 'cidr'

// ---------------------------------------------------------------------------
// Patterns — order matters (more specific patterns first to avoid false matches)
// ---------------------------------------------------------------------------

interface EntityPattern {
  type: ExtractableType
  regex: RegExp
}

const ENTITY_PATTERNS: EntityPattern[] = [
  // CVE IDs (very specific, match first)
  { type: 'cve', regex: /CVE-\d{4}-\d{4,}/gi },

  // URLs (before hostname/IP to avoid partial matches)
  { type: 'url', regex: /https?:\/\/[^\s"'<>]+/gi },

  // Email addresses
  { type: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },

  // CIDR notation (before plain IPs)
  { type: 'cidr', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}\b/g },

  // IPv6 addresses (simplified — full and compressed forms)
  { type: 'ipv6', regex: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b/g },

  // MAC addresses
  { type: 'mac_address', regex: /\b(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}\b/g },

  // SHA-256 hashes (64 hex chars — before SHA-1 and MD5)
  { type: 'hash_sha256', regex: /\b[0-9a-fA-F]{64}\b/g },

  // SHA-1 hashes (40 hex chars)
  { type: 'hash_sha1', regex: /\b[0-9a-fA-F]{40}\b/g },

  // MD5 hashes (32 hex chars)
  { type: 'hash_md5', regex: /\b[0-9a-fA-F]{32}\b/g },

  // IPv4 addresses (validate octets 0-255)
  { type: 'ip', regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },

  // Hostnames (must have at least one dot, not an IP)
  { type: 'hostname', regex: /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g },

  // Standalone port numbers (common pattern: "port 22" or ":8080")
  { type: 'port', regex: /(?<=[:,/\s])\d{1,5}(?=\/(?:tcp|udp))/gi }
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract all recognized entities from raw text.
 * Returns a deduplicated list sorted by offset.
 */
export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []
  const seen = new Set<string>() // dedup key: "type:value"

  for (const { type, regex } of ENTITY_PATTERNS) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      const value = match[0]
      const key = `${type}:${value.toLowerCase()}`

      if (seen.has(key)) continue

      // Validate specific types
      if (type === 'ip' && !isValidIp(value)) continue
      if (type === 'port' && !isValidPort(value)) continue
      if (type === 'hostname' && isLikelyIp(value)) continue

      seen.add(key)
      entities.push({
        type,
        value,
        offset: match.index,
        length: value.length
      })
    }
  }

  // Sort by offset for ordered display
  entities.sort((a, b) => a.offset - b.offset)
  return entities
}

/**
 * Extract only entities of specific types.
 */
export function extractEntitiesOfType(
  text: string,
  types: ExtractableType[]
): ExtractedEntity[] {
  return extractEntities(text).filter((e) => types.includes(e.type))
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidIp(value: string): boolean {
  const parts = value.split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => {
    const n = parseInt(p, 10)
    return n >= 0 && n <= 255
  })
}

function isValidPort(value: string): boolean {
  const n = parseInt(value, 10)
  return n >= 1 && n <= 65535
}

function isLikelyIp(value: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)
}
