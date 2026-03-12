import { useState, useEffect, useCallback } from 'react'
import {
  Play,
  ArrowLeft,
  Clock,
  ShieldAlert,
  ChevronRight,
  Radar,
  Globe,
  Chrome,
  Zap,
  Key,
  Database,
  Radio,
  ShieldOff,
  Terminal,
  GitBranch,
  Wrench,
  Workflow as WorkflowIcon,
  type LucideIcon,
} from 'lucide-react'
import { useWorkflowStore } from '../../stores/workflow-store'
import { useTargetStore } from '../../stores/target-store'
import { useUiStore } from '../../stores/ui-store'
import { usePipelineStore } from '../../stores/pipeline-store'
import { Button, Badge, EmptyState } from '../common'
import { WorkflowConfirm } from './WorkflowConfirm'
import type { Workflow } from '@shared/types/pipeline'
import type {
  PipelineDefinition,
  PipelineNodeV2,
  PipelineEdge,
} from '@shared/types/pipeline'

const iconMap: Record<string, LucideIcon> = {
  radar: Radar,
  globe: Globe,
  chrome: Chrome,
  zap: Zap,
  key: Key,
  database: Database,
  radio: Radio,
  'shield-off': ShieldOff,
  terminal: Terminal,
  'git-branch': GitBranch,
  tool: Wrench,
  play: Play,
}

interface WorkflowViewProps {
  workflowId: string
}

