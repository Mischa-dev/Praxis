// Scope checker — resolves targets, checks IPs against cloud provider ranges

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { resolve as dnsResolve } from 'dns/promises'
import { getManifest, getResolvedPaths } from './profile-loader'
import type { ScopeCheckResult } from '@shared/types/ipc'

// ── Cloud Provider Data ──

interface CloudProviderData {
  provider: string
  description: string
  auth_policy_url: string
  ranges_ipv4: string[]
  ranges_ipv6?: string[]
}

/** Parsed CIDR entry for fast matching */
interface CidrEntry {
  ip: number // 32-bit network address
  mask: number // 32-bit subnet mask
}

interface LoadedProvider {
  provider: string
  description: string
  authPolicyUrl: string
  cidrs: CidrEntry[]
}

let loadedProviders: LoadedProvider[] | null = null

// ── IP Utilities ──

/** Parse a dotted-quad IPv4 string to a 32-bit integer. Returns null if invalid. */
function ipToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (const part of parts) {
    const n = parseInt(part, 10)
    if (isNaN(n) || n < 0 || n > 255) return null
    result = (result << 8) | n
  }
  // Use unsigned 32-bit
  return result >>> 0
}

/** Parse a CIDR string (e.g. "10.0.0.0/8") into network address + mask. */
function parseCidr(cidr: string): CidrEntry | null {
  const [ipStr, prefixStr] = cidr.split('/')
  if (!ipStr || !prefixStr) return null
  const ip = ipToInt(ipStr)
  if (ip === null) return null
  const prefix = parseInt(prefixStr, 10)
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null
  // Create mask: e.g. prefix=24 => 0xFFFFFF00
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  return { ip: (ip & mask) >>> 0, mask }
}

/** Check if an IP (as 32-bit int) falls within a CIDR entry. */
function ipInCidr(ipInt: number, cidr: CidrEntry): boolean {
  return ((ipInt & cidr.mask) >>> 0) === cidr.ip
}

/** Check if an IP string is a private/reserved address (RFC 1918 + loopback + link-local). */
function isPrivateIp(ip: string): boolean {
  const n = ipToInt(ip)
  if (n === null) return false

  // 10.0.0.0/8
  if (((n >>> 24) & 0xff) === 10) return true
  // 172.16.0.0/12
  if (((n >>> 24) & 0xff) === 172 && ((n >>> 16) & 0xf0) === 16) return true
  // 192.168.0.0/16
  if (((n >>> 24) & 0xff) === 192 && ((n >>> 16) & 0xff) === 168) return true
  // 127.0.0.0/8 (loopback)
  if (((n >>> 24) & 0xff) === 127) return true
  // 169.254.0.0/16 (link-local)
  if (((n >>> 24) & 0xff) === 169 && ((n >>> 16) & 0xff) === 254) return true

  return false
}

const IP_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const CIDR_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/
const URL_RE = /^https?:\/\//i

// ── Provider Loading ──

/** Load all cloud provider JSON files from the profile's scope directory. */
export function loadCloudProviders(): void {
  const manifest = getManifest()
  if (!manifest.scope.enabled) {
    loadedProviders = []
    return
  }

  const paths = getResolvedPaths()
  const cloudDir = join(paths.scope, manifest.scope.cloud_providers_dir)

  if (!existsSync(cloudDir)) {
    console.warn(`Cloud ranges directory not found: ${cloudDir}`)
    loadedProviders = []
    return
  }

  const files = readdirSync(cloudDir).filter((f) => f.endsWith('.json'))
  const providers: LoadedProvider[] = []

  for (const file of files) {
    try {
      const raw = readFileSync(join(cloudDir, file), 'utf-8')
      const data = JSON.parse(raw) as CloudProviderData

      if (!data.provider || !Array.isArray(data.ranges_ipv4)) {
        console.warn(`Invalid cloud range file (missing provider/ranges_ipv4): ${file}`)
        continue
      }

      // Parse all IPv4 CIDRs
      const cidrs: CidrEntry[] = []
      for (const range of data.ranges_ipv4) {
        const parsed = parseCidr(range)
        if (parsed) cidrs.push(parsed)
      }

      providers.push({
        provider: data.provider,
        description: data.description || data.provider,
        authPolicyUrl: data.auth_policy_url || '',
        cidrs
      })
    } catch (err) {
      console.warn(`Failed to load cloud range file ${file}:`, err)
    }
  }

  loadedProviders = providers
}

/** Get loaded providers (loads if not yet loaded). */
function getProviders(): LoadedProvider[] {
  if (loadedProviders === null) {
    loadCloudProviders()
  }
  return loadedProviders!
}

// ── Target Resolution ──

/** Extract the hostname from a target value (handles URLs, domains, hostnames). */
function extractHostname(target: string): string {
  if (URL_RE.test(target)) {
    try {
      return new URL(target).hostname
    } catch {
      return target
    }
  }
  return target
}

/** Resolve a hostname/domain to IPv4 addresses. Returns empty array on failure. */
async function resolveToIps(hostname: string): Promise<string[]> {
  // Already an IP
  if (IP_RE.test(hostname)) return [hostname]
  // CIDR — use the network address
  if (CIDR_RE.test(hostname)) return [hostname.split('/')[0]]

  try {
    const addresses = await dnsResolve(hostname)
    return addresses.filter((a) => IP_RE.test(a))
  } catch {
    return []
  }
}

// ── Main Check ──

/** Check a target value against scope rules and cloud providers. */
export async function checkScope(target: string): Promise<ScopeCheckResult> {
  const manifest = getManifest()

  // If scope checking is disabled, everything is in-scope
  if (!manifest.scope.enabled) {
    return { inScope: true, warnings: [] }
  }

  const warnings: string[] = []
  const hostname = extractHostname(target)
  const ips = await resolveToIps(hostname)

  if (ips.length === 0 && !IP_RE.test(hostname) && !CIDR_RE.test(hostname)) {
    warnings.push(`Could not resolve "${hostname}" to an IP address. DNS resolution failed.`)
    return { inScope: true, warnings }
  }

  // Check for private IPs
  const allPrivate = ips.length > 0 && ips.every((ip) => isPrivateIp(ip))
  if (allPrivate) {
    return {
      inScope: true,
      warnings: ['This is a private IP address (RFC 1918). No cloud provider concerns.']
    }
  }

  // Check each resolved IP against cloud provider ranges
  const providers = getProviders()
  for (const ip of ips) {
    const ipInt = ipToInt(ip)
    if (ipInt === null) continue

    for (const provider of providers) {
      const match = provider.cidrs.some((cidr) => ipInCidr(ipInt, cidr))
      if (match) {
        return {
          inScope: true,
          cloudProvider: {
            name: provider.provider,
            description: provider.description,
            authPolicyUrl: provider.authPolicyUrl
          },
          warnings: [
            `This IP (${ip}) belongs to ${provider.description}. ` +
              `You likely need explicit authorization from both the target owner ` +
              `AND ${provider.provider} before testing.`
          ]
        }
      }
    }
  }

  return { inScope: true, warnings: [] }
}

/** Clear cached providers (for testing or profile reload). */
export function clearScopeCache(): void {
  loadedProviders = null
}
