import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
import {
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronRight,
  Monitor,
  Globe,
  Server,
  Link,
  Mail,
  Network,
  Plus,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldOff,
  Zap,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useUiStore } from '../../stores/ui-store'
import { useTargetStore, selectActiveTarget } from '../../stores/target-store'
import { useScanStore } from '../../stores/scan-store'
import { useActionStore } from '../../stores/action-store'
import { Badge, ProgressBar } from '../common'
import type { Target, Scan, EvaluatedAction, RiskLevel, TargetType } from '@shared/types'

// ── Icon map for target types ──

const targetTypeIcons: Record<TargetType, typeof Monitor> = {
  ip: Monitor,
  cidr: Network,
  hostname: Server,
  domain: Globe,
  url: Link,
  email: Mail,
}

// ── Status badge config ──

const statusConfig: Record<string, { label: string; variant: 'default' | 'accent' | 'success' | 'error' }> = {
  new: { label: 'NEW', variant: 'default' },
  scanning: { label: 'SCANNING', variant: 'accent' },
  scanned: { label: 'SCANNED', variant: 'success' },
  compromised: { label: 'COMPROMISED', variant: 'error' },
}

// ── Risk level config (compact) ──

const riskIcons: Record<RiskLevel, typeof Shield> = {
  passive: Shield,
  active: ShieldAlert,
  intrusive: ShieldOff,
}

const riskVariants: Record<RiskLevel, 'success' | 'accent' | 'error'> = {
  passive: 'success',
  active: 'accent',
  intrusive: 'error',
}

// ── Scan status icon ──

function ScanStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3 h-3 text-accent animate-spin" />
    case 'queued':
      return <Clock className="w-3 h-3 text-text-muted" />
    case 'completed':
      return <CheckCircle2 className="w-3 h-3 text-success" />
    case 'failed':
      return <XCircle className="w-3 h-3 text-error" />
    case 'cancelled':
      return <Square className="w-3 h-3 text-text-muted" />
    default:
      return <Clock className="w-3 h-3 text-text-muted" />
  }
}

// ── Format duration ──

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

// ── Format relative time ──

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ── Section header (collapsible) ──

function SectionHeader({
  title,
  count,
  expanded,
  onToggle,
}: {
  title: string
  count?: number
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 w-full text-left py-1.5 group"
    >
      {expanded ? (
        <ChevronDown className="w-3 h-3 text-text-muted" />
      ) : (
        <ChevronRight className="w-3 h-3 text-text-muted" />
      )}
      <span className="text-[10px] font-sans uppercase tracking-wider text-text-muted group-hover:text-text-secondary transition-colors">
        {title}
      </span>
      {count != null && count > 0 && (
        <span className="text-[10px] font-mono text-text-muted bg-bg-elevated px-1 py-0.5 rounded ml-auto">
          {count}
        </span>
      )}
    </button>
  )
}

// ── Target summary section ──