export function WorkflowView({ workflowId }: WorkflowViewProps) {
  const navigate = useUiStore((s) => s.navigate)
  const activeTargetId = useTargetStore((s) => s.activeTargetId)
  const targets = useTargetStore((s) => s.targets)
  const { executeWorkflow } = useWorkflowStore()

  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [executing, setExecuting] = useState(false)

  const activeTarget = targets.find((t) => t.id === activeTargetId)

  useEffect(() => {
    setLoading(true)
    setError(null)
    useWorkflowStore
      .getState()
      .getWorkflow(workflowId)
      .then(setWorkflow)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [workflowId])

  const handleExecute = useCallback(
    async (options: {
      disabledSteps: string[]
      argOverrides: Record<string, Record<string, unknown>>
    }) => {
      if (!activeTargetId || !workflow) return
      setExecuting(true)
      try {
        const runId = await executeWorkflow(workflow.id, activeTargetId, {
          disabledSteps: options.disabledSteps,
          argOverrides: options.argOverrides,
        })
        setConfirmOpen(false)
        navigate('workflow-run', { runId })
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setExecuting(false)
      }
    },
    [activeTargetId, workflow, executeWorkflow, navigate]
  )

  const handleEditAsPipeline = useCallback(() => {
    if (!workflow) return

    const STEP_Y_SPACING = 120
    const X_CENTER = 400

    // Build pipeline definition from workflow steps
    const pipelineNodes: PipelineNodeV2[] = []
    const pipelineEdges: PipelineEdge[] = []

    // Create start node
    const startNodeId = 'start_node'
    pipelineNodes.push({
      id: startNodeId,
      type: 'start',
      config: { targetSource: 'selected', label: workflow.name },
      position: { x: X_CENTER, y: 0 },
    })

    // Create nodes for each step
    const stepNodeMap = new Map<string, string>()
    workflow.steps.forEach((step, i) => {
      const nodeId = `step_${step.id}`
      stepNodeMap.set(step.id, nodeId)

      if (step.condition) {
        // Create a condition node, then a tool node
        const condNodeId = `cond_${step.id}`
        pipelineNodes.push({
          id: condNodeId,
          type: 'condition',
          config: { expression: step.condition, label: `Check: ${step.name}` },
          position: { x: X_CENTER, y: (i + 1) * STEP_Y_SPACING },
        })
        pipelineNodes.push({
          id: nodeId,
          type: 'tool',
          config: {
            toolId: step.tool,
            args: step.args ?? {},
            onFailure: step.on_failure,
            timeout: step.timeout,
          },
          position: { x: X_CENTER + 200, y: (i + 1) * STEP_Y_SPACING + 60 },
        })
        // Condition true → tool node
        pipelineEdges.push({
          id: `e_${condNodeId}_${nodeId}`,
          source: condNodeId,
          target: nodeId,
          sourceHandle: 'true',
        })
        // Remap so dependencies point to the condition node
        stepNodeMap.set(step.id, condNodeId)
      } else if (step.for_each) {
        // Create a for-each node, then a tool node
        const feNodeId = `fe_${step.id}`
        pipelineNodes.push({
          id: feNodeId,
          type: 'for-each',
          config: { expression: step.for_each, parallel: step.parallel ?? false },
          position: { x: X_CENTER, y: (i + 1) * STEP_Y_SPACING },
        })
        pipelineNodes.push({
          id: nodeId,
          type: 'tool',
          config: {
            toolId: step.tool,
            args: step.args ?? {},
            onFailure: step.on_failure,
            timeout: step.timeout,
          },
          position: { x: X_CENTER, y: (i + 1) * STEP_Y_SPACING + 80 },
        })
        pipelineEdges.push({
          id: `e_${feNodeId}_${nodeId}`,
          source: feNodeId,
          target: nodeId,
        })
        stepNodeMap.set(step.id, feNodeId)
      } else {
        pipelineNodes.push({
          id: nodeId,
          type: 'tool',
          config: {
            toolId: step.tool,
            args: step.args ?? {},
            onFailure: step.on_failure,
            timeout: step.timeout,
          },
          position: { x: X_CENTER, y: (i + 1) * STEP_Y_SPACING },
        })
      }
    })

    // Create edges from depends_on
    let edgeCounter = 0
    for (const step of workflow.steps) {
      const targetNodeId = stepNodeMap.get(step.id)
      if (!targetNodeId) continue

      const deps = step.depends_on
        ? Array.isArray(step.depends_on)
          ? step.depends_on
          : [step.depends_on]
        : []

      if (deps.length === 0) {
        // No dependency — connect from start node
        const existingEdge = pipelineEdges.find(
          (e) => e.target === targetNodeId
        )
        if (!existingEdge) {
          pipelineEdges.push({
            id: `e_auto_${edgeCounter++}`,
            source: startNodeId,
            target: targetNodeId,
          })
        }
      } else {
        for (const dep of deps) {
          const sourceNodeId = stepNodeMap.get(dep)
          if (!sourceNodeId) continue
          // Find the actual tool node (not condition/foreach wrapper) for the source
          const actualSource = pipelineNodes.find(
            (n) => n.id === `step_${dep}` && n.type === 'tool'
          )?.id ?? sourceNodeId
          pipelineEdges.push({
            id: `e_auto_${edgeCounter++}`,
            source: actualSource,
            target: targetNodeId,
          })
        }
      }
    }

    const def: PipelineDefinition = {
      version: 2,
      nodes: pipelineNodes,
      edges: pipelineEdges,
    }

    // Create an unsaved pipeline and navigate to the builder
    const fakePipeline = {
      id: -1,
      name: `${workflow.name} (from workflow)`,
      description: workflow.description,
      definition: JSON.stringify(def),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    usePipelineStore.getState().setActivePipeline(fakePipeline)
    navigate('pipeline-builder', {})
  }, [workflow, navigate])

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-4 w-96 rounded" />
        <div className="space-y-2 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <EmptyState
        title="Workflow not found"
        description={error ?? `No workflow with ID "${workflowId}"`}
        action={
          <Button variant="secondary" onClick={() => navigate('workflow-view', {})}>
            Back to Workflows
          </Button>
        }
      />
    )
  }

  const Icon = iconMap[workflow.icon ?? ''] ?? Play

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('workflow-view', {})}
            className="p-1 mt-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
            title="Back to workflows"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="p-2.5 rounded-lg bg-bg-base border border-border">
            <Icon className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">{workflow.name}</h1>
            <p className="text-xs text-text-secondary mt-1 max-w-lg leading-relaxed">
              {workflow.description}
            </p>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted">
              {workflow.category && (
                <span className="capitalize">{workflow.category}</span>
              )}
              <span className="flex items-center gap-1">
                <Play className="w-3 h-3" />
                {workflow.steps.length} steps
              </span>
              {workflow.estimatedDuration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {workflow.estimatedDuration}
                </span>
              )}
              {workflow.requiresRoot && (
                <span className="flex items-center gap-1 text-warning">
                  <ShieldAlert className="w-3 h-3" />
                  Requires root
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => handleEditAsPipeline()}
            title="Convert to an editable pipeline in the Pipeline Builder"
          >
            <WorkflowIcon className="w-3.5 h-3.5 mr-1" />
            Edit as Pipeline
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!activeTargetId}
            title={!activeTargetId ? 'Select a target first' : undefined}
          >
            <Play className="w-3.5 h-3.5 mr-1" />
            Run Workflow
          </Button>
        </div>
      </div>

      {/* Target indicator */}
      {activeTarget ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-bg-base border border-border">
          <span className="text-[11px] text-text-muted">Target:</span>
          <span className="text-xs text-accent font-mono">{activeTarget.value}</span>
          {activeTarget.label && (
            <span className="text-[11px] text-text-muted">({activeTarget.label})</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-warning/10 border border-warning/20">
          <ShieldAlert className="w-3.5 h-3.5 text-warning" />
          <span className="text-xs text-warning">
            Select a target before running this workflow
          </span>
        </div>
      )}

      {/* Steps preview */}
      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          Workflow Steps
        </h2>
        <div className="space-y-2">
          {workflow.steps.map((step, i) => {
            const deps = step.depends_on
              ? Array.isArray(step.depends_on)
                ? step.depends_on
                : [step.depends_on]
              : []
            return (
              <div
                key={step.id}
                className="border border-border rounded-lg px-4 py-3 hover:border-border-bright transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-primary">
                        {step.name}
                      </span>
                      {step.optional && <Badge variant="default">optional</Badge>}
                      {step.on_failure === 'skip' && (
                        <Badge variant="default">skip on fail</Badge>
                      )}
                    </div>
                    {step.description && (
                      <p className="text-[11px] text-text-secondary mt-1 line-clamp-2">
                        {step.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-text-muted font-mono">{step.tool}</span>
                    {deps.length > 0 && (
                      <ChevronRight className="w-3 h-3 text-text-muted" />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Confirm dialog */}
      {activeTarget && (
        <WorkflowConfirm
          workflow={workflow}
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onExecute={handleExecute}
          executing={executing}
          targetValue={activeTarget.value}
        />
      )}
    </div>
  )
}
