import { useState, useCallback, useMemo } from 'react'
import {
  Play,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { Button, Badge, Dialog, DialogFooter, Toggle } from '../common'
import type { Workflow, WorkflowStepDefinition } from '@shared/types/pipeline'

interface WorkflowConfirmProps {
  workflow: Workflow
  open: boolean
  onClose: () => void
  onExecute: (options: {
    disabledSteps: string[]
    argOverrides: Record<string, Record<string, unknown>>
  }) => void
  executing: boolean
  targetValue: string
}

interface StepItemProps {
  step: WorkflowStepDefinition
  index: number
  disabled: boolean
  onToggle: (stepId: string) => void
  expanded: boolean
  onToggleExpand: (stepId: string) => void
}

function StepItem({ step, index, disabled, onToggle, expanded, onToggleExpand }: StepItemProps) {
  const deps = step.depends_on
    ? Array.isArray(step.depends_on)
      ? step.depends_on
      : [step.depends_on]
    : []

  return (
    <div
      className={`border border-border rounded-lg overflow-hidden transition-colors ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Step number */}
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
            disabled
              ? 'bg-bg-base text-text-muted'
              : 'bg-accent/20 text-accent'
          }`}
        >
          {index + 1}
        </span>

        {/* Expand toggle */}
        <button
          onClick={() => onToggleExpand(step.id)}
          className="p-0.5 rounded hover:bg-bg-elevated text-text-muted"
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Step name */}
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-text-primary truncate block">
            {step.name}
          </span>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {step.optional && (
            <Badge variant="default">optional</Badge>
          )}
          {step.on_failure === 'abort' && (
            <Badge variant="error">abort on fail</Badge>
          )}
          <span className="text-[10px] text-text-muted font-mono">{step.tool}</span>
        </div>

        {/* Toggle for optional steps */}
        {step.optional && (
          <Toggle
            size="sm"
            checked={!disabled}
            onChange={() => onToggle(step.id)}
          />
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-2 pt-0 border-t border-border/50">
          {step.description && (
            <p className="text-[11px] text-text-secondary leading-relaxed mt-2">
              {step.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
            <span>
              Tool: <span className="text-text-secondary font-mono">{step.tool}</span>
            </span>
            {deps.length > 0 && (
              <span>
                Depends on:{' '}
                {deps.map((d, i) => (
                  <span key={d}>
                    <span className="text-text-secondary">{d}</span>
                    {i < deps.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </span>
            )}
            {step.condition && (
              <span>
                Condition: <span className="text-text-secondary font-mono">{step.condition}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function WorkflowConfirm({
  workflow,
  open,
  onClose,
  onExecute,
  executing,
  targetValue,
}: WorkflowConfirmProps) {
  const [disabledSteps, setDisabledSteps] = useState<Set<string>>(new Set())
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  const toggleStep = useCallback((stepId: string) => {
    setDisabledSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }, [])

  const toggleExpand = useCallback((stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }, [])

  const enabledCount = useMemo(
    () => workflow.steps.filter((s) => !disabledSteps.has(s.id)).length,
    [workflow.steps, disabledSteps]
  )

  const handleExecute = useCallback(() => {
    onExecute({
      disabledSteps: Array.from(disabledSteps),
      argOverrides: {},
    })
  }, [onExecute, disabledSteps])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Run: ${workflow.name}`}
      description="Review the steps below before executing this workflow."
      className="max-w-lg"
    >
      {/* Target info */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded bg-bg-base border border-border">
        <span className="text-[11px] text-text-muted">Target:</span>
        <span className="text-xs text-accent font-mono">{targetValue}</span>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-4 mb-4 text-[11px] text-text-muted">
        <span className="flex items-center gap-1">
          <Play className="w-3 h-3" />
          {enabledCount}/{workflow.steps.length} steps enabled
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

      {/* Steps list */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {workflow.steps.map((step, i) => (
          <StepItem
            key={step.id}
            step={step}
            index={i}
            disabled={disabledSteps.has(step.id)}
            onToggle={toggleStep}
            expanded={expandedSteps.has(step.id)}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>

      {/* Warning if root required */}
      {workflow.requiresRoot && (
        <div className="flex items-start gap-2 mt-3 text-[11px] text-warning">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            This workflow requires root privileges. You may be prompted for your
            password.
          </span>
        </div>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={executing}>
          Cancel
        </Button>
        <Button onClick={handleExecute} loading={executing}>
          <Play className="w-3.5 h-3.5 mr-1" />
          Execute {enabledCount} Steps
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
