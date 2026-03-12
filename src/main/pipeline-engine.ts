/**
 * Pipeline execution engine — executes visual pipeline definitions by
 * traversing the node graph in topological order.
 *
 * Domain-agnostic: delegates tool execution to the process manager and
 * module loader. No tool names or pentest concepts here.
 */

import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import { getModule } from './module-loader'
import { getDatabase } from './workspace-manager'
import { execute, cancel as cancelProcess, isRunning } from './process-manager'
import { buildCommandArgs } from './ipc/tool-handlers'
import { getScanParsedResults } from './scan-result-store'
import {
  resolveTemplate,
  evaluateCondition,
  type StepResultData
} from './template-resolver'
import type { Target } from '@shared/types/target'
import type {
  Pipeline,
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
  StepFailureAction,
  DataMappingEntry
} from '@shared/types/pipeline'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let windowGetter: (() => BrowserWindow | null) | null = null

const activeRuns = new Map<string, ActivePipelineRun>()

interface ActivePipelineRun {
  run: PipelineRun
  target: Target
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
  /** Scan IDs owned by this pipeline run, for cancellation */
  scanIds: Set<number>
  /** Abort signal */
  aborted: boolean
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initPipelineEngine(getWindow: () => BrowserWindow | null): void {
  windowGetter = getWindow
}

// ---------------------------------------------------------------------------
// Pipeline execution
// ---------------------------------------------------------------------------

export async function executePipeline(
  pipelineId: number,
  targetId: number
): Promise<{ runId: string }> {
  const db = getDatabase()
  const pipeline = db.getPipeline(pipelineId)
  if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`)

  const target = db.getTarget(targetId)
  if (!target) throw new Error(`Target not found: ${targetId}`)

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

  run.completedAt = new Date().toISOString()
  sendProgress(run)
  activeRuns.delete(run.runId)
}

// ---------------------------------------------------------------------------
// Per-node execution dispatch
// ---------------------------------------------------------------------------

async function executeNode(
  activeRun: ActivePipelineRun,
  nodeId: string
): Promise<void> {
  if (activeRun.aborted) return

  const node = activeRun.nodeMap.get(nodeId)
  if (!node) return

  // Check if this node was already skipped (e.g., by conditional branch)
  const nodeRun = activeRun.run.nodes.find((n) => n.nodeId === nodeId)
  if (nodeRun && nodeRun.status === 'skipped') return

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
      await executeToolNode(activeRun, nodeId, node.config as ToolNodeConfig)
      break
    case 'condition':
      await executeConditionNode(activeRun, nodeId, node.config as ConditionNodeConfig)
      break
    case 'for-each':
      await executeForEachNode(activeRun, nodeId, node.config as ForEachNodeConfig)
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
  config: ToolNodeConfig
): Promise<void> {
  const { target, nodeResults, nodeExtracted } = activeRun

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
            nodeExtracted
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
            nodeExtracted
          )
          resolvedArgs[targetArg] = val
        }
      }
    }

    // Apply static args (override mapped values)
    for (const [key, val] of Object.entries(config.args)) {
      if (typeof val === 'string' && val.includes('${')) {
        resolvedArgs[key] = resolveTemplate(val, target, nodeResults, nodeExtracted)
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
      tool_id: config.toolId,
      command,
      target_id: target.id,
      args: JSON.stringify(resolvedArgs),
      status: 'queued'
    })

    db.addCommandHistory({
      scan_id: scan.id,
      command,
      tool_id: config.toolId,
      target_id: target.id
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
        await executeToolNode(activeRun, nodeId, { ...config, onFailure: 'skip' })
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
  const { target, nodeResults, nodeExtracted, edges } = activeRun

  updateNodeStatus(activeRun, nodeId, 'running')

  try {
    const result = evaluateCondition(config.expression, target, nodeResults, nodeExtracted)

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
  const { target, nodeResults, nodeExtracted } = activeRun

  updateNodeStatus(activeRun, nodeId, 'running')

  try {
    const items = resolveTemplate(
      `\${${config.expression}}`,
      target,
      nodeResults,
      nodeExtracted
    )

    if (!Array.isArray(items) || items.length === 0) {
      updateNodeStatus(activeRun, nodeId, 'completed')
      return
    }

    // Find the loop body — downstream tool nodes directly connected
    const loopBodyEdges = activeRun.edges.filter((e) => e.source === nodeId)
    const loopBodyNodeIds = loopBodyEdges.map((e) => e.target)

    // Execute tool nodes for each item
    const executeItem = async (item: unknown): Promise<void> => {
      const itemVar = config.itemVariable || 'item'
      // Store the current item in extracted vars under the for-each node's ID
      const extractedForItem = { ...(nodeExtracted.get(nodeId) ?? {}), [itemVar]: item }
      nodeExtracted.set(nodeId, extractedForItem)

      for (const bodyNodeId of loopBodyNodeIds) {
        if (activeRun.aborted) break
        const bodyNode = activeRun.nodeMap.get(bodyNodeId)
        if (bodyNode?.type === 'tool') {
          await executeToolNode(activeRun, bodyNodeId, bodyNode.config as ToolNodeConfig)
        }
      }
    }

    if (config.parallel) {
      await Promise.all(items.map(executeItem))
    } else {
      for (const item of items) {
        if (activeRun.aborted) break
        await executeItem(item)
      }
    }

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
  return activeRun?.run ?? null
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
  windowGetter = null
}
