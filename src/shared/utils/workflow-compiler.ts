/**
 * Workflow compiler — converts workflow YAML definitions into pipeline
 * definitions that the pipeline builder can visualize and execute.
 *
 * This is the "compiler" in the architecture: workflow YAML is the source
 * language, PipelineDefinition is the IR, and the pipeline engine is the runtime.
 *
 * Pure functions, no side effects — usable from both main and renderer.
 */

import type { Workflow, WorkflowStepDefinition } from '../types/pipeline'
import type {
  PipelineDefinition,
  PipelineNodeV2,
  PipelineEdge,
} from '../types/pipeline'

const X_CENTER = 400
const Y_START = 0
const Y_SPACING = 140
const X_BRANCH_OFFSET = 250

/**
 * Compile a workflow definition into a pipeline definition.
 *
 * Creates a Start node, then converts each workflow step into the appropriate
 * pipeline node type (tool, condition+tool, for-each+tool), wiring them up
 * based on `depends_on` relationships.
 */
export function compileWorkflow(workflow: Workflow): PipelineDefinition {
  const nodes: PipelineNodeV2[] = []
  const edges: PipelineEdge[] = []
  let edgeCounter = 0

  const nextEdgeId = (): string => `e_${edgeCounter++}`

  // --- Start node ---
  const startId = '__start__'
  nodes.push({
    id: startId,
    type: 'start',
    config: { targetSource: 'selected', label: workflow.name },
    position: { x: X_CENTER, y: Y_START },
  })

  // --- Build step nodes ---
  // Maps a step ID to the node ID that downstream edges should connect FROM.
  // (For plain steps this is the tool node; for condition-wrapped steps
  //  it's the tool node that sits on the "true" branch, etc.)
  const stepToOutputNode = new Map<string, string>()
  // Maps a step ID to the node ID that incoming dependency edges should target.
  const stepToInputNode = new Map<string, string>()

  workflow.steps.forEach((step, i) => {
    const yPos = (i + 1) * Y_SPACING

    if (step.condition && step.for_each) {
      // Both condition AND for_each — condition gates the for-each
      const condId = `cond_${step.id}`
      const feId = `fe_${step.id}`
      const toolId = `step_${step.id}`

      nodes.push({
        id: condId,
        type: 'condition',
        config: { expression: step.condition, label: `${step.name}?` },
        position: { x: X_CENTER, y: yPos },
      })
      nodes.push({
        id: feId,
        type: 'for-each',
        config: {
          expression: step.for_each,
          parallel: step.parallel ?? false,
        },
        position: { x: X_CENTER + X_BRANCH_OFFSET, y: yPos + 50 },
      })
      nodes.push(makeToolNode(step, toolId, X_CENTER + X_BRANCH_OFFSET, yPos + 120))

      edges.push({ id: nextEdgeId(), source: condId, target: feId, sourceHandle: 'true' })
      edges.push({ id: nextEdgeId(), source: feId, target: toolId })

      stepToInputNode.set(step.id, condId)
      stepToOutputNode.set(step.id, toolId)
    } else if (step.condition) {
      // Condition-gated step
      const condId = `cond_${step.id}`
      const toolId = `step_${step.id}`

      nodes.push({
        id: condId,
        type: 'condition',
        config: { expression: step.condition, label: `${step.name}?` },
        position: { x: X_CENTER, y: yPos },
      })
      nodes.push(makeToolNode(step, toolId, X_CENTER + X_BRANCH_OFFSET, yPos + 60))

      edges.push({ id: nextEdgeId(), source: condId, target: toolId, sourceHandle: 'true' })

      stepToInputNode.set(step.id, condId)
      stepToOutputNode.set(step.id, toolId)
    } else if (step.for_each) {
      // For-each loop step
      const feId = `fe_${step.id}`
      const toolId = `step_${step.id}`

      nodes.push({
        id: feId,
        type: 'for-each',
        config: {
          expression: step.for_each,
          parallel: step.parallel ?? false,
        },
        position: { x: X_CENTER, y: yPos },
      })
      nodes.push(makeToolNode(step, toolId, X_CENTER, yPos + 80))

      edges.push({ id: nextEdgeId(), source: feId, target: toolId })

      stepToInputNode.set(step.id, feId)
      stepToOutputNode.set(step.id, toolId)
    } else {
      // Plain tool step
      const toolId = `step_${step.id}`
      nodes.push(makeToolNode(step, toolId, X_CENTER, yPos))

      stepToInputNode.set(step.id, toolId)
      stepToOutputNode.set(step.id, toolId)
    }
  })

  // --- Wire dependency edges ---
  for (const step of workflow.steps) {
    const targetNodeId = stepToInputNode.get(step.id)
    if (!targetNodeId) continue

    const deps = normalizeDeps(step.depends_on)

    if (deps.length === 0) {
      // No explicit dependency — connect from start node
      edges.push({ id: nextEdgeId(), source: startId, target: targetNodeId })
    } else {
      for (const dep of deps) {
        const sourceNodeId = stepToOutputNode.get(dep)
        if (sourceNodeId) {
          edges.push({ id: nextEdgeId(), source: sourceNodeId, target: targetNodeId })
        }
      }
    }
  }

  return { version: 2, nodes, edges }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToolNode(
  step: WorkflowStepDefinition,
  nodeId: string,
  x: number,
  y: number
): PipelineNodeV2 {
  return {
    id: nodeId,
    type: 'tool',
    config: {
      toolId: step.tool,
      args: step.args ?? {},
      onFailure: step.on_failure,
      timeout: step.timeout,
    },
    position: { x, y },
  }
}

function normalizeDeps(deps: string | string[] | undefined): string[] {
  if (!deps) return []
  if (typeof deps === 'string') return [deps]
  return deps
}
