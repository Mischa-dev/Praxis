/**
 * Pipeline execution engine — executes visual pipeline definitions by
 * traversing the node graph in topological order.
 *
 * Domain-agnostic: delegates tool execution to the process manager and
 * module loader. All domain knowledge lives in the profile.
 */

import { randomUUID } from 'crypto'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import type { BrowserWindow } from 'electron'
import { getModule } from './module-loader'
import { getDatabase } from './workspace-manager'
import { execute, cancel as cancelProcess, isRunning } from './process-manager'
import { buildCommandArgs } from './ipc/tool-handlers'
import { getScanParsedResults } from './scan-result-store'
import {
  resolveTemplate,
  evaluateCondition,
  captureOutputValue,
  type StepResultData
} from './template-resolver'
import type { EntityRecord } from '@shared/types/entity'
import { getEntitySchema } from './profile-loader'
import type {
  PipelineDefinition,
  PipelineNodeV2,
  PipelineNodeV1,
  PipelineNode,
  PipelineEdge,
  PipelineRun,
  PipelineNodeRun,
  PipelineNodeStatus,
  PipelineNodeType,
  ToolNodeConfig,
  ConditionNodeConfig,
  ForEachNodeConfig,
  DelayNodeConfig,
  ShellNodeConfig,
  PromptNodeConfig,
  SetVariableNodeConfig,
  StepFailureAction
} from '@shared/types/pipeline'

const execAsync = promisify(execCb)

// ---------------------------------------------------------------------------
// Prompt resolver type
// ---------------------------------------------------------------------------

export type PromptResolver = (
  config: PromptNodeConfig,
  runId: string,
  nodeId: string
) => Promise<string | boolean>

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let windowGetter: (() => BrowserWindow | null) | null = null
let promptResolver: PromptResolver | null = null

const activeRuns = new Map<string, ActivePipelineRun>()

/** Completed runs kept briefly so CLI polling can still read them */
const completedRuns = new Map<string, PipelineRun>()

/** Pending prompt resolvers keyed by `${runId}:${nodeId}` */
const pendingPrompts = new Map<string, (value: string | boolean) => void>()

