import { useEffect, useState, useCallback } from 'react'
import {
  Target,
  Activity,
  Shield,
  Key,
  AlertTriangle,
  Play,
  Plus,
  FolderOpen,
  ArrowRight,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useUiStore } from '../../stores/ui-store'
import { Button, Card, Badge, EmptyState } from '../common'
import type { Scan } from '@shared/types/scan'
import type { Target as TargetType } from '@shared/types/target'
import type { DbStatsResponse } from '@shared/types/ipc'
import type { WorkflowDefinition } from '@shared/types/pipeline'

interface DashboardStats extends DbStatsResponse {
  // Extends the db:stats response directly
}

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

function RecentScans({ scans }: { scans: Scan[] }) {
  const navigate = useUiStore((s) => s.navigate)

  if (scans.length === 0) {
    return (
      <p className="text-xs text-text-muted font-sans py-4 text-center">
        No scans yet. Run a tool to see results here.
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

function RecentTargets({ targets }: { targets: TargetType[] }) {
  const navigate = useUiStore((s) => s.navigate)

  if (targets.length === 0) {
    return (
      <p className="text-xs text-text-muted font-sans py-4 text-center">
        No targets yet. Add a target to begin.
      </p>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {targets.map((t) => (
        <button
          key={t.id}
          onClick={() => navigate('target-detail', { targetId: t.id })}
          className="flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated transition-colors text-left"
        >
          <Target className="w-3.5 h-3.5 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-text-primary truncate">{t.value}</p>
            {t.label && (
              <p className="text-[10px] font-sans text-text-muted truncate">{t.label}</p>
            )}
          </div>
          <Badge
            variant={
              t.status === 'compromised'
                ? 'error'
                : t.status === 'scanning'
                  ? 'accent'
                  : t.status === 'scanned'
                    ? 'success'
                    : 'default'
            }
          >
            {t.status.toUpperCase()}
          </Badge>
        </button>
      ))}
    </div>
  )
}

interface ProjectDashboardProps {
  onShowProjects: () => void
}

export function ProjectDashboard({ onShowProjects }: ProjectDashboardProps) {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const navigate = useUiStore((s) => s.navigate)

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentScans, setRecentScans] = useState<Scan[]>([])
  const [targets, setTargets] = useState<TargetType[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, scansRes, targetsRes] = await Promise.all([
        window.api.invoke('db:stats'),
        window.api.invoke('scan:list', { limit: 8 }),
        window.api.invoke('target:list'),
      ])
      setStats(statsRes as DashboardStats)
      setRecentScans(scansRes as Scan[])
      setTargets(targetsRes as TargetType[])
    } catch {
      // Stats might fail if no workspace is loaded — acceptable
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData, activeWorkspace?.id])

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
            Add Target
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Targets"
            value={stats.targets}
            icon={Target}
            accent="bg-accent/10 text-accent"
            onClick={() => navigate('targets')}
          />
          <StatCard
            label="Scans"
            value={stats.scans}
            icon={Activity}
            accent="bg-accent-secondary/10 text-accent-secondary"
          />
          <StatCard
            label="Vulnerabilities"
            value={stats.vulnerabilities}
            icon={AlertTriangle}
            accent="bg-severity-high/10 text-severity-high"
          />
          <StatCard
            label="Credentials"
            value={stats.credentials}
            icon={Key}
            accent="bg-accent-purple/10 text-accent-purple"
          />
        </div>
      )}

      {/* Additional mini-stats */}
      {stats && (stats.services > 0 || stats.findings > 0 || stats.webPaths > 0) && (
        <div className="flex gap-4 text-xs font-mono text-text-muted">
          {stats.services > 0 && (
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {stats.services} services
            </span>
          )}
          {stats.findings > 0 && (
            <span>{stats.findings} findings</span>
          )}
          {stats.webPaths > 0 && (
            <span>{stats.webPaths} web paths</span>
          )}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card padding="none">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-sans font-semibold text-text-secondary uppercase tracking-wider">
              Recent Scans
            </h3>
            {recentScans.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => navigate('history')}>
                View All
              </Button>
            )}
          </div>
          <RecentScans scans={recentScans} />
        </Card>

        {/* Targets */}
        <Card padding="none">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-sans font-semibold text-text-secondary uppercase tracking-wider">
              Targets
            </h3>
            {targets.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => navigate('targets')}>
                View All
              </Button>
            )}
          </div>
          <RecentTargets targets={targets.slice(0, 8)} />
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

        {/* Scan Status Summary */}
        <Card padding="sm">
          <h3 className="text-xs font-sans font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Scan Status Summary
          </h3>
          <ScanStatusSummary scans={recentScans} />
        </Card>
      </div>
    </div>
  )
}

function ScanStatusSummary({ scans }: { scans: Scan[] }) {
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
      <p className="text-xs text-text-muted font-sans py-2">No scans recorded.</p>
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
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-bg-elevated">
        {bars.map((bar) => (
          <div
            key={bar.key}
            className={`${bar.color} transition-all`}
            style={{ width: `${(bar.count / total) * 100}%` }}
          />
        ))}
      </div>
      {/* Legend */}
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
