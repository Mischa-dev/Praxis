// Profile loader — loads and validates profile/manifest.yaml + glossary at startup

import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { app } from 'electron'
import * as yaml from 'js-yaml'
import { validateManifest } from '@shared/schemas/manifest-schema'
import type { ProfileManifest, ProfilePaths } from '@shared/types/profile'
import type { GlossaryTerm } from '@shared/types/glossary'
import type { ResolvedSchema } from '@shared/types/entity'
import { loadSchema as loadEntitySchema, clearSchemaCache } from './schema-loader'

/** Resolved absolute paths for each profile directory */
export interface ResolvedProfilePaths {
  root: string
  modules: string
  workflows: string
  glossary: string
  actions: string
  scope: string
}

let cachedManifest: ProfileManifest | null = null
let cachedGlossary: GlossaryTerm[] | null = null
let cachedEntitySchema: ResolvedSchema | null = null
let resolvedPaths: ResolvedProfilePaths | null = null

/**
 * Determine the profile root directory.
 * In development: <project-root>/profile
 *   (electron-vite builds main to out/main/, so project root = __dirname/../../)
 * In production: <resources>/profile
 */
function getProfileRoot(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'profile')
  }
  // In dev, __dirname is out/main/ — go up 2 levels to project root
  return join(__dirname, '..', '..', 'profile')
}

/**
 * Resolve all profile-relative paths to absolute paths.
 */
function resolvePaths(profileRoot: string, paths: ProfilePaths): ResolvedProfilePaths {
  return {
    root: profileRoot,
    modules: resolve(profileRoot, paths.modules),
    workflows: resolve(profileRoot, paths.workflows),
    glossary: resolve(profileRoot, paths.glossary),
    actions: resolve(profileRoot, paths.actions),
    scope: resolve(profileRoot, paths.scope)
  }
}

/**
 * Load and validate the profile manifest from profile/manifest.yaml.
 * Throws on missing file or validation failure.
 */
export function loadManifest(): ProfileManifest {
  if (cachedManifest) return cachedManifest

  const profileRoot = getProfileRoot()
  const manifestPath = join(profileRoot, 'manifest.yaml')

  if (!existsSync(manifestPath)) {
    throw new Error(`Profile manifest not found: ${manifestPath}`)
  }

  const raw = readFileSync(manifestPath, 'utf-8')
  const data = yaml.load(raw)

  const result = validateManifest(data)
  if (!result.valid) {
    const details = result.errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')
    throw new Error(`Invalid profile manifest:\n${details}`)
  }

  const manifest = data as ProfileManifest

  // Resolve and cache paths
  resolvedPaths = resolvePaths(profileRoot, manifest.paths)
  cachedManifest = manifest

  return manifest
}

/**
 * Load glossary terms from profile/glossary/terms.yaml.
 * Returns an empty array if the file doesn't exist.
 */
export function loadGlossary(): GlossaryTerm[] {
  if (cachedGlossary) return cachedGlossary

  const paths = getResolvedPaths()
  const glossaryPath = join(paths.glossary, 'terms.yaml')

  if (!existsSync(glossaryPath)) {
    cachedGlossary = []
    return cachedGlossary
  }

  const raw = readFileSync(glossaryPath, 'utf-8')
  const data = yaml.load(raw)

  if (!Array.isArray(data)) {
    console.warn(`Glossary file is not an array: ${glossaryPath}`)
    cachedGlossary = []
    return cachedGlossary
  }

  // Basic validation: ensure each term has required fields
  const terms: GlossaryTerm[] = []
  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    if (typeof item !== 'object' || item === null) {
      console.warn(`Glossary term [${i}] is not an object, skipping`)
      continue
    }
    const t = item as Record<string, unknown>
    if (typeof t.id !== 'string' || typeof t.term !== 'string' || typeof t.definition !== 'string') {
      console.warn(`Glossary term [${i}] missing required fields (id, term, definition), skipping`)
      continue
    }
    terms.push({
      id: t.id,
      term: t.term,
      definition: t.definition,
      explanation: typeof t.explanation === 'string' ? t.explanation : undefined,
      related_terms: Array.isArray(t.related_terms) ? (t.related_terms as string[]) : undefined,
      category: typeof t.category === 'string' ? t.category : undefined
    })
  }

  cachedGlossary = terms
  return cachedGlossary
}

/**
 * Load the entity schema from profile/schema.yaml.
 * Returns null if no schema path is configured in the manifest.
 */
export function loadEntitySchemaFromProfile(): ResolvedSchema | null {
  if (cachedEntitySchema) return cachedEntitySchema

  const paths = getResolvedPaths()
  const manifest = getManifest()

  const schemaRelPath = manifest.paths.schema
  if (!schemaRelPath) return null

  try {
    cachedEntitySchema = loadEntitySchema(paths.root, schemaRelPath)
    return cachedEntitySchema
  } catch (err) {
    console.warn('Failed to load entity schema:', err)
    return null
  }
}

/**
 * Get the loaded entity schema. Returns null if not loaded or not configured.
 */
export function getEntitySchema(): ResolvedSchema | null {
  return cachedEntitySchema
}

/**
 * Get the loaded manifest. Throws if loadManifest() hasn't been called.
 */
export function getManifest(): ProfileManifest {
  if (!cachedManifest) {
    throw new Error('Profile manifest not loaded. Call loadManifest() first.')
  }
  return cachedManifest
}

/**
 * Get resolved absolute paths for profile directories.
 * Throws if loadManifest() hasn't been called.
 */
export function getResolvedPaths(): ResolvedProfilePaths {
  if (!resolvedPaths) {
    throw new Error('Profile paths not resolved. Call loadManifest() first.')
  }
  return resolvedPaths
}

/**
 * Clear cached profile data (useful for testing or profile reload).
 */
export function clearProfileCache(): void {
  cachedManifest = null
  cachedGlossary = null
  cachedEntitySchema = null
  resolvedPaths = null
  clearSchemaCache()
}
