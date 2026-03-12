// Module loader — scans profile/modules/ for YAML tool definitions,
// validates them, checks binary availability, and provides hot-reload support.

import { readFileSync, readdirSync, statSync, watch } from 'fs'
import { join, extname } from 'path'
import { execFile } from 'child_process'
import * as yaml from 'js-yaml'
import { validateModule } from '@shared/schemas/module-schema'
import { getResolvedPaths } from './profile-loader'
import type { Module, ModuleDefinition } from '@shared/types/module'

let cachedModules: Module[] | null = null
let watcher: ReturnType<typeof watch> | null = null
let reloadCallback: (() => void) | null = null

/**
 * Recursively find all .yaml/.yml files in a directory.
 */
function findYamlFiles(dir: string): string[] {
  const files: string[] = []
  let entries: string[]

  try {
    entries = readdirSync(dir)
  } catch {
    // Directory doesn't exist or isn't readable
    return files
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    try {
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        files.push(...findYamlFiles(fullPath))
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase()
        if (ext === '.yaml' || ext === '.yml') {
          files.push(fullPath)
        }
      }
    } catch {
      // Skip files we can't stat
    }
  }

  return files
}

/**
 * Check if a binary is available on the system using `which`.
 * Returns a promise that resolves to true if found, false otherwise.
 */
function checkBinaryAvailable(binary: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('which', [binary], (error) => {
      resolve(!error)
    })
  })
}

/**
 * Convert a raw ModuleDefinition (from YAML) into a resolved Module object.
 */
function definitionToModule(def: ModuleDefinition, installed: boolean): Module {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    category: def.category,
    binary: def.binary,
    icon: def.icon,
    tags: def.tags,
    requiresRoot: def.requires_root ?? false,
    installed,
    installCommand: def.install_command,
    arguments: def.arguments,
    output: def.output,
    suggestions: def.suggestions ?? [],
    executionMode: def.execution_mode ?? 'spawn',
    interactive: def.interactive ?? false,
    rootOptional: def.root_optional ?? false,
    timeout: def.timeout,
    workingDirectory: def.working_directory,
    environment: def.environment,
    shell: def.shell ?? false,
    preCommand: def.pre_command,
    postCommand: def.post_command,
    transferCommands: def.transfer_commands,
    runCommand: def.run_command,
    documentationUrl: def.documentation_url
  }
}

/**
 * Load all module YAML files from the profile's modules directory.
 * Validates each file and checks binary availability.
 * Returns an array of resolved Module objects.
 */
export async function loadModules(): Promise<Module[]> {
  if (cachedModules) return cachedModules

  const paths = getResolvedPaths()
  const yamlFiles = findYamlFiles(paths.modules)
  const modules: Module[] = []

  // Parse and validate all YAML files, collect binary check promises
  const pendingModules: { def: ModuleDefinition; binaryCheck: Promise<boolean> }[] = []

  for (const filePath of yamlFiles) {
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data = yaml.load(raw)

      const result = validateModule(data)
      if (!result.valid) {
        const details = result.errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')
        console.warn(`Invalid module YAML (${filePath}):\n${details}`)
        continue
      }

      const def = data as ModuleDefinition

      // For reference-mode tools, binary isn't expected locally
      const isReference = def.execution_mode === 'reference'
      const binaryCheck = isReference
        ? Promise.resolve(false)
        : checkBinaryAvailable(def.install_check ?? def.binary)

      pendingModules.push({ def, binaryCheck })
    } catch (err) {
      console.warn(`Failed to parse module YAML (${filePath}):`, err)
    }
  }

  // Resolve all binary checks in parallel
  const installStatuses = await Promise.all(pendingModules.map((p) => p.binaryCheck))

  for (let i = 0; i < pendingModules.length; i++) {
    const { def } = pendingModules[i]
    const installed = installStatuses[i]
    modules.push(definitionToModule(def, installed))
  }

  // Sort by category then name for consistent ordering
  modules.sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category)
    if (catCmp !== 0) return catCmp
    return a.name.localeCompare(b.name)
  })

  cachedModules = modules
  return modules
}

/**
 * Get a single module by ID. Returns undefined if not found.
 */
export async function getModule(moduleId: string): Promise<Module | undefined> {
  const modules = await loadModules()
  return modules.find((m) => m.id === moduleId)
}

/**
 * Re-check whether a specific module's binary is installed.
 */
export async function checkModuleInstall(moduleId: string): Promise<boolean> {
  const mod = await getModule(moduleId)
  if (!mod) return false
  if (mod.executionMode === 'reference') return false
  return checkBinaryAvailable(mod.binary)
}

/**
 * Clear cached modules and reload from disk.
 */
export async function reloadModules(): Promise<Module[]> {
  cachedModules = null
  return loadModules()
}

/**
 * Get cached modules synchronously. Returns null if not yet loaded.
 */
export function getCachedModules(): Module[] | null {
  return cachedModules
}

/**
 * Start watching the modules directory for changes.
 * When a change is detected, the cache is cleared and the optional callback is invoked.
 */
export function watchModules(onChange?: () => void): void {
  if (watcher) return // Already watching

  const paths = getResolvedPaths()
  reloadCallback = onChange ?? null

  try {
    watcher = watch(paths.modules, { recursive: true }, (_eventType, filename) => {
      if (!filename) return
      const ext = extname(filename).toLowerCase()
      if (ext !== '.yaml' && ext !== '.yml') return

      // Debounce: clear cache immediately, callback fires on next tick
      cachedModules = null
      if (reloadCallback) {
        // Use setImmediate to batch rapid file changes
        setImmediate(() => reloadCallback?.())
      }
    })
  } catch (err) {
    console.warn('Failed to watch modules directory:', err)
  }
}

/**
 * Stop watching the modules directory.
 */
export function stopWatchingModules(): void {
  if (watcher) {
    watcher.close()
    watcher = null
    reloadCallback = null
  }
}
