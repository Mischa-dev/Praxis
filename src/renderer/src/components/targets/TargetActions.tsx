import { useMemo, useState } from 'react'
import {
  Play,
  Zap,
  Shield,
  ShieldAlert,
  ShieldOff,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Info,
  Search,
} from 'lucide-react'
import type { EvaluatedAction, RiskLevel } from '@shared/types'
import { useUiStore } from '../../stores/ui-store'
import { Badge, Card, EmptyState, Button } from '../common'

// ── Risk level display config ──

const riskConfig: Record<RiskLevel, { label: string; icon: typeof Shield; variant: 'success' | 'accent' | 'error' }> = {
  passive: { label: 'PASSIVE', icon: Shield, variant: 'success' },
  active: { label: 'ACTIVE', icon: ShieldAlert, variant: 'accent' },
  intrusive: { label: 'INTRUSIVE', icon: ShieldOff, variant: 'error' },
}

// ── Category display names ──

const categoryLabels: Record<string, string> = {
  recon: 'Reconnaissance',
  enumerate: 'Enumeration',
  attack: 'Attack',
  'brute-force': 'Brute Force',
  exploit: 'Exploit',
  'post-exploit': 'Post-Exploitation',
  vuln_scan: 'Vulnerability Scanning',
  web: 'Web Application',
  credential: 'Credentials',
  infrastructure: 'Infrastructure',
}

// ── Action Card ──

function ActionCard({ action }: { action: EvaluatedAction }) {
  const navigate = useUiStore((s) => s.navigate)
  const [showExplanation, setShowExplanation] = useState(false)

  const risk = riskConfig[action.riskLevel]
  const RiskIcon = risk.icon

  const handleRun = () => {
    navigate('tool-form', {
      moduleId: action.tool,
      autoArgs: action.autoArgs,
    })
  }

  return (
    <Card padding="none" className="flex flex-col">
      <div className="p-4 flex-1">
        {/* Header row: title + risk badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-sans font-semibold text-text-primary leading-tight">
            {action.title}
          </h4>
          <Badge variant={risk.variant} className="text-[10px] flex-shrink-0">
            <RiskIcon className="w-3 h-3 mr-1" />
            {risk.label}
          </Badge>
        </div>

        {/* Description */}
        {action.description && (
          <p className="text-xs text-text-secondary line-clamp-2 mb-3">
            {action.description}
          </p>
        )}

        {/* Tool name + priority badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">
            {action.tool}
          </span>
          {action.priority <= 20 && (
            <Badge variant="error" className="text-[10px]">
              CRITICAL
            </Badge>
          )}
          {action.oneClick && (
            <Badge variant="accent" className="text-[10px]">
              <Zap className="w-2.5 h-2.5 mr-0.5" />
              ONE-CLICK
            </Badge>
          )}
        </div>

        {/* Explanation toggle */}
        {action.explanation && (
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
          >
            <Info className="w-3 h-3" />
            {showExplanation ? 'Hide explanation' : 'What does this do?'}
          </button>
        )}

        {showExplanation && action.explanation && (
          <p className="mt-2 text-xs text-text-secondary bg-bg-elevated rounded px-3 py-2 leading-relaxed border-l-2 border-accent">
            {action.explanation}
          </p>
        )}
      </div>

      {/* Action footer */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
        <Button size="sm" onClick={handleRun}>
          <Play className="w-3 h-3 mr-1.5" />
          Run
        </Button>
      </div>
    </Card>
  )
}

// ── Category Group ──

function CategoryGroup({
  category,
  actions,
  defaultExpanded,
}: {
  category: string
  actions: EvaluatedAction[]
  defaultExpanded: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const label = categoryLabels[category] ?? category.charAt(0).toUpperCase() + category.slice(1)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left py-2 group"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        )}
        <span className="text-xs font-sans uppercase tracking-wider text-text-muted group-hover:text-text-secondary transition-colors">
          {label}
        </span>
        <span className="text-[10px] font-mono text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">
          {actions.length}
        </span>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-1 mb-4">
          {actions.map((action) => (
            <ActionCard key={`${action.ruleId}-${action.actionId}`} action={action} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ──

interface TargetActionsProps {
  actions: EvaluatedAction[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export function TargetActions({ actions, loading, error, onRefresh }: TargetActionsProps) {
  const [filter, setFilter] = useState('')

  // Filter actions by search text
  const filtered = useMemo(() => {
    if (!filter.trim()) return actions
    const q = filter.toLowerCase()
    return actions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.tool.toLowerCase().includes(q) ||
        (a.description?.toLowerCase().includes(q)) ||
        (a.category?.toLowerCase().includes(q)),
    )
  }, [actions, filter])

  // Group filtered actions by category
  const groups = useMemo(() => {
    const map = new Map<string, EvaluatedAction[]>()
    for (const action of filtered) {
      const cat = action.category ?? 'General'
      const list = map.get(cat)
      if (list) {
        list.push(action)
      } else {
        map.set(cat, [action])
      }
    }
    return map
  }, [filtered])

  // Loading skeleton
  if (loading && actions.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 skeleton rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={<ShieldAlert className="w-10 h-10" />}
        title="Failed to load actions"
        description={error}
        action={
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        }
      />
    )
  }

  if (actions.length === 0) {
    return (
      <EmptyState
        icon={<Zap className="w-10 h-10" />}
        title="No actions available"
        description="Run scans to discover services and unlock suggested actions for this target."
        action={
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
        }
      />
    )
  }

  const categoryKeys = Array.from(groups.keys())

  return (
    <div className="space-y-1">
      {/* Toolbar: count + filter + refresh */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-text-muted font-sans">
          {filtered.length} action{filtered.length !== 1 ? 's' : ''} available
        </span>

        <div className="flex-1" />

        {actions.length > 5 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter actions..."
              className="pl-8 pr-3 py-1.5 text-xs font-mono bg-bg-input border border-border rounded
                         text-text-primary placeholder:text-text-muted
                         focus:outline-none focus:ring-1 focus:ring-accent w-48"
            />
          </div>
        )}

        <button
          onClick={onRefresh}
          className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          title="Refresh actions"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Grouped action cards */}
      {categoryKeys.map((cat, i) => (
        <CategoryGroup
          key={cat}
          category={cat}
          actions={groups.get(cat)!}
          defaultExpanded={i < 3}
        />
      ))}

      {filtered.length === 0 && filter && (
        <p className="text-xs text-text-muted text-center py-8 font-sans">
          No actions matching &quot;{filter}&quot;
        </p>
      )}
    </div>
  )
}