interface ActivePipelineRun {
  run: PipelineRun
  target: EntityRecord | null
  /** Parsed node graph */
  nodeMap: Map<string, PipelineNodeV2>
  edges: PipelineEdge[]
  /** Adjacency list: nodeId → downstream nodeIds */
  downstream: Map<string, string[]>
  /** In-degree count per node */
  inDegree: Map<string, number>
  /** Per-node accumulated results from parsing */
  nodeResults: Map<string, StepResultData>
  /** Per-node extracted variables */
  nodeExtracted: Map<string, Record<string, unknown>>
  /** Pipeline-level variables (vars.*) */
  variables: Map<string, unknown>
  /** Scan IDs owned by this pipeline run, for cancellation */
  scanIds: Set<number>
  /** Abort signal */
  aborted: boolean
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initPipelineEngine(
  getWindow: () => BrowserWindow | null,
  resolver?: PromptResolver
): void {
  windowGetter = getWindow
  if (resolver) promptResolver = resolver
}

export function setPromptResolver(resolver: PromptResolver): void {
  promptResolver = resolver
}

/** Resolve a pending prompt from the renderer */
export function resolvePrompt(runId: string, nodeId: string, value: string | boolean): void {
  const key = `${runId}:${nodeId}`
  const resolve = pendingPrompts.get(key)
  if (resolve) {
    resolve(value)
    pendingPrompts.delete(key)
  }
}

// ---------------------------------------------------------------------------
// Pipeline execution
// ---------------------------------------------------------------------------

export async function executePipeline(
  pipelineId: number,
  targetId?: number
): Promise<{ runId: string }> {
  const db = getDatabase()
  const pipeline = db.getPipeline(pipelineId)
  if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`)

  // Target is optional — look it up only if provided
  let target: EntityRecord | null = null
  if (targetId) {
    const schema = getEntitySchema()
    const primaryType = schema?.primaryEntity ?? 'host'
    target = db.entityGet(primaryType, targetId) ?? null
  }

  // Parse the pipeline definition
  const def: PipelineDefinition = JSON.parse(pipeline.definition)
  const normalizedNodes = normalizeNodes(def)
  const edges = def.edges

  // Build node map
  const nodeMap = new Map<string, PipelineNodeV2>()
  for (const node of normalizedNodes) {
    nodeMap.set(node.id, node)
  }

  // Build adjacency list and in-degree map
  const downstream = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const node of normalizedNodes) {
    downstream.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  for (const edge of edges) {
    const list = downstream.get(edge.source)
    if (list) list.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  // Validate: no cycles (Kahn's algorithm check)
  const tempInDegree = new Map(inDegree)
  const queue: string[] = []
  let sortedCount = 0

  for (const [nodeId, deg] of tempInDegree) {
    if (deg === 0) queue.push(nodeId)
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    sortedCount++
    for (const next of downstream.get(nodeId) ?? []) {
      const newDeg = (tempInDegree.get(next) ?? 1) - 1
      tempInDegree.set(next, newDeg)
      if (newDeg === 0) queue.push(next)
    }
  }

  if (sortedCount < normalizedNodes.length) {
    throw new Error('Pipeline contains a cycle and cannot be executed')
  }

  // Create run state
  const runId = randomUUID()

  const nodeRuns: PipelineNodeRun[] = normalizedNodes.map((n) => ({
    nodeId: n.id,
    status: 'pending' as PipelineNodeStatus
  }))

  const run: PipelineRun = {
    runId,
    pipelineId,
    pipelineName: pipeline.name,
    targetId,
    status: 'running',
    nodes: nodeRuns,
    startedAt: new Date().toISOString()
  }

  const activeRun: ActivePipelineRun = {
    run,
    target,
    nodeMap,
    edges,
    downstream,
    inDegree: new Map(inDegree),
    nodeResults: new Map(),
    nodeExtracted: new Map(),
    variables: new Map(),
    scanIds: new Set(),
    aborted: false
  }

  activeRuns.set(runId, activeRun)
  sendProgress(run)

  // Execute nodes asynchronously
  runPipelineNodes(activeRun).catch((err) => {
    console.error(`Pipeline ${runId} failed unexpectedly:`, err)
    activeRun.run.status = 'failed'
    activeRun.run.completedAt = new Date().toISOString()
    sendProgress(activeRun.run)
    activeRuns.delete(runId)
  })

  return { runId }
}

// ---------------------------------------------------------------------------
// Graph execution (modified Kahn's topological sort)
// ---------------------------------------------------------------------------

async function runPipelineNodes(activeRun: ActivePipelineRun): Promise<void> {
  const { run, inDegree, downstream } = activeRun

  // Track remaining nodes
  const remaining = new Set(inDegree.keys())
  const completed = new Set<string>()

  while (remaining.size > 0 && !activeRun.aborted) {
    // Find nodes with in-degree 0 (ready to execute)
    const ready: string[] = []
    for (const nodeId of remaining) {
      if ((inDegree.get(nodeId) ?? 0) === 0) {
        ready.push(nodeId)
      }
    }

    if (ready.length === 0) {
      // No ready nodes but some remaining — mark all as skipped
      for (const nodeId of remaining) {
        updateNodeStatus(activeRun, nodeId, 'skipped')
      }
      break
    }

    // Execute all ready nodes in parallel
    await Promise.all(
      ready.map(async (nodeId) => {
        remaining.delete(nodeId)
        await executeNode(activeRun, nodeId)
        completed.add(nodeId)

        // Decrement in-degrees of downstream nodes
        for (const next of downstream.get(nodeId) ?? []) {
          const newDeg = (inDegree.get(next) ?? 1) - 1
          inDegree.set(next, newDeg)
        }
      })
    )
  }

  // Finalize the run
  if (activeRun.aborted) {
    // Mark any remaining pending nodes as skipped
    for (const nr of run.nodes) {
      if (nr.status === 'pending') {
        nr.status = 'skipped'
      }
    }
    run.status = 'cancelled'
  } else {
    const anyFailed = run.nodes.some((n) => n.status === 'failed')
    run.status = anyFailed ? 'failed' : 'completed'
  }

  // Snapshot variables into run for debug visibility
  run.variables = Object.fromEntries(activeRun.variables)

  run.completedAt = new Date().toISOString()
  sendProgress(run)

  // Cache completed run so CLI polling can still read it after activeRuns cleanup
  completedRuns.set(run.runId, { ...run })
  activeRuns.delete(run.runId)

  // Auto-expire from cache after 30 seconds
  setTimeout(() => completedRuns.delete(run.runId), 30_000)
}

// ---------------------------------------------------------------------------
// Per-node execution dispatch
// ---------------------------------------------------------------------------

async function executeNode(
  activeRun: ActivePipelineRun,
  nodeId: string,
  item?: unknown
): Promise<void> {
  if (activeRun.aborted) return

  const node = activeRun.nodeMap.get(nodeId)
  if (!node) return

  // Check if this node was already handled (e.g., by ForEach loop or conditional branch)
  const nodeRun = activeRun.run.nodes.find((n) => n.nodeId === nodeId)
  if (nodeRun && nodeRun.status !== 'pending') return

  switch (node.type) {
    case 'start':
      await executeStartNode(activeRun, nodeId)
      break
    case 'note':
      // Notes are no-ops
      updateNodeStatus(activeRun, nodeId, 'completed')
      break
    case 'delay':
      await executeDelayNode(activeRun, nodeId, node.config as DelayNodeConfig)
      break
    case 'tool':
      await executeToolNode(activeRun, nodeId, node.config as ToolNodeConfig, item)
      break
    case 'condition':
      await executeConditionNode(activeRun, nodeId, node.config as ConditionNodeConfig)
      break
    case 'for-each':
      await executeForEachNode(activeRun, nodeId, node.config as ForEachNodeConfig)
      break
    case 'shell':
      await executeShellNode(activeRun, nodeId, node.config as ShellNodeConfig)
      break
    case 'prompt':
      await executePromptNode(activeRun, nodeId, node.config as PromptNodeConfig)
      break
    case 'set-variable':
      await executeSetVariableNode(activeRun, nodeId, node.config as SetVariableNodeConfig)
      break
  }
}

async function executeStartNode(
  activeRun: ActivePipelineRun,
  nodeId: string
): Promise<void> {
  updateNodeStatus(activeRun, nodeId, 'running')
  // Start node just sets context — nothing to execute
  updateNodeStatus(activeRun, nodeId, 'completed')
}

async function executeDelayNode(
  activeRun: ActivePipelineRun,
  nodeId: string,
  config: DelayNodeConfig
): Promise<void> {
  updateNodeStatus(activeRun, nodeId, 'running')
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, (config.seconds ?? 0) * 1000)
    // Check abort periodically
    const check = setInterval(() => {
      if (activeRun.aborted) {
        clearTimeout(timer)
        clearInterval(check)
        resolve()
      }
    }, 500)
    // Cleanup interval when timer fires
    setTimeout(() => clearInterval(check), (config.seconds ?? 0) * 1000 + 100)
  })
  if (!activeRun.aborted) {
    updateNodeStatus(activeRun, nodeId, 'completed')
  }
}

async function executeToolNode(
  activeRun: ActivePipelineRun,
  nodeId: string,
  config: ToolNodeConfig,
  item?: unknown
): Promise<void> {
  const { target, nodeResults, nodeExtracted, variables } = activeRun

  // Reset node status to pending so it can re-run in ForEach iterations
  const nodeRun = activeRun.run.nodes.find((n) => n.nodeId === nodeId)
  if (nodeRun) nodeRun.status = 'pending'

  updateNodeStatus(activeRun, nodeId, 'running')

  try {
    const mod = await getModule(config.toolId)
    if (!mod) throw new Error(`Module not found: ${config.toolId}`)
    if (mod.executionMode === 'reference') {
      throw new Error(`Module "${config.toolId}" is reference-mode and cannot be executed locally`)
    }

    // Resolve args: apply data mappings from incoming edges, then static args
    const resolvedArgs: Record<string, unknown> = {}

    // Apply data mappings from incoming edges
    const incomingEdges = activeRun.edges.filter((e) => e.target === nodeId)
    for (const edge of incomingEdges) {
      if (edge.dataMappings) {
        for (const mapping of edge.dataMappings) {
          const val = resolveTemplate(
            `\${${mapping.sourceExpression}}`,
            target,
            nodeResults,
            nodeExtracted,
            item,
            variables
          )
          resolvedArgs[mapping.targetArg] = val
        }
      }
      // Legacy dataMapping support
      if (edge.dataMapping) {
        for (const [targetArg, sourceExpr] of Object.entries(edge.dataMapping)) {
          const val = resolveTemplate(
            `\${${sourceExpr}}`,
            target,
            nodeResults,
            nodeExtracted,
            item,
            variables
          )
          resolvedArgs[targetArg] = val
        }
      }
    }

    // Apply static args (override mapped values)
    for (const [key, val] of Object.entries(config.args)) {
      if (typeof val === 'string' && val.includes('${')) {
        resolvedArgs[key] = resolveTemplate(val, target, nodeResults, nodeExtracted, item, variables)
      } else {
        resolvedArgs[key] = val
      }
    }

    // Build CLI args
    const cliArgs = buildCommandArgs(mod, resolvedArgs)
    const command = [mod.binary, ...cliArgs].join(' ')

    // Create scan record — target_id is 0 when no target
    const db = getDatabase()
    const scan = db.addScan({
      tool_id: config.toolId,
      command,
      target_id: target?.id ?? 0,
      args: JSON.stringify(resolvedArgs),
      status: 'queued'
    })

    db.addCommandHistory({
      scan_id: scan.id,
      command,
      tool_id: config.toolId,
      target_id: target?.id ?? 0
    })

    // Update node run with scan ID
    const nodeRun = activeRun.run.nodes.find((n) => n.nodeId === nodeId)
    if (nodeRun) nodeRun.scanId = scan.id
    activeRun.scanIds.add(scan.id)
    sendProgress(activeRun.run)

    // Execute and wait for completion
    await new Promise<void>((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (activeRun.aborted) {
          clearInterval(checkInterval)
          cancelProcess(scan.id)
          reject(new Error('Pipeline cancelled'))
          return
        }

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
            reject(new Error(currentScan.error_output || `Tool node "${nodeId}" failed`))
          }
        }
      }, 500)

      execute({
        scanId: scan.id,
        binary: mod.binary,
        args: cliArgs,
        cwd: mod.workingDirectory,
        env: mod.environment,
        timeout: (config.timeout ?? mod.timeout ?? 0) * 1000,
        sudo: mod.requiresRoot && !mod.rootOptional,
        shell: mod.shell
      })
    })

    // Parse results
    const parsed = await getScanParsedResults(scan.id)
    nodeResults.set(nodeId, {
      scanId: scan.id,
      status: 'completed',
      parsedResults: parsed
    })

    // Capture output if configured
    if (config.captureOutput) {
      const scanData = db.getScan(scan.id)
      if (scanData?.raw_output_path) {
        try {
          const { readFileSync } = await import('fs')
          const rawOutput = readFileSync(scanData.raw_output_path, 'utf-8')
          const captured = captureOutputValue(rawOutput, config.captureOutput.mode, config.captureOutput.pattern)
          variables.set(config.captureOutput.variable, captured)
          // Also store output in step data
          const stepData = nodeResults.get(nodeId)
          if (stepData) stepData.output = rawOutput
        } catch {
          // Ignore output read errors
        }
      }
    }

    updateNodeStatus(activeRun, nodeId, 'completed')
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)

    nodeResults.set(nodeId, {
      scanId: 0,
      status: 'failed',
      parsedResults: null
    })

    const onFailure: StepFailureAction = config.onFailure ?? 'skip'

    if (onFailure === 'retry') {
      try {
        await executeToolNode(activeRun, nodeId, { ...config, onFailure: 'skip' }, item)
        return
      } catch {
        // Retry failed, fall through
      }
    }

    if (onFailure === 'abort') {
      updateNodeStatus(activeRun, nodeId, 'failed', errorMsg)
      activeRun.aborted = true
      return
    }

    // Default: mark failed, skip exclusive dependents
    updateNodeStatus(activeRun, nodeId, 'failed', errorMsg)
    skipExclusiveDependents(activeRun, nodeId)
  }
}

async function executeConditionNode(
  activeRun: ActivePipelineRun,
  nodeId: string,
  config: ConditionNodeConfig
): Promise<void> {
  const { target, nodeResults, nodeExtracted, edges, variables } = activeRun

  updateNodeStatus(activeRun, nodeId, 'running')

  try {
    const result = evaluateCondition(config.expression, target, nodeResults, nodeExtracted, variables)

    // Determine which branch to take
    const rejectedHandle = result ? 'false' : 'true'

    // Find edges from the rejected handle and recursively skip those nodes
    const rejectedEdges = edges.filter(
      (e) => e.source === nodeId && e.sourceHandle === rejectedHandle
    )

    for (const edge of rejectedEdges) {
      skipNodeAndExclusiveDependents(activeRun, edge.target, nodeId)
    }

    updateNodeStatus(activeRun, nodeId, 'completed')
  } catch (err) {
    updateNodeStatus(activeRun, nodeId, 'failed', (err as Error).message)
  }
}

async function executeForEachNode(
  activeRun: ActivePipelineRun,
  nodeId: string,
  config: ForEachNodeConfig
): Promise<void> {
  const { target, nodeResults, nodeExtracted, variables } = activeRun

  updateNodeStatus(activeRun, nodeId, 'running')

  try {
    const items = resolveTemplate(
      `\${${config.expression}}`,
      target,
      nodeResults,
      nodeExtracted,
      undefined,
      variables
    )

    if (!Array.isArray(items) || items.length === 0) {
      // No items — skip body nodes since they won't be executed
      const loopBodyEdges = activeRun.edges.filter((e) => e.source === nodeId)
      for (const edge of loopBodyEdges) {
        skipNodeAndExclusiveDependents(activeRun, edge.target, nodeId)
      }
      updateNodeStatus(activeRun, nodeId, 'completed')
      return
    }

    // Find the loop body — downstream nodes directly connected
    const loopBodyEdges = activeRun.edges.filter((e) => e.source === nodeId)
    const loopBodyNodeIds = loopBodyEdges.map((e) => e.target)

    // Execute body nodes for each item, passing the current item for template resolution
    const executeItem = async (currentItem: unknown): Promise<void> => {
      const itemVar = config.itemVariable || 'item'
      // Also store the item in extracted vars so it can be referenced via ${nodes.forEachId.itemVar}
      const extractedForItem = { ...(nodeExtracted.get(nodeId) ?? {}), [itemVar]: currentItem }
      nodeExtracted.set(nodeId, extractedForItem)

      for (const bodyNodeId of loopBodyNodeIds) {
        if (activeRun.aborted) break
        const bodyNode = activeRun.nodeMap.get(bodyNodeId)
        if (!bodyNode) continue
        if (bodyNode.type === 'tool') {
          await executeToolNode(activeRun, bodyNodeId, bodyNode.config as ToolNodeConfig, currentItem)
        } else {
          await executeNode(activeRun, bodyNodeId, currentItem)
        }
      }
    }

    if (config.parallel) {
      await Promise.all(items.map(executeItem))
    } else {
      for (const currentItem of items) {
        if (activeRun.aborted) break
        await executeItem(currentItem)
      }
    }

    updateNodeStatus(activeRun, nodeId, 'completed')
  } catch (err) {
    updateNodeStatus(activeRun, nodeId, 'failed', (err as Error).message)
  }
}

// ---------------------------------------------------------------------------
// New node type executors
// ---------------------------------------------------------------------------

async function executeShellNode(
  activeRun: ActivePipelineRun,
  nodeId: string,
  config: ShellNodeConfig
): Promise<void> {
  const { target, nodeResults, nodeExtracted, variables } = activeRun

  updateNodeStatus(activeRun, nodeId, 'running')

  try {
    // Resolve templates in the command string
    const command = String(
      resolveTemplate(config.command, target, nodeResults, nodeExtracted, undefined, variables)
    )

    const cwd = config.cwd
      ? String(resolveTemplate(config.cwd, target, nodeResults, nodeExtracted, undefined, variables))
      : undefined

    const timeoutMs = (config.timeout ?? 0) * 1000 || undefined

    // Log to command_history
    try {
      const db = getDatabase()
      db.addCommandHistory({
        scan_id: 0,
        command,
        tool_id: 'shell',
        target_id: target?.id ?? 0
      })
    } catch {
      // Non-fatal
    }

    // Execute the shell command
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: timeoutMs,
      shell: '/bin/sh',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    })

    const output = stdout || ''

    // Store output in results
    nodeResults.set(nodeId, {
      scanId: 0,
      status: 'completed',
      parsedResults: null,
      output
    })

    // Capture output if configured
    if (config.captureOutput) {
      const captured = captureOutputValue(output, config.captureOutput.mode, config.captureOutput.pattern)
      variables.set(config.captureOutput.variable, captured)
    }

    if (stderr) {
      // stderr is not an error by itself, but log it
      console.warn(`Shell node ${nodeId} stderr:`, stderr.slice(0, 500))
    }

    updateNodeStatus(activeRun, nodeId, 'completed')
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    nodeResults.set(nodeId, { scanId: 0, status: 'failed', parsedResults: null })

    const onFailure: StepFailureAction = config.onFailure ?? 'skip'

    if (onFailure === 'abort') {
      updateNodeStatus(activeRun, nodeId, 'failed', errorMsg)
      activeRun.aborted = true
      return
    }

    updateNodeStatus(activeRun, nodeId, 'failed', errorMsg)
    if (onFailure === 'skip') {
      skipExclusiveDependents(activeRun, nodeId)
    }
  }
}

async function executePromptNode(
  activeRun: ActivePipelineRun,
  nodeId: string,
  config: PromptNodeConfig
): Promise<void> {
  const { target, nodeResults, nodeExtracted, variables, run } = activeRun

  updateNodeStatus(activeRun, nodeId, 'running')

  try {
    // Resolve templates in the message
    const message = String(
      resolveTemplate(config.message, target, nodeResults, nodeExtracted, undefined, variables)
    )

    const resolvedConfig: PromptNodeConfig = { ...config, message }

    let response: string | boolean

    if (promptResolver) {
      // Use injected resolver (for CLI mode or custom resolvers)
      response = await promptResolver(resolvedConfig, run.runId, nodeId)
    } else {
      // Default: send IPC event and wait for response from renderer
      const win = windowGetter?.()
      if (!win || win.isDestroyed()) {
        throw new Error('No window available for prompt')
      }

      win.webContents.send('pipeline:prompt', {
        runId: run.runId,
        nodeId,
        message: resolvedConfig.message,
        type: resolvedConfig.type,
        options: resolvedConfig.options,
        default: resolvedConfig.default
      })

      // Wait for response
      response = await new Promise<string | boolean>((resolve, reject) => {
        const key = `${run.runId}:${nodeId}`
        pendingPrompts.set(key, resolve)

        // Timeout handling
        if (config.timeout && config.timeout > 0) {
          setTimeout(() => {
            if (pendingPrompts.has(key)) {
              pendingPrompts.delete(key)
              if (config.default !== undefined) {
                resolve(config.type === 'confirm' ? config.default === 'true' : config.default)
              } else {
                reject(new Error('Prompt timed out'))
              }
            }
          }, config.timeout * 1000)
        }

        // Abort handling
        const abortCheck = setInterval(() => {
          if (activeRun.aborted) {
            clearInterval(abortCheck)
            pendingPrompts.delete(key)
            reject(new Error('Pipeline cancelled'))
          }
        }, 500)

        // Clean up interval when resolved
        const originalResolve = pendingPrompts.get(key)!
        pendingPrompts.set(key, (val) => {
          clearInterval(abortCheck)
          originalResolve(val)
        })
      })
    }

    // Store response in variables
    variables.set(config.variable, response)

    nodeResults.set(nodeId, {
      scanId: 0,
      status: 'completed',
      parsedResults: null,
      output: String(response)
    })

    updateNodeStatus(activeRun, nodeId, 'completed')
  } catch (err) {
    updateNodeStatus(activeRun, nodeId, 'failed', (err as Error).message)
  }
}

async function executeSetVariableNode(
  activeRun: ActivePipelineRun,
  nodeId: string,
  config: SetVariableNodeConfig
): Promise<void> {
  const { target, nodeResults, nodeExtracted, variables } = activeRun

  updateNodeStatus(activeRun, nodeId, 'running')

  try {
    // Resolve templates in the value expression
    const value = resolveTemplate(config.value, target, nodeResults, nodeExtracted, undefined, variables)

    variables.set(config.variable, value)

    nodeResults.set(nodeId, {
      scanId: 0,
      status: 'completed',
      parsedResults: null,
      output: String(value)
    })

    updateNodeStatus(activeRun, nodeId, 'completed')
  } catch (err) {
    updateNodeStatus(activeRun, nodeId, 'failed', (err as Error).message)
  }
}

// ---------------------------------------------------------------------------
// Skip logic
// ---------------------------------------------------------------------------

/**
 * Skip downstream nodes that are exclusively dependent on a failed node.
 * A node is skipped only if ALL of its incoming edges originate from
 * already-skipped or failed nodes.
 */
function skipExclusiveDependents(activeRun: ActivePipelineRun, failedNodeId: string): void {
  const { downstream, edges, run } = activeRun

  const toCheck = [...(downstream.get(failedNodeId) ?? [])]

  while (toCheck.length > 0) {
    const nodeId = toCheck.shift()!
    const nodeRun = run.nodes.find((n) => n.nodeId === nodeId)
    if (!nodeRun || nodeRun.status !== 'pending') continue

    // Check if all incoming edges are from skipped/failed nodes
    const incomingEdges = edges.filter((e) => e.target === nodeId)
    const allSkipped = incomingEdges.every((e) => {
      const sourceRun = run.nodes.find((n) => n.nodeId === e.source)
      return sourceRun && (sourceRun.status === 'skipped' || sourceRun.status === 'failed')
    })

    if (allSkipped) {
      updateNodeStatus(activeRun, nodeId, 'skipped')
      // Also check this node's dependents
      toCheck.push(...(downstream.get(nodeId) ?? []))
    }
  }
}

/**
 * Skip a specific node and its exclusive dependents, but only if
 * no other non-skipped path leads to it.
 */
function skipNodeAndExclusiveDependents(
  activeRun: ActivePipelineRun,
  nodeId: string,
  fromNodeId: string
): void {
  const { edges, run } = activeRun

  const nodeRun = run.nodes.find((n) => n.nodeId === nodeId)
  if (!nodeRun || nodeRun.status !== 'pending') return

  // Check if this node has other incoming edges from non-skipped nodes
  const incomingEdges = edges.filter((e) => e.target === nodeId)
  const hasAlternativePath = incomingEdges.some((e) => {
    if (e.source === fromNodeId) return false
    const sourceRun = run.nodes.find((n) => n.nodeId === e.source)
    return sourceRun && sourceRun.status !== 'skipped' && sourceRun.status !== 'failed'
  })

  if (!hasAlternativePath) {
    updateNodeStatus(activeRun, nodeId, 'skipped')
    // Set in-degree to a high value so the main loop doesn't pick it up
    activeRun.inDegree.set(nodeId, 999)
    skipExclusiveDependents(activeRun, nodeId)
  }
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

export function cancelPipeline(runId: string): void {
  const activeRun = activeRuns.get(runId)
  if (!activeRun) return

  activeRun.aborted = true

  // Cancel all running scans
  for (const scanId of activeRun.scanIds) {
    if (isRunning(scanId)) {
      cancelProcess(scanId)
    }
  }

  // Mark remaining pending nodes as skipped
  for (const nodeRun of activeRun.run.nodes) {
    if (nodeRun.status === 'pending' || nodeRun.status === 'running') {
      nodeRun.status = 'skipped'
    }
  }

  activeRun.run.status = 'cancelled'
  activeRun.run.completedAt = new Date().toISOString()
  sendProgress(activeRun.run)
  activeRuns.delete(runId)
}

// ---------------------------------------------------------------------------
// Status query
// ---------------------------------------------------------------------------

export function getPipelineRunStatus(runId: string): PipelineRun | null {
  const activeRun = activeRuns.get(runId)
  if (activeRun) return activeRun.run
  // Check completed runs cache (for CLI polling that may miss fast-completing runs)
  return completedRuns.get(runId) ?? null
}

// ---------------------------------------------------------------------------
// Node normalization (v1 → v2)
// ---------------------------------------------------------------------------

function normalizeNodes(def: PipelineDefinition): PipelineNodeV2[] {
  return def.nodes.map((node) => {
    if (isV2Node(node)) return node

    // V1 node — convert to V2 tool node
    const v1 = node as PipelineNodeV1
    return {
      id: v1.id,
      type: 'tool' as PipelineNodeType,
      config: {
        toolId: v1.toolId,
        args: v1.args
      },
      position: v1.position
    }
  })
}

function isV2Node(node: PipelineNode): node is PipelineNodeV2 {
  return 'type' in node && typeof (node as PipelineNodeV2).type === 'string' && 'config' in node
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function updateNodeStatus(
  activeRun: ActivePipelineRun,
  nodeId: string,
  status: PipelineNodeStatus,
  error?: string
): void {
  const nodeRun = activeRun.run.nodes.find((n) => n.nodeId === nodeId)
  if (nodeRun) {
    nodeRun.status = status
    if (error) nodeRun.error = error
    if (status === 'running') nodeRun.startedAt = new Date().toISOString()
    if (status === 'completed' || status === 'failed' || status === 'skipped') {
      nodeRun.completedAt = new Date().toISOString()
    }
  }
  sendProgress(activeRun.run)
}

function sendProgress(run: PipelineRun): void {
  const win = windowGetter?.()
  if (win && !win.isDestroyed()) {
    win.webContents.send('pipeline:node-status', run)
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function cleanupPipelineEngine(): void {
  for (const [runId] of activeRuns) {
    cancelPipeline(runId)
  }
  completedRuns.clear()
  windowGetter = null
  promptResolver = null
  pendingPrompts.clear()
}
