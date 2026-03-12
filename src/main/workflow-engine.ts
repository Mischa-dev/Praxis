/**
 * Workflow engine — loads workflow YAML definitions, resolves template
 * variables, executes steps in dependency order, and reports progress via IPC.
 *
 * This module is domain-agnostic: it executes whatever steps and tools
 * the workflow YAML defines. No tool names or pentest concepts here.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'
import * as yaml from 'js-yaml'
import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import { validateWorkflow } from '@shared/schemas/workflow-schema'
import { getResolvedPaths } from './profile-loader'
import { getModule } from './module-loader'
import { getDatabase } from './workspace-manager'
import { execute, cancel as cancelProcess, isRunning } from './process-manager'
import { buildCommandArgs } from './ipc/tool-handlers'
import { getScanParsedResults } from './scan-result-store'
import {
  resolveTemplate,
  evaluateCondition,
  extractVariables,
  type StepResultData
} from './template-resolver'
import type {
  Workflow,
  WorkflowDefinition,
  WorkflowStepDefinition,
  WorkflowRun,
  WorkflowStepRun,
  WorkflowStepStatus,
  StepFailureAction
} from '@shared/types/pipeline'
import type { Target } from '@shared/types/target'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let cachedWorkflows: Workflow[] | null = null
let windowGetter: (() => BrowserWindow | null) | null = null

/** Active workflow runs, keyed by runId */
const activeRuns = new Map<string, ActiveWorkflowRun>()

interface ActiveWorkflowRun {
  run: WorkflowRun
  target: Target
  /** Per-step accumulated results from parsing */
  stepResults: Map<string, StepResultData>
  /** Per-step extracted variables (from `extract:` config) */
  stepExtracted: Map<string, Record<string, unknown>>
  /** Scan IDs owned by this workflow run, for cancellation */
  scanIds: Set<number>
  /** User-disabled steps */
  disabledSteps: Set<string>
  /** Per-step arg overrides */
  argOverrides: Record<string, Record<string, unknown>>
  /** Abort signal */
  aborted: boolean
}

// StepResultData is imported from template-resolver

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initWorkflowEngine(getWindow: () => BrowserWindow | null): void {
  windowGetter = getWindow
}

// ---------------------------------------------------------------------------
// Workflow loading
// ---------------------------------------------------------------------------

function findYamlFiles(dir: string): string[] {
  const files: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
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
      // Skip unreadable files
    }
  }
  return files
}

function definitionToWorkflow(def: WorkflowDefinition): Workflow {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    category: def.category,
    icon: def.icon,
    estimatedDuration: def.estimated_duration,
    requiresRoot: def.requires_root ?? false,
    steps: def.steps
  }
}

export function loadWorkflows(): Workflow[] {
  if (cachedWorkflows) return cachedWorkflows

  const paths = getResolvedPaths()
  const yamlFiles = findYamlFiles(paths.workflows)
  const workflows: Workflow[] = []

  for (const filePath of yamlFiles) {
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data = yaml.load(raw)

      const result = validateWorkflow(data)
      if (!result.valid) {
        const details = result.errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')
        console.warn(`Invalid workflow YAML (${filePath}):\n${details}`)
        continue
      }

      const def = data as WorkflowDefinition
      workflows.push(definitionToWorkflow(def))
    } catch (err) {
      console.warn(`Failed to parse workflow YAML (${filePath}):`, err)
    }
  }

  workflows.sort((a, b) => a.name.localeCompare(b.name))
  cachedWorkflows = workflows
  return workflows
}

export function getWorkflow(workflowId: string): Workflow | undefined {
  const workflows = loadWorkflows()
  return workflows.find((w) => w.id === workflowId)
}

export function reloadWorkflows(): Workflow[] {
  cachedWorkflows = null
  return loadWorkflows()
}

// Template resolution functions (resolveTemplate, evaluateCondition,
// extractVariables, StepResultData) are imported from ./template-resolver

// ---------------------------------------------------------------------------
// Workflow execution
// ---------------------------------------------------------------------------

