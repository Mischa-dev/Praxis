import { useEffect, useState, useCallback } from 'react'
import {
  Activity,
  Play,
  Plus,
  FolderOpen,
  ArrowRight,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useUiStore } from '../../stores/ui-store'
import { useEntityStore, selectPrimaryType } from '../../stores/entity-store'
import { getIcon } from '../../lib/icon-map'
import { getDisplayValue, getStatusValue } from '../../lib/schema-utils'
import { Button, Card, Badge, EmptyState } from '../common'
import type { Scan } from '@shared/types/scan'
import type { EntityRecord } from '@shared/types/entity'
import type { WorkflowDefinition } from '@shared/types/pipeline'

const EMPTY_ENTITIES: EntityRecord[] = []

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string
  value: number
  icon: React.FC<{ className?: string }>
  accent?: string
  onClick?: () => void
}) {
  return (
    <Card
      hoverable={!!onClick}
      padding="sm"
      className="flex items-center gap-3"
      onClick={onClick}
    >
      <div
        className={`p-2 rounded-md ${accent ?? 'bg-accent/10 text-accent'}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-mono font-bold text-text-primary tabular-nums">
          {value}
        </p>
        <p className="text-[10px] font-sans text-text-muted uppercase tracking-wider">
          {label}
        </p>
      </div>
    </Card>
  )
}

function RecentExecutions({ scans }: { scans: Scan[] }) {
  const navigate = useUiStore((s) => s.navigate)

  if (scans.length === 0) {
    return (
      <p className="text-xs text-text-muted font-sans py-4 text-center">
        No executions yet. Run a tool to see results here.
      </p>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {scans.map((scan) => (
        <button
          key={scan.id}
          onClick={() => navigate('scan-results', { scanId: scan.id })}
          className="flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated transition-colors text-left"
        >
          <div
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              scan.status === 'completed'
                ? 'bg-success'
                : scan.status === 'running'
                  ? 'bg-accent animate-pulse'
                  : scan.status === 'failed'
                    ? 'bg-error'
                    : 'bg-text-muted'
            }`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-text-primary truncate">{scan.tool_id}</p>
            <p className="text-[10px] font-mono text-text-muted truncate">{scan.command}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={
                scan.status === 'completed'
                  ? 'success'
                  : scan.status === 'failed'
                    ? 'error'
                    : 'default'
              }
            >
              {scan.status.toUpperCase()}
            </Badge>
            {scan.duration_ms !== null && (
              <span className="text-[10px] font-mono text-text-muted tabular-nums">
                {(scan.duration_ms / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

function QuickWorkflows() {
  const navigate = useUiStore((s) => s.navigate)
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([])

  useEffect(() => {
    window.api
      .invoke('workflow:list')
      .then((wf) => setWorkflows((wf as WorkflowDefinition[]).slice(0, 4)))
      .catch(() => {})
  }, [])

  if (workflows.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {workflows.map((wf) => (
        <button
          key={wf.id}
          onClick={() => navigate('workflow-view', { workflowId: wf.id })}
          className="flex items-center gap-3 px-3 py-2 rounded-md bg-bg-elevated hover:bg-bg-surface border border-transparent hover:border-border transition-all group"
        >
          <Play className="w-3.5 h-3.5 text-accent shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-sans text-text-primary truncate">{wf.name}</p>
            <p className="text-[10px] font-sans text-text-muted truncate">{wf.description}</p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      ))}
    </div>
  )
}

function RecentEntities({ entities, primaryType }: {
  entities: EntityRecord[]
  primaryType: { label: string; icon: string; fields: Record<string, unknown> } | null
}) {
  const navigate = useUiStore((s) => s.navigate)
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity)
  const PrimaryIcon = primaryType ? getIcon(primaryType.icon) : Activity

  if (entities.length === 0) {
    const label = primaryType?.label?.toLowerCase() ?? 'entity'
    return (
      <p className="text-xs text-text-muted font-sans py-4 text-center">
        No {label}s yet. Add one to begin.
      </p>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {entities.slice(0, 8).map((entity) => {
        const displayVal = primaryType ? getDisplayValue(entity, primaryType as never) : String(entity.id)
        const status = primaryType ? getStatusValue(entity, primaryType as never) : null
        return (
          <button
            key={entity.id}
            onClick={() => {
              setActiveEntity(entity.id)
              navigate('target-detail', { entityId: entity.id })
            }}
            className="flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated transition-colors text-left"
          >
            <PrimaryIcon className="w-3.5 h-3.5 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-text-primary truncate">{displayVal}</p>
            </div>
            {status && (
              <Badge variant="default">
                {status.toUpperCase()}
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface ProjectDashboardProps {
  onShowProjects: () => void
}

export function ProjectDashboard({ onShowProjects }: ProjectDashboardProps) {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const navigate = useUiStore((s) => s.navigate)

  const primaryType = useEntityStore(selectPrimaryType)
  const schema = useEntityStore((s) => s.schema)
  const primaryEntityType = schema?.primaryEntity ?? ''
  const entities = useEntityStore((s) => s.caches[primaryEntityType]?.entities ?? EMPTY_ENTITIES)
  const loadEntities = useEntityStore((s) => s.loadEntities)
  const entityStats = useEntityStore((s) => s.stats)
  const loadStats = useEntityStore((s) => s.loadStats)

  const [recentScans, setRecentScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [scansRes] = await Promise.all([
        window.api.invoke('scan:list', { limit: 8 }),
        primaryEntityType ? loadEntities(primaryEntityType) : Promise.resolve(),
        loadStats(),
      ])
      setRecentScans(scansRes as Scan[])
    } catch {
      // Stats might fail if no workspace is loaded
    } finally {
      setLoading(false)
    }
  }, [primaryEntityType, loadEntities, loadStats])

  useEffect(() => {
    loadData()
  }, [loadData, activeWorkspace?.id])

  const primaryLabel = primaryType?.label ?? 'Entity'
  const primaryLabelPlural = primaryType?.label_plural ?? 'Entities'
  const PrimaryIcon = primaryType ? getIcon(primaryType.icon) : Activity

  if (!activeWorkspace) {
    return (
      <EmptyState
        icon={<FolderOpen className="w-10 h-10" />}
        title="No active project"
        description="Create or open a project to get started."
        action={
          <Button size="sm" onClick={onShowProjects}>
            <FolderOpen className="w-3.5 h-3.5" />
            Open Projects
          </Button>
        }
      />
    )
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-6">
        <div className="skeleton w-48 h-6 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-20 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="skeleton h-64 rounded-lg" />
          <div className="skeleton h-64 rounded-lg" />
        </div>
      </div>
    )
  }

  // Build stat cards from schema entity types
  const statCards: { label: string; value: number; icon: React.FC<{ className?: string }>; accent?: string; onClick?: () => void }[] = []

  if (schema) {
    // Primary entity stat
    statCards.push({
      label: primaryLabelPlural,
      value: entityStats[primaryEntityType] ?? entities.length,
      icon: PrimaryIcon,
      accent: 'bg-accent/10 text-accent',
      onClick: () => navigate('targets'),
    })

    // Child entity stats
    for (const [typeId, typeDef] of Object.entries(schema.entities)) {
      if (typeId === primaryEntityType) continue
      const count = entityStats[typeId] ?? 0
      if (count > 0 || statCards.length < 4) {
        statCards.push({
          label: typeDef.label_plural,
          value: count,
          icon: getIcon(typeDef.icon),
        })
      }
    }
  }

  // Execution stat
  statCards.push({
    label: 'Executions',
    value: recentScans.length,
    icon: Activity,
    accent: 'bg-accent-secondary/10 text-accent-secondary',
  })

  return (
    <div className="p-6 flex flex-col gap-6 overflow-y-auto h-full">
      {/* Project Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-display font-bold text-text-primary">
            {activeWorkspace.name}
          </h1>
          {activeWorkspace.description && (
            <p className="text-xs text-text-muted font-sans mt-0.5">
              {activeWorkspace.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onShowProjects}>
            <FolderOpen className="w-3.5 h-3.5" />
            All Projects
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('targets')}
          >
            <Plus className="w-3.5 h-3.5" />
            Add {primaryLabel}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.slice(0, 4).map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Executions */}
        <Card padding="none">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-sans font-semibold text-text-secondary uppercase tracking-wider">
              Recent Executions
            </h3>
            {recentScans.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => navigate('history')}>
                View All
              </Button>
            )}
          </div>
          <RecentExecutions scans={recentScans} />
        </Card>

        {/* Primary Entities */}
        <Card padding="none">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-sans font-semibold text-text-secondary uppercase tracking-wider">
              {primaryLabelPlural}
            </h3>
            {entities.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => navigate('targets')}>
                View All
              </Button>
            )}
          </div>
          <RecentEntities entities={entities} primaryType={primaryType} />
        </Card>

        {/* Quick-launch Workflows */}
        <Card padding="none">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-sans font-semibold text-text-secondary uppercase tracking-wider">
              Quick-Launch Workflows
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('workflow-view')}
            >
              View All
            </Button>
          </div>
          <div className="p-3">
            <QuickWorkflows />
          </div>
        </Card>

        {/* Execution Status Summary */}
        <Card padding="sm">
          <h3 className="text-xs font-sans font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Execution Status
          </h3>
          <ExecutionStatusSummary scans={recentScans} />
        </Card>
      </div>
    </div>
  )
}

function ExecutionStatusSummary({ scans }: { scans: Scan[] }) {
  const counts = {
    completed: scans.filter((s) => s.status === 'completed').length,
    running: scans.filter((s) => s.status === 'running').length,
    failed: scans.filter((s) => s.status === 'failed').length,
    queued: scans.filter((s) => s.status === 'queued').length,
    cancelled: scans.filter((s) => s.status === 'cancelled').length,
  }

  const total = scans.length

  if (total === 0) {
    return (
      <p className="text-xs text-text-muted font-sans py-2">No executions recorded.</p>
    )
  }

  const bars: { key: string; count: number; color: string; label: string }[] = [
    { key: 'completed', count: counts.completed, color: 'bg-success', label: 'Completed' },
    { key: 'running', count: counts.running, color: 'bg-accent', label: 'Running' },
    { key: 'failed', count: counts.failed, color: 'bg-error', label: 'Failed' },
    { key: 'queued', count: counts.queued, color: 'bg-text-muted', label: 'Queued' },
    { key: 'cancelled', count: counts.cancelled, color: 'bg-severity-medium', label: 'Cancelled' },
  ].filter((b) => b.count > 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2 rounded-full overflow-hidden bg-bg-elevated">
        {bars.map((bar) => (
          <div
            key={bar.key}
            className={`${bar.color} transition-all`}
            style={{ width: `${(bar.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {bars.map((bar) => (
          <div key={bar.key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${bar.color}`} />
            <span className="text-[10px] font-sans text-text-muted">
              {bar.label}: {bar.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
