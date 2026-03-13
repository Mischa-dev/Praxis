#!/usr/bin/env node

/**
 * Praxis CLI — headless pipeline execution without the Electron GUI.
 *
 * Usage:
 *   praxis list                        List saved pipelines
 *   praxis run <id-or-name>            Execute a saved pipeline
 *   praxis run <id-or-name> --dry-run  Show what would execute without running
 *   praxis run <id-or-name> --var key=value   Pre-set pipeline variables
 */

import { parseArgs } from 'util'
import { join } from 'path'
import { setUserDataPath, getUserDataPath } from '../main/app-paths'
import { setProfileRoot, loadManifest, loadGlossary, loadEntitySchemaFromProfile } from '../main/profile-loader'
import { loadModules } from '../main/module-loader'
import { initDefaultWorkspace, setEntitySchema, getDatabase, closeDatabase } from '../main/workspace-manager'
import { initProcessManager, cleanupProcessManager } from '../main/process-manager'
import {
  initPipelineEngine,
  executePipeline,
  getPipelineRunStatus,
  cleanupPipelineEngine
} from '../main/pipeline-engine'
import { initWorkflowEngine, cleanupWorkflowEngine } from '../main/workflow-engine'
import { cliPromptResolver } from './cli-prompt-resolver'
import {
  printPipelineStart,
  printNodeStatus,
  printPipelineResult,
  printError,
  printInfo,
  printPipelineList
} from './cli-output'
import type { PipelineRun } from '@shared/types/pipeline'

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean', default: false },
      var: { type: 'string', multiple: true, default: [] },
      help: { type: 'boolean', short: 'h', default: false },
      'data-dir': { type: 'string', default: '' },
    }
  })

  if (values.help || positionals.length === 0) {
    console.log(`
Praxis CLI — headless pipeline execution

Usage:
  praxis list                             List saved pipelines
  praxis run <id-or-name>                 Execute a saved pipeline
  praxis run <id-or-name> --dry-run       Show plan without executing
  praxis run <id-or-name> --var key=val   Pre-set variables (repeatable)
  praxis --data-dir <path>                Use custom data directory

Options:
  -h, --help       Show this help
  --dry-run        Print execution plan without running
  --var key=value  Pre-set pipeline variables (can repeat)
  --data-dir       Override user data directory (default: ~/.praxis)
`)
    process.exit(0)
  }

  // Set up data directory
  if (values['data-dir']) {
    setUserDataPath(values['data-dir'] as string)
  }

  // Set profile root relative to CWD (CLI runs from project root)
  setProfileRoot(join(process.cwd(), 'profile'))

  // Initialize profile and workspace
  try {
    loadManifest()
    loadGlossary()
  } catch (err) {
    printError(`Failed to load profile: ${(err as Error).message}`)
    process.exit(1)
  }

  const entitySchema = loadEntitySchemaFromProfile()
  if (entitySchema) {
    setEntitySchema(entitySchema)
  }

  try {
    initDefaultWorkspace()
  } catch (err) {
    printError(`Failed to initialize workspace: ${(err as Error).message}`)
    process.exit(1)
  }

  await loadModules().catch(() => {
    // Non-fatal
  })

  // Initialize engines — no window in CLI mode
  initProcessManager(() => null)
  initWorkflowEngine(() => null)
  initPipelineEngine(() => null, cliPromptResolver)

  const command = positionals[0]

  try {
    switch (command) {
      case 'list':
        await handleList()
        break
      case 'run':
        await handleRun(positionals.slice(1), values as { 'dry-run'?: boolean; var?: string[] })
        break
      default:
        printError(`Unknown command: ${command}. Use --help for usage.`)
        process.exit(1)
    }
  } finally {
    cleanup()
  }
}

async function handleList(): Promise<void> {
  const db = getDatabase()
  const pipelines = db.listPipelines()
  printPipelineList(pipelines)
}

async function handleRun(
  args: string[],
  opts: { 'dry-run'?: boolean; var?: string[] }
): Promise<void> {
  if (args.length === 0) {
    printError('Missing pipeline name or ID. Usage: praxis run <id-or-name>')
    process.exit(1)
  }

  const nameOrId = args.join(' ')
  const db = getDatabase()
  const pipelines = db.listPipelines()

  // Find pipeline by ID or name
  let pipeline = pipelines.find((p) => String(p.id) === nameOrId)
  if (!pipeline) {
    pipeline = pipelines.find((p) => p.name.toLowerCase() === nameOrId.toLowerCase())
  }
  if (!pipeline) {
    // Fuzzy match
    pipeline = pipelines.find((p) => p.name.toLowerCase().includes(nameOrId.toLowerCase()))
  }

  if (!pipeline) {
    printError(`Pipeline not found: "${nameOrId}"`)
    printInfo('Available pipelines:')
    printPipelineList(pipelines)
    process.exit(1)
  }

  if (opts['dry-run']) {
    printInfo(`Dry run for pipeline: ${pipeline.name}`)
    const def = JSON.parse(pipeline.definition)
    printInfo(`Nodes: ${def.nodes?.length ?? 0}`)
    printInfo(`Edges: ${def.edges?.length ?? 0}`)
    for (const node of def.nodes ?? []) {
      const type = node.type ?? 'tool'
      const label = type === 'tool' ? node.config?.toolId : type === 'shell' ? 'shell' : type
      console.log(`  ${type}: ${label}`)
    }
    return
  }

  // Parse --var flags
  const presetVars = new Map<string, string>()
  for (const v of opts.var ?? []) {
    const eqIdx = v.indexOf('=')
    if (eqIdx > 0) {
      presetVars.set(v.slice(0, eqIdx), v.slice(eqIdx + 1))
    }
  }

  // Execute the pipeline
  const { runId } = await executePipeline(pipeline.id)
  printPipelineStart(pipeline.name, runId)

  // Poll for completion
  let lastPrintedNodes = new Set<string>()
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      const run = getPipelineRunStatus(runId)
      if (!run) {
        clearInterval(check)
        resolve()
        return
      }

      // Print newly completed/failed nodes
      for (const node of run.nodes) {
        if (node.status !== 'pending' && node.status !== 'running') {
          const key = `${node.nodeId}:${node.status}`
          if (!lastPrintedNodes.has(key)) {
            printNodeStatus(node)
            lastPrintedNodes.add(key)
          }
        }
      }

      if (run.status !== 'running') {
        clearInterval(check)
        printPipelineResult(run)
        resolve()
      }
    }, 250)
  })

  // Exit with appropriate code
  const finalRun = getPipelineRunStatus(runId)
  if (finalRun?.status === 'failed') {
    process.exit(1)
  }
}

function cleanup(): void {
  cleanupPipelineEngine()
  cleanupWorkflowEngine()
  cleanupProcessManager()
  closeDatabase()
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  cleanup()
  process.exit(130)
})

process.on('SIGTERM', () => {
  cleanup()
  process.exit(143)
})

main().catch((err) => {
  printError((err as Error).message)
  cleanup()
  process.exit(1)
})
