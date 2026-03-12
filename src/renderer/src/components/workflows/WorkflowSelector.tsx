import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Play,
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
  Clock,
  ShieldAlert,
  ChevronRight,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react'
import { useWorkflowStore } from '../../stores/workflow-store'
import { useTargetStore } from '../../stores/target-store'
import { useUiStore } from '../../stores/ui-store'
import { usePipelineStore } from '../../stores/pipeline-store'
import { Button, Card, Badge, EmptyState, SearchInput } from '../common'
import { compileWorkflow } from '@shared/utils/workflow-compiler'
import type { Workflow } from '@shared/types/pipeline'

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

interface WorkflowCardProps {
  workflow: Workflow
  onSelect: (workflow: Workflow) => void
  hasTarget: boolean
}

function WorkflowCard({ workflow, onSelect, hasTarget }: WorkflowCardProps) {
  const Icon = iconMap[workflow.icon ?? ''] ?? Play

  return (
    <Card
      hoverable
      className="cursor-pointer group"
      onClick={() => onSelect(workflow)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-lg bg-bg-base border border-border">
            <Icon className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {workflow.name}
            </h3>
            {workflow.category && (
              <span className="text-[11px] text-text-muted capitalize">
                {workflow.category}
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
        </div>

        {/* Description */}
        <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-3">
          {workflow.description}
        </p>

        {/* Footer metadata */}
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
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
              root
            </span>
          )}
        </div>

        {/* No target warning */}
        {!hasTarget && (
          <p className="text-[11px] text-warning mt-2">
            Select a target first to run this workflow
          </p>
        )}
      </div>
    </Card>
  )
}

export function WorkflowSelector() {
  const { workflows, loading, error, loadWorkflows } = useWorkflowStore()
  const activeTargetId = useTargetStore((s) => s.activeTargetId)
  const navigate = useUiStore((s) => s.navigate)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadWorkflows()
  }, [loadWorkflows])

  const handleSelect = useCallback(
    (workflow: Workflow) => {
      // Compile workflow YAML → pipeline definition and open in pipeline builder
      const def = compileWorkflow(workflow)
      const compiledPipeline = {
        id: -1,
        name: workflow.name,
        description: workflow.description,
        definition: JSON.stringify(def),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      usePipelineStore.getState().setActivePipeline(compiledPipeline)
      navigate('pipeline-builder', {})
    },
    [navigate]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return workflows
    const q = search.toLowerCase()
    return workflows.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        (w.category ?? '').toLowerCase().includes(q)
    )
  }, [workflows, search])

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load workflows"
        description={error}
        action={
          <Button variant="secondary" onClick={() => loadWorkflows()}>
            Retry
          </Button>
        }
      />
    )
  }

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('home')}
            className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold text-text-primary">Workflows</h1>
          <Badge>{workflows.length}</Badge>
        </div>
        {workflows.length > 3 && (
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search workflows..."
            className="w-56"
          />
        )}
      </div>

      {/* Active target indicator */}
      {activeTargetId ? (
        <p className="text-xs text-text-muted">
          Target: <span className="text-accent">{useTargetStore.getState().targets.find(t => t.id === activeTargetId)?.value ?? 'Unknown'}</span>
        </p>
      ) : (
        <p className="text-xs text-warning">
          No target selected — select a target before running a workflow
        </p>
      )}

      {/* Workflow grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No matching workflows' : 'No workflows available'}
          description={
            search
              ? 'Try a different search term.'
              : 'No workflow definitions found in the profile.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((w) => (
            <WorkflowCard
              key={w.id}
              workflow={w}
              onSelect={handleSelect}
              hasTarget={activeTargetId !== null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