export async function executeWorkflow(
  workflowId: string,
  targetId: number,
  options?: {
    disabledSteps?: string[]
    argOverrides?: Record<string, Record<string, unknown>>
  }
): Promise<{ runId: string }> {
  const workflow = getWorkflow(workflowId)
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`)

  const db = getDatabase()
  const target = db.getTarget(targetId)
  if (!target) throw new Error(`Target not found: ${targetId}`)

  const runId = randomUUID()

  const stepRuns: WorkflowStepRun[] = workflow.steps.map((step) => ({
    id: step.id,
    status: 'pending' as WorkflowStepStatus
  }))

  const run: WorkflowRun = {
    runId,
    workflowId,
    status: 'running',
    currentStepId: null,
    steps: stepRuns,
    startedAt: new Date().toISOString()
  }

  const activeRun: ActiveWorkflowRun = {
    run,
    target,
    stepResults: new Map(),
    stepExtracted: new Map(),
    scanIds: new Set(),
    disabledSteps: new Set(options?.disabledSteps ?? []),
    argOverrides: options?.argOverrides ?? {},
    aborted: false
  }

  activeRuns.set(runId, activeRun)
  sendProgress(run)

  // Execute steps asynchronously
  runWorkflowSteps(activeRun, workflow.steps).catch((err) => {
    console.error(`Workflow ${runId} failed unexpectedly:`, err)
    activeRun.run.status = 'failed'
    activeRun.run.completedAt = new Date().toISOString()
    sendProgress(activeRun.run)
    activeRuns.delete(runId)
  })

  return { runId }
}

async function runWorkflowSteps(
  activeRun: ActiveWorkflowRun,
  steps: WorkflowStepDefinition[]
): Promise<void> {
  const { run, disabledSteps } = activeRun

  // Build dependency graph
  const completed = new Set<string>()
  const remaining = new Set(steps.map((s) => s.id))
  const stepMap = new Map(steps.map((s) => [s.id, s]))

  while (remaining.size > 0 && !activeRun.aborted) {
    // Find steps whose dependencies are all satisfied
    const ready: WorkflowStepDefinition[] = []
    for (const stepId of remaining) {
      const step = stepMap.get(stepId)!
      const deps = normalizeDeps(step.depends_on)
      if (deps.every((d) => completed.has(d))) {
        ready.push(step)
      }
    }

    if (ready.length === 0) {
      // No steps ready but some remaining — circular dependency or all deps failed
      for (const stepId of remaining) {
        updateStepStatus(activeRun, stepId, 'skipped')
      }
      break
    }

    // Execute ready steps. Group truly parallel steps together.
    const parallel: WorkflowStepDefinition[] = []
    const sequential: WorkflowStepDefinition[] = []

    for (const step of ready) {
      // Steps that share no dependencies with each other can run in parallel
      const deps = normalizeDeps(step.depends_on)
      const hasDepsInReady = deps.some((d) => ready.some((r) => r.id === d))
      if (!hasDepsInReady && ready.length > 1) {
        parallel.push(step)
      } else {
        sequential.push(step)
      }
    }

    // Execute parallel steps concurrently
    if (parallel.length > 0) {
      await Promise.all(
        parallel.map((step) => executeStep(activeRun, step, disabledSteps))
      )
      for (const step of parallel) {
        remaining.delete(step.id)
        completed.add(step.id)
      }
    }

    // Execute sequential steps one by one
    for (const step of sequential) {
      if (activeRun.aborted) break
      await executeStep(activeRun, step, disabledSteps)
      remaining.delete(step.id)
      completed.add(step.id)
    }
  }

  // Finalize the run
  if (activeRun.aborted) {
    run.status = 'cancelled'
  } else {
    const anyFailed = run.steps.some((s) => s.status === 'failed')
    run.status = anyFailed ? 'failed' : 'completed'
  }
  run.currentStepId = null
  run.completedAt = new Date().toISOString()
  sendProgress(run)
  activeRuns.delete(run.runId)
}

async function executeStep(
  activeRun: ActiveWorkflowRun,
  stepDef: WorkflowStepDefinition,
  disabledSteps: Set<string>
): Promise<void> {
  const { target, stepResults, stepExtracted, argOverrides } = activeRun

  // Skip user-disabled steps
  if (disabledSteps.has(stepDef.id)) {
    updateStepStatus(activeRun, stepDef.id, 'skipped')
    return
  }

  // Check condition
  if (stepDef.condition) {
    const conditionMet = evaluateCondition(
      stepDef.condition,
      target,
      stepResults,
      stepExtracted
    )
    if (!conditionMet) {
      updateStepStatus(activeRun, stepDef.id, 'skipped')
      return
    }
  }

  // Handle for_each: expand into multiple iterations
  if (stepDef.for_each) {
    const items = resolveTemplate(
      stepDef.for_each,
      target,
      stepResults,
      stepExtracted
    )

    if (Array.isArray(items) && items.length > 0) {
      if (stepDef.parallel) {
        await Promise.all(
          items.map((item) =>
            executeSingleStep(activeRun, stepDef, argOverrides, item)
          )
        )
      } else {
        for (const item of items) {
          if (activeRun.aborted) break
          await executeSingleStep(activeRun, stepDef, argOverrides, item)
        }
      }
    } else {
      updateStepStatus(activeRun, stepDef.id, 'skipped')
    }
    return
  }

  // Normal single execution
  await executeSingleStep(activeRun, stepDef, argOverrides)
}

async function executeSingleStep(
  activeRun: ActiveWorkflowRun,
  stepDef: WorkflowStepDefinition,
  argOverrides: Record<string, Record<string, unknown>>,
  item?: unknown
): Promise<void> {
  const { run, target, stepResults, stepExtracted } = activeRun

  // Update status: running
  run.currentStepId = stepDef.id
  updateStepStatus(activeRun, stepDef.id, 'running')

  try {
    // Look up module
    const mod = await getModule(stepDef.tool)
    if (!mod) {
      throw new Error(`Module not found: ${stepDef.tool}`)
    }

    if (mod.executionMode === 'reference') {
      throw new Error(`Module "${stepDef.tool}" is reference-mode and cannot be executed locally`)
    }

    // Resolve args from step definition + overrides
    const resolvedArgs: Record<string, unknown> = {}
    const stepArgs = { ...(stepDef.args ?? {}), ...(argOverrides[stepDef.id] ?? {}) }

    for (const [key, val] of Object.entries(stepArgs)) {
      if (typeof val === 'string') {
        resolvedArgs[key] = resolveTemplate(val, target, stepResults, stepExtracted, item)
      } else {
        resolvedArgs[key] = val
      }
    }

    // Build CLI args
    const cliArgs = buildCommandArgs(mod, resolvedArgs)
    const command = [mod.binary, ...cliArgs].join(' ')

    // Create scan record
    const db = getDatabase()
    const scan = db.addScan({
      tool_id: stepDef.tool,
      command,
      target_id: target.id,
      args: JSON.stringify(resolvedArgs),
      status: 'queued'
    })

    db.addCommandHistory({
      scan_id: scan.id,
      command,
      tool_id: stepDef.tool,
      target_id: target.id
    })

    // Update step run with scan ID
    const stepRun = run.steps.find((s) => s.id === stepDef.id)
    if (stepRun) stepRun.scanId = scan.id
    activeRun.scanIds.add(scan.id)

    // Execute and wait for completion
    await new Promise<void>((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (activeRun.aborted) {
          clearInterval(checkInterval)
          cancelProcess(scan.id)
          reject(new Error('Workflow cancelled'))
          return
        }

        // Check scan status in DB
        const currentScan = db.getScan(scan.id)
        if (!currentScan) {
          clearInterval(checkInterval)
          reject(new Error(`Scan ${scan.id} not found`))
          return
        }

        if (
          currentScan.status === 'completed' ||
          currentScan.status === 'failed' ||
          currentScan.status === 'cancelled'
        ) {
          clearInterval(checkInterval)

          if (currentScan.status === 'completed') {
            resolve()
          } else if (currentScan.status === 'cancelled') {
            reject(new Error('Scan was cancelled'))
          } else {
            reject(
              new Error(currentScan.error_output || `Step "${stepDef.name}" failed`)
            )
          }
        }
      }, 500)

      // Start the process
      execute({
        scanId: scan.id,
        binary: mod.binary,
        args: cliArgs,
        cwd: mod.workingDirectory,
        env: mod.environment,
        timeout: (stepDef.timeout ?? mod.timeout ?? 0) * 1000,
        sudo: mod.requiresRoot && !mod.rootOptional,
        shell: mod.shell
      })
    })

    // Parse results and extract variables
    const parsed = await getScanParsedResults(scan.id)
    stepResults.set(stepDef.id, {
      scanId: scan.id,
      status: 'completed',
      parsedResults: parsed
    })

    if (stepDef.extract && parsed) {
      const extracted = extractVariables(stepDef.extract, parsed, stepDef.id)
      stepExtracted.set(stepDef.id, extracted)
    }

    updateStepStatus(activeRun, stepDef.id, 'completed')
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    stepResults.set(stepDef.id, {
      scanId: 0,
      status: 'failed',
      parsedResults: null
    })

    const onFailure: StepFailureAction = stepDef.on_failure ?? 'skip'

    if (onFailure === 'retry') {
      // Retry once, then skip
      try {
        await executeSingleStep(activeRun, { ...stepDef, on_failure: 'skip' }, argOverrides, item)
        return
      } catch {
        // Retry failed, fall through to skip
      }
    }

    if (onFailure === 'abort') {
      updateStepStatus(activeRun, stepDef.id, 'failed', errorMsg)
      activeRun.aborted = true
      return
    }

    // Default: skip (log failure, continue)
    updateStepStatus(activeRun, stepDef.id, 'failed', errorMsg)
  }
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

export function cancelWorkflow(runId: string): void {
  const activeRun = activeRuns.get(runId)
  if (!activeRun) return

  activeRun.aborted = true

  // Cancel all running scans owned by this workflow
  for (const scanId of activeRun.scanIds) {
    if (isRunning(scanId)) {
      cancelProcess(scanId)
    }
  }

  activeRun.run.status = 'cancelled'
  activeRun.run.completedAt = new Date().toISOString()
  sendProgress(activeRun.run)
  activeRuns.delete(runId)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDeps(depsOn: string | string[] | undefined): string[] {
  if (!depsOn) return []
  if (typeof depsOn === 'string') return [depsOn]
  return depsOn
}

function updateStepStatus(
  activeRun: ActiveWorkflowRun,
  stepId: string,
  status: WorkflowStepStatus,
  error?: string
): void {
  const stepRun = activeRun.run.steps.find((s) => s.id === stepId)
  if (stepRun) {
    stepRun.status = status
    if (error) stepRun.error = error
  }
  sendProgress(activeRun.run)
}

function sendProgress(run: WorkflowRun): void {
  const win = windowGetter?.()
  if (win && !win.isDestroyed()) {
    win.webContents.send('workflow:step-status', run)
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function cleanupWorkflowEngine(): void {
  // Cancel all active workflow runs
  for (const [runId] of activeRuns) {
    cancelWorkflow(runId)
  }
  windowGetter = null
}