function TargetSummary({
  target,
  targets,
  onSwitch,
  onOpen,
}: {
  target: Target
  targets: Target[]
  onSwitch: (id: number) => void
  onOpen: (id: number) => void
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const TypeIcon = targetTypeIcons[target.type] ?? Monitor
  const status = statusConfig[target.status] ?? statusConfig.new

  return (
    <div className="space-y-2">
      {/* Active target card */}
      <div
        className="bg-bg-elevated rounded-lg p-2.5 border border-border hover:border-accent/30 transition-colors cursor-pointer"
        onClick={() => onOpen(target.id)}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <TypeIcon className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          <span className="text-xs font-mono text-text-primary truncate flex-1 font-semibold">
            {target.value}
          </span>
          <ExternalLink className="w-3 h-3 text-text-muted flex-shrink-0" />
        </div>
        {target.label && (
          <p className="text-[10px] text-text-muted ml-5.5 mb-1 truncate">{target.label}</p>
        )}
        <div className="flex items-center gap-1.5 ml-5.5">
          <Badge variant={status.variant} className="text-[9px] px-1.5 py-0">
            {status.label}
          </Badge>
          {target.os_guess && (
            <span className="text-[9px] text-text-muted font-mono truncate">{target.os_guess}</span>
          )}
        </div>
      </div>

      {/* Quick-switch dropdown */}
      {targets.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setSwitcherOpen(!switcherOpen)}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors w-full"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />
            <span>Switch target ({targets.length})</span>
          </button>

          {switcherOpen && (
            <div className="mt-1 bg-bg-elevated border border-border rounded-lg max-h-40 overflow-y-auto scrollbar-hidden">
              {targets
                .filter((t) => t.id !== target.id)
                .map((t) => {
                  const Icon = targetTypeIcons[t.type] ?? Monitor
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        onSwitch(t.id)
                        setSwitcherOpen(false)
                      }}
                      className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-bg-input transition-colors text-left"
                    >
                      <Icon className="w-3 h-3 text-text-muted flex-shrink-0" />
                      <span className="text-[11px] font-mono text-text-secondary truncate">
                        {t.value}
                      </span>
                    </button>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Scan item (compact row) ──

function ScanRow({
  scan,
  onClick,
}: {
  scan: Scan
  onClick: () => void
}) {
  const isRunning = scan.status === 'running'

  return (
    <button
      onClick={onClick}
      className="flex flex-col w-full text-left px-2 py-1.5 rounded hover:bg-bg-elevated transition-colors gap-1"
    >
      <div className="flex items-center gap-1.5 w-full">
        <ScanStatusIcon status={scan.status} />
        <span className="text-[11px] font-mono text-text-primary truncate flex-1">
          {scan.tool_id}
        </span>
        <span className="text-[9px] text-text-muted font-mono flex-shrink-0">
          {scan.completed_at
            ? formatRelativeTime(scan.completed_at)
            : scan.started_at
              ? formatRelativeTime(scan.started_at)
              : ''}
        </span>
      </div>
      {isRunning && (
        <ProgressBar value={0} indeterminate variant="accent" size="sm" className="ml-4.5" />
      )}
      {scan.status === 'completed' && scan.duration_ms != null && (
        <span className="text-[9px] text-text-muted font-mono ml-4.5">
          {formatDuration(scan.duration_ms)}
        </span>
      )}
    </button>
  )
}

// ── Compact action card (for context panel) ──

function CompactActionCard({ action }: { action: EvaluatedAction }) {
  const navigate = useUiStore((s) => s.navigate)
  const RiskIcon = riskIcons[action.riskLevel]

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate('tool-form', {
      moduleId: action.tool,
      autoArgs: action.autoArgs,
    })
  }

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-bg-elevated transition-colors group">
      <RiskIcon className={`w-3 h-3 mt-0.5 flex-shrink-0 text-${riskVariants[action.riskLevel] === 'success' ? 'success' : riskVariants[action.riskLevel] === 'accent' ? 'accent' : 'error'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-sans text-text-primary truncate">
            {action.title}
          </span>
          {action.priority <= 20 && (
            <Badge variant="error" className="text-[8px] px-1 py-0">!</Badge>
          )}
        </div>
        <span className="text-[9px] text-text-muted font-mono">{action.tool}</span>
      </div>
      <button
        onClick={handleRun}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent/10"
        title="Run"
      >
        <Play className="w-3 h-3 text-accent" />
      </button>
    </div>
  )
}

// ── Quick-add target input ──

function QuickAddTarget() {
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addTarget = useTargetStore((s) => s.addTarget)
  const setActiveTarget = useTargetStore((s) => s.setActiveTarget)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return

    setAdding(true)
    setError(null)
    try {
      const target = await addTarget(trimmed)
      setActiveTarget(target.id)
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add target')
    } finally {
      setAdding(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        placeholder="IP, domain, or URL..."
        className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono bg-bg-input border border-border rounded
                   text-text-primary placeholder:text-text-muted
                   focus:outline-none focus:ring-1 focus:ring-accent"
        disabled={adding}
      />
      <button
        type="submit"
        disabled={adding || !value.trim()}
        className="p-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Add target"
      >
        {adding ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Plus className="w-3.5 h-3.5" />
        )}
      </button>
      {error && (
        <span className="text-[9px] text-error flex items-center">
          <AlertTriangle className="w-3 h-3 mr-0.5" />
        </span>
      )}
    </form>
  )
}

// ── Main ContextPanel ──

export function ContextPanel() {
  const { contextPanelOpen, contextPanelWidth, toggleContextPanel, navigate, setContextPanelWidth } = useUiStore(
    useShallow((s) => ({
      contextPanelOpen: s.contextPanelOpen,
      contextPanelWidth: s.contextPanelWidth,
      toggleContextPanel: s.toggleContextPanel,
      navigate: s.navigate,
      setContextPanelWidth: s.setContextPanelWidth,
    }))
  )
  const targets = useTargetStore((s) => s.targets)
  const activeTarget = useTargetStore(selectActiveTarget)
  const setActiveTarget = useTargetStore((s) => s.setActiveTarget)

  const loadScans = useScanStore((s) => s.loadScans)
  const scans = useScanStore((s) => s.scans)

  // Compute derived arrays locally to avoid new reference on every store change
  const runningScans = useMemo(
    () => scans.filter((s) => s.status === 'running' || s.status === 'queued'),
    [scans]
  )
  const completedScans = useMemo(
    () => scans.filter((s) => s.status === 'completed'),
    [scans]
  )

  const loadActions = useActionStore((s) => s.loadActions)
  const actions = useActionStore((s) => s.actions)
  const actionsLoading = useActionStore((s) => s.loading)

  // Drag-to-resize state
  const [resizing, setResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = contextPanelWidth
    },
    [contextPanelWidth],
  )

  useEffect(() => {
    if (!resizing) return
    const handleMove = (e: MouseEvent) => {
      // Context panel grows leftward, so delta is inverted
      const delta = startXRef.current - e.clientX
      setContextPanelWidth(startWidthRef.current + delta)
    }
    const handleUp = () => setResizing(false)
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
  }, [resizing, setContextPanelWidth])


  // Section expand states
  const [scansExpanded, setScansExpanded] = useState(true)
  const [recentExpanded, setRecentExpanded] = useState(true)
  const [actionsExpanded, setActionsExpanded] = useState(true)

  // Load scans and actions when active target changes
  useEffect(() => {
    if (activeTarget) {
      loadScans({ targetId: activeTarget.id, limit: 20 })
      loadActions(activeTarget.id)
    }
  }, [activeTarget?.id, loadScans, loadActions])

  // Auto-refresh scans when tool status changes
  useEffect(() => {
    const cleanup = window.api.on('tool:status', () => {
      if (activeTarget) {
        loadScans({ targetId: activeTarget.id, limit: 20 })
      }
    })
    return cleanup
  }, [activeTarget?.id, loadScans])

  // Recent completed scans (last 10)
  const recentScans = useMemo(
    () => completedScans.slice(0, 10),
    [completedScans],
  )

  // Queued scans
  const queuedScans = useMemo(
    () => scans.filter((s) => s.status === 'queued'),
    [scans],
  )

  // Top suggested actions (show first 5 in context panel)
  const topActions = useMemo(
    () => actions.slice(0, 5),
    [actions],
  )

  const handleSwitchTarget = useCallback(
    (id: number) => {
      setActiveTarget(id)
    },
    [setActiveTarget],
  )

  const handleOpenTarget = useCallback(
    (id: number) => {
      setActiveTarget(id)
      navigate('target-detail', { targetId: id })
    },
    [setActiveTarget, navigate],
  )

  const handleViewScan = useCallback(
    (scanId: number) => {
      navigate('scan-results', { scanId })
    },
    [navigate],
  )

  // Two-phase collapse animation
  const [contentVisible, setContentVisible] = useState(contextPanelOpen)

  useLayoutEffect(() => {
    if (contextPanelOpen) {
      // Expanding: width grows first, then content fades in
      setContentVisible(true)
    } else {
      // Collapsing: content fades out first (100ms), then width shrinks
      const timer = setTimeout(() => setContentVisible(false), 100)
      return () => clearTimeout(timer)
    }
  }, [contextPanelOpen])

  return (
    <aside
      className="flex flex-col bg-bg-surface border-l border-border shrink-0 relative overflow-hidden transition-[width] duration-200 ease-out"
      style={{ width: contextPanelOpen ? contextPanelWidth : 32 }}
    >
      {/* Collapsed toggle button (always rendered) */}
      {!contextPanelOpen && (
        <button
          onClick={toggleContextPanel}
          className="flex items-center justify-center h-full w-8 hover:bg-bg-elevated transition-colors"
          aria-label="Open context panel"
        >
          <PanelRightOpen className="w-4 h-4 text-text-secondary" />
        </button>
      )}

      {/* Expanded content */}
      {contentVisible && (
        <div
          className={`flex flex-col flex-1 min-h-0 transition-opacity duration-100 ${
            contextPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
      {/* Resize handle (left edge) */}
      <div
        className={`panel-resize-handle panel-resize-handle-left ${resizing ? 'active' : ''}`}
        onMouseDown={handleResizeStart}
      />
      {/* Header */}
      <div className="flex items-center justify-between h-8 px-3 border-b border-border">
        <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
          Context
        </span>
        <button
          onClick={toggleContextPanel}
          className="hover:bg-bg-elevated rounded p-0.5 transition-colors"
          aria-label="Close context panel"
        >
          <PanelRightClose className="w-3.5 h-3.5 text-text-secondary" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden p-3 space-y-4">
        {/* Quick-add target */}
        <div>
          <span className="text-[10px] font-sans uppercase tracking-wider text-text-muted block mb-1.5">
            Quick Add
          </span>
          <QuickAddTarget />
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {!activeTarget ? (
          /* No target selected */
          <div className="text-text-muted text-xs text-center mt-4">
            <Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>Select a target to see</p>
            <p className="mt-1">scans, actions, and suggestions.</p>
            {targets.length > 0 && (
              <div className="mt-4 space-y-1">
                {targets.slice(0, 5).map((t) => {
                  const Icon = targetTypeIcons[t.type] ?? Monitor
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSwitchTarget(t.id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-bg-elevated transition-colors text-left"
                    >
                      <Icon className="w-3 h-3 text-text-muted" />
                      <span className="text-[11px] font-mono text-text-secondary truncate">
                        {t.value}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Target selected — show all context sections */
          <>
            {/* Active target summary */}
            <TargetSummary
              target={activeTarget}
              targets={targets}
              onSwitch={handleSwitchTarget}
              onOpen={handleOpenTarget}
            />

            {/* Running scans + queue */}
            {(runningScans.length > 0 || queuedScans.length > 0) && (
              <div>
                <SectionHeader
                  title="Active Scans"
                  count={runningScans.length + queuedScans.length}
                  expanded={scansExpanded}
                  onToggle={() => setScansExpanded(!scansExpanded)}
                />
                {scansExpanded && (
                  <div className="space-y-0.5">
                    {runningScans.map((scan) => (
                      <ScanRow
                        key={scan.id}
                        scan={scan}
                        onClick={() => handleViewScan(scan.id)}
                      />
                    ))}
                    {queuedScans.length > 0 && runningScans.length > 0 && (
                      <div className="border-t border-border/50 my-1" />
                    )}
                    {queuedScans.map((scan) => (
                      <ScanRow
                        key={scan.id}
                        scan={scan}
                        onClick={() => handleViewScan(scan.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recent completed scans */}
            {recentScans.length > 0 && (
              <div>
                <SectionHeader
                  title="Recent Scans"
                  count={recentScans.length}
                  expanded={recentExpanded}
                  onToggle={() => setRecentExpanded(!recentExpanded)}
                />
                {recentExpanded && (
                  <div className="space-y-0.5">
                    {recentScans.map((scan) => (
                      <ScanRow
                        key={scan.id}
                        scan={scan}
                        onClick={() => handleViewScan(scan.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Contextual suggestions */}
            <div>
              <SectionHeader
                title="Suggested Actions"
                count={actions.length}
                expanded={actionsExpanded}
                onToggle={() => setActionsExpanded(!actionsExpanded)}
              />
              {actionsExpanded && (
                <>
                  {actionsLoading && actions.length === 0 ? (
                    <div className="space-y-2 mt-1">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 skeleton rounded" />
                      ))}
                    </div>
                  ) : topActions.length > 0 ? (
                    <div className="space-y-0.5 mt-1">
                      {topActions.map((action) => (
                        <CompactActionCard
                          key={`${action.ruleId}-${action.actionId}`}
                          action={action}
                        />
                      ))}
                      {actions.length > 5 && (
                        <button
                          onClick={() => handleOpenTarget(activeTarget.id)}
                          className="flex items-center gap-1 w-full px-2 py-1.5 text-[10px] text-accent hover:text-accent/80 transition-colors font-sans"
                        >
                          View all {actions.length} actions
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-text-muted font-sans px-2 py-2">
                      No actions available. Run scans to discover services.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Target quick stats */}
            {activeTarget && (
              <div className="border-t border-border pt-3">
                <TargetQuickStats targetId={activeTarget.id} />
              </div>
            )}
          </>
        )}
      </div>
        </div>
      )}
    </aside>
  )
}

// ── Target quick stats (uses targetDetail if loaded, otherwise shows basic info) ──

function TargetQuickStats({ targetId }: { targetId: number }) {
  const targetDetail = useTargetStore((s) => s.targetDetail)
  const detail = targetDetail?.id === targetId ? targetDetail : null

  if (!detail) return null

  const stats = [
    { label: 'Services', value: detail.services.length },
    { label: 'Vulns', value: detail.vulnerabilities.length },
    { label: 'Creds', value: detail.credentials.length },
    { label: 'Findings', value: detail.findings.length },
  ]

  return (
    <div className="grid grid-cols-4 gap-1">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className={`text-sm font-mono font-bold ${stat.value > 0 ? 'text-accent' : 'text-text-muted'}`}>
            {stat.value}
          </div>
          <div className="text-[8px] font-sans uppercase text-text-muted tracking-wider">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  )
}
