import { useEffect, useMemo, useCallback } from 'react'
import {
  Check,
  X,
  Loader2,
  Clock,
  SkipForward,
  ArrowLeft,
  Square,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { useWorkflowStore } from '../../stores/workflow-store'
import { useUiStore } from '../../stores/ui-store'
import { Button, Badge, EmptyState, ProgressBar } from '../common'
import type { Workflow, WorkflowRun, WorkflowStepRun, WorkflowStepStatus } from '@shared/types/pipeline'
import { useState } from 'react'

interface WorkflowProgressProps {
  runId: string
}

function StepStatusIcon({ status }: { status: WorkflowStepStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-4 h-4 text-accent animate-spin" />
    case 'completed':
      return <Check className="w-4 h-4 text-success" />
    case 'failed':
      return <X className="w-4 h-4 text-error" />
    case 'skipped':
      return <SkipForward className="w-4 h-4 text-text-muted" />
    case 'pending':
    default:
      return <Clock className="w-4 h-4 text-text-muted" />
  }
}

function statusLabel(status: WorkflowStepStatus): string {
  switch (status) {
    case 'running':
      return 'Running'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'skipped':
      return 'Skipped'
    case 'pending':
    default:
      return 'Pending'
  }
}

function statusColor(status: WorkflowStepStatus): string {
  switch (status) {
    case 'running':
      return 'text-accent'
    case 'completed':
      return 'text-success'
    case 'failed':
      return 'text-error'
    case 'skipped':
      return 'text-text-muted'
    case 'pending':
    default:
      return 'text-text-muted'
  }
}

interface StepRowProps {
  stepRun: WorkflowStepRun
  stepDef: Workflow['steps'][number] | undefined
  index: number
  onViewResults: (scanId: number) => void
}

function StepRow({ stepRun, stepDef, index, onViewResults }: StepRowProps) {
  const [expanded, setExpanded] = useState(stepRun.status === 'running' || stepRun.status === 'failed')

  return (
    <div
      className={`border rounded-lg transition-colors ${
        stepRun.status === 'running'
          ? 'border-accent/40 bg-accent/5'
          : stepRun.status === 'failed'
            ? 'border-error/40 bg-error/5'
            : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* Step number */}
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
            stepRun.status === 'completed'
              ? 'bg-success/20 text-success'
              : stepRun.status === 'running'
                ? 'bg-accent/20 text-accent'
                : stepRun.status === 'failed'
                  ? 'bg-error/20 text-error'
                  : 'bg-bg-base text-text-muted'
          }`}
        >
          {index + 1}
        </span>

        {/* Status icon */}
        <StepStatusIcon status={stepRun.status} />

        {/* Step name + info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary truncate">
              {stepDef?.name ?? stepRun.id}
            </span>
            <span className={`text-[10px] ${statusColor(stepRun.status)}`}>
              {statusLabel(stepRun.status)}
            </span>
          </div>
          {stepDef && (
            <span className="text-[10px] text-text-muted font-mono">{stepDef.tool}</span>
          )}
        </div>

        {/* View results button */}
        {stepRun.scanId && (stepRun.status === 'completed' || stepRun.status === 'failed') && (
          <button
            onClick={() => onViewResults(stepRun.scanId!)}
            className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors"
            title="View scan results"
          >
            <ExternalLink className="w-3 h-3" />
            Results
          </button>
        )}

        {/* Expand for description/error */}
        {(stepDef?.description || stepRun.error) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded hover:bg-bg-elevated text-text-muted"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-2.5 border-t border-border/50 mt-0">
          {stepRun.error && (
            <div className="mt-2 px-2 py-1.5 rounded bg-error/10 border border-error/20">
              <p className="text-[11px] text-error font-sans">{stepRun.error}</p>
            </div>
          )}
          {stepDef?.description && !stepRun.error && (
            <p className="mt-2 text-[11px] text-text-secondary leading-relaxed">
              {stepDef.description}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function WorkflowProgress({ runId }: WorkflowProgressProps) {
  const { activeRun, runs, setActiveRun, cancelWorkflow } = useWorkflowStore()
  const navigate = useUiStore((s) => s.navigate)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Set active run on mount
  useEffect(() => {
    setActiveRun(runId)
  }, [runId, setActiveRun, runs])

  // Load workflow definition for step names/descriptions
  useEffect(() => {
    if (!activeRun) return
    useWorkflowStore
      .getState()
      .getWorkflow(activeRun.workflowId)
      .then(setWorkflow)
      .catch(() => {})
  }, [activeRun?.workflowId])

  // Subscribe to workflow:step-status IPC events
  useEffect(() => {
    const cleanup = window.api.on('workflow:step-status', (event: unknown) => {
      const run = event as WorkflowRun
      useWorkflowStore.getState().updateRun(run)
    })
    return cleanup
  }, [])

  const handleCancel = useCallback(async () => {
    if (!activeRun) return
    setCancelling(true)
    try {
      await cancelWorkflow(activeRun.runId)
    } finally {
      setCancelling(false)
    }
  }, [activeRun, cancelWorkflow])

  const handleViewResults = useCallback(
    (scanId: number) => {
      navigate('scan-results', { scanId })
    },
    [navigate]
  )

  // Progress calculation
  const progress = useMemo(() => {
    if (!activeRun) return { completed: 0, total: 0, percent: 0 }
    const total = activeRun.steps.length
    const done = activeRun.steps.filter(
      (s) => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
    ).length
    return { completed: done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [activeRun])

  const isFinished =
    activeRun?.status === 'completed' ||
    activeRun?.status === 'failed' ||
    activeRun?.status === 'cancelled'

  const overallStatusBadge = useMemo(() => {
    if (!activeRun) return null
    switch (activeRun.status) {
      case 'running':
        return <Badge variant="accent">Running</Badge>
      case 'completed':
        return <Badge variant="success">Completed</Badge>
      case 'failed':
        return <Badge variant="error">Failed</Badge>
      case 'cancelled':
        return <Badge variant="default">Cancelled</Badge>
    }
  }, [activeRun?.status])

  const duration = useMemo(() => {
    if (!activeRun) return null
    const start = new Date(activeRun.startedAt).getTime()
    const end = activeRun.completedAt ? new Date(activeRun.completedAt).getTime() : Date.now()
    const ms = end - start
    if (ms < 1000) return '<1s'
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  }, [activeRun])

  if (!activeRun) {
    return (
      <EmptyState
        title="Workflow run not found"
        description="This workflow run may have ended or was not found."
        action={
          <Button variant="secondary" onClick={() => navigate('workflow-view', {})}>
            Back to Workflows
          </Button>
        }
      />
    )
  }

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('workflow-view', {})}
            className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
            title="Back to workflows"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-text-primary">
                {workflow?.name ?? activeRun.workflowId}
              </h1>
              {overallStatusBadge}
            </div>
            {duration && (
              <span className="text-[11px] text-text-muted">
                Duration: {duration}
              </span>
            )}
          </div>
        </div>

        {/* Cancel button (only when running) */}
        {activeRun.status === 'running' && (
          <Button
            variant="danger"
            size="sm"
            onClick={handleCancel}
            loading={cancelling}
          >
            <Square className="w-3.5 h-3.5 mr-1" />
            Cancel
          </Button>
        )}

        {/* Done button (when finished) */}
        {isFinished && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('workflow-view', {})}
          >
            Done
          </Button>
        )}
      </div>

      {/* Overall progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-text-secondary">
            Step {progress.completed} of {progress.total}
          </span>
          <span className="text-xs text-text-muted">{progress.percent}%</span>
        </div>
        <ProgressBar
          value={progress.percent}
          max={100}
          variant={
            activeRun.status === 'failed'
              ? 'error'
              : activeRun.status === 'completed'
                ? 'success'
                : 'accent'
          }
          indeterminate={activeRun.status === 'running' && progress.completed === 0}
        />
      </div>

      {/* Steps list */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Steps
        </h2>
        {activeRun.steps.map((stepRun, i) => (
          <StepRow
            key={stepRun.id}
            stepRun={stepRun}
            stepDef={workflow?.steps.find((s) => s.id === stepRun.id)}
            index={i}
            onViewResults={handleViewResults}
          />
        ))}
      </div>

      {/* Completion summary */}
      {isFinished && (
        <div
          className={`rounded-lg border p-4 ${
            activeRun.status === 'completed'
              ? 'border-success/30 bg-success/5'
              : activeRun.status === 'failed'
                ? 'border-error/30 bg-error/5'
                : 'border-border bg-bg-base'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {activeRun.status === 'completed' ? (
              <Check className="w-4 h-4 text-success" />
            ) : activeRun.status === 'failed' ? (
              <X className="w-4 h-4 text-error" />
            ) : (
              <Square className="w-4 h-4 text-text-muted" />
            )}
            <span className="text-sm font-medium text-text-primary">
              Workflow {activeRun.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-text-muted">
            <span>
              {activeRun.steps.filter((s) => s.status === 'completed').length} completed
            </span>
            <span>
              {activeRun.steps.filter((s) => s.status === 'failed').length} failed
            </span>
            <span>
              {activeRun.steps.filter((s) => s.status === 'skipped').length} skipped
            </span>
            {duration && <span>Total: {duration}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
