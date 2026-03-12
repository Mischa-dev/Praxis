import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Clock,
  Copy,
  Check,
  Play,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertCircle,
} from 'lucide-react'
import { useUiStore } from '../../stores/ui-store'
import { useTargetStore } from '../../stores/target-store'
import { useModuleStore } from '../../stores/module-store'
import { Badge, EmptyState, SearchInput, Button } from '../common'
import type { CommandHistoryEntry, Target, Module } from '@shared/types'

// ── Helpers ──

function formatDuration(ms: number | null): string {
  if (ms === null) return '\u2014'
  if (ms < 1000) return `${ms}ms`
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  return `${mins}m ${secs % 60}s`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'Z')
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function exitCodeVariant(code: number | null): 'success' | 'error' | 'default' {
  if (code === null) return 'default'
  if (code === 0) return 'success'
  return 'error'
}

type SortField = 'created_at' | 'tool_id' | 'duration_ms' | 'exit_code'
type SortDir = 'asc' | 'desc'

// ── Filter Panel ──

interface FilterPanelProps {
  toolFilter: string
  targetFilter: string
  statusFilter: string
  fromDate: string
  toDate: string
  onToolChange: (v: string) => void
  onTargetChange: (v: string) => void
  onStatusChange: (v: string) => void
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onClear: () => void
  targets: Target[]
  modules: Module[]
  hasFilters: boolean
}

function FilterPanel({
  toolFilter, targetFilter, statusFilter, fromDate, toDate,
  onToolChange, onTargetChange, onStatusChange, onFromChange, onToChange, onClear,
  targets, modules, hasFilters,
}: FilterPanelProps) {
  const uniqueTools = useMemo(() => {
    const sorted = [...modules].sort((a, b) => a.name.localeCompare(b.name))
    return sorted.map((m) => ({ value: m.id, label: m.name }))
  }, [modules])

  return (
    <div className="flex flex-wrap items-end gap-3 p-3 bg-bg-elevated rounded-lg border border-border">
      {/* Tool filter */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-text-muted font-sans uppercase tracking-wider">Tool</label>
        <select
          value={toolFilter}
          onChange={(e) => onToolChange(e.target.value)}
          className="px-2 py-1.5 text-xs font-mono bg-bg-input text-text-primary border border-border rounded-md focus:outline-none focus:border-accent appearance-none min-w-[140px]"
        >
          <option value="">All tools</option>
          {uniqueTools.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Target filter */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-text-muted font-sans uppercase tracking-wider">Target</label>
        <select
          value={targetFilter}
          onChange={(e) => onTargetChange(e.target.value)}
          className="px-2 py-1.5 text-xs font-mono bg-bg-input text-text-primary border border-border rounded-md focus:outline-none focus:border-accent appearance-none min-w-[140px]"
        >
          <option value="">All targets</option>
          {targets.map((t) => (
            <option key={t.id} value={String(t.id)}>{t.value}</option>
          ))}
        </select>
      </div>

      {/* Status filter (exit code based) */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-text-muted font-sans uppercase tracking-wider">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-2 py-1.5 text-xs font-mono bg-bg-input text-text-primary border border-border rounded-md focus:outline-none focus:border-accent appearance-none min-w-[120px]"
        >
          <option value="">All</option>
          <option value="0">Success (0)</option>
          <option value="error">Error (non-0)</option>
        </select>
      </div>

      {/* Date range */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-text-muted font-sans uppercase tracking-wider">From</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromChange(e.target.value)}
          className="px-2 py-1.5 text-xs font-mono bg-bg-input text-text-primary border border-border rounded-md focus:outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-text-muted font-sans uppercase tracking-wider">To</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToChange(e.target.value)}
          className="px-2 py-1.5 text-xs font-mono bg-bg-input text-text-primary border border-border rounded-md focus:outline-none focus:border-accent"
        />
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="mb-0.5">
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}

// ── History Row ──

interface HistoryRowProps {
  entry: CommandHistoryEntry
  targets: Target[]
  modules: Module[]
  onReRun: (entry: CommandHistoryEntry) => void
}

function HistoryRow({ entry, targets, modules, onReRun }: HistoryRowProps) {
  const [copied, setCopied] = useState(false)
  const copyTimeout = useRef<ReturnType<typeof setTimeout>>()

  const target = useMemo(
    () => targets.find((t) => t.id === entry.target_id),
    [targets, entry.target_id]
  )

  const mod = useMemo(
    () => modules.find((m) => m.id === entry.tool_id),
    [modules, entry.tool_id]
  )

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(entry.command)
    setCopied(true)
    if (copyTimeout.current) clearTimeout(copyTimeout.current)
    copyTimeout.current = setTimeout(() => setCopied(false), 2000)
  }, [entry.command])

  const handleReRun = useCallback(() => {
    onReRun(entry)
  }, [entry, onReRun])

  return (
    <div className="group flex items-start gap-3 p-3 bg-bg-secondary hover:bg-bg-elevated border border-border rounded-lg transition-colors">
      {/* Status indicator */}
      <div className="mt-1 flex-shrink-0">
        {entry.exit_code === null ? (
          <div className="w-2 h-2 rounded-full bg-text-muted" />
        ) : entry.exit_code === 0 ? (
          <div className="w-2 h-2 rounded-full bg-success" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-error" />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Command line */}
        <div className="flex items-center gap-2 mb-1">
          <Terminal className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          <code className="text-xs font-mono text-text-primary truncate block">
            {entry.command}
          </code>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] text-text-muted font-mono">
          {mod && (
            <span className="text-accent">{mod.name}</span>
          )}
          {!mod && entry.tool_id && (
            <span className="text-text-secondary">{entry.tool_id}</span>
          )}
          {target && (
            <span className="text-text-secondary">{target.value}</span>
          )}
          {entry.exit_code !== null && (
            <Badge variant={exitCodeVariant(entry.exit_code)}>
              exit {entry.exit_code}
            </Badge>
          )}
          {entry.duration_ms !== null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(entry.duration_ms)}
            </span>
          )}
          <span>{formatDate(entry.created_at)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors"
          title="Copy command"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        {entry.tool_id && (
          <button
            onClick={handleReRun}
            className="p-1.5 rounded hover:bg-bg-card text-text-muted hover:text-accent transition-colors"
            title="Re-run with same arguments"
          >
            <Play className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main View ──

const PAGE_SIZE = 50

export function HistoryView() {
  const navigate = useUiStore((s) => s.navigate)
  const { targets, loadTargets } = useTargetStore()
  const { modules, loadModules } = useModuleStore()

  const [entries, setEntries] = useState<CommandHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // Search
  const [search, setSearch] = useState('')

  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [toolFilter, setToolFilter] = useState('')
  const [targetFilter, setTargetFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Sort
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const hasFilters = !!(toolFilter || targetFilter || statusFilter || fromDate || toDate)

  // Load targets and modules for filter dropdowns
  useEffect(() => {
    loadTargets()
    loadModules()
  }, [loadTargets, loadModules])

  // Build request params from filters
  const requestParams = useMemo(() => {
    const params: Record<string, unknown> = { limit: PAGE_SIZE + 1 }
    if (toolFilter) params.toolId = toolFilter
    if (targetFilter) params.targetId = Number(targetFilter)
    if (statusFilter === '0') params.exitCode = 0
    if (fromDate) params.fromDate = fromDate + ' 00:00:00'
    if (toDate) params.toDate = toDate + ' 23:59:59'
    if (search.trim()) params.search = search.trim()
    return params
  }, [toolFilter, targetFilter, statusFilter, fromDate, toDate, search])

  // Load history
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = (await window.api.invoke('history:list', requestParams)) as CommandHistoryEntry[]
      setHasMore(result.length > PAGE_SIZE)
      setEntries(result.slice(0, PAGE_SIZE))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load command history')
    } finally {
      setLoading(false)
    }
  }, [requestParams])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Load more
  const loadMore = useCallback(async () => {
    try {
      const params = { ...requestParams, limit: PAGE_SIZE + 1, offset: entries.length }
      const result = (await window.api.invoke('history:list', params)) as CommandHistoryEntry[]
      setHasMore(result.length > PAGE_SIZE)
      setEntries((prev) => [...prev, ...result.slice(0, PAGE_SIZE)])
    } catch {
      // Silently fail — user can retry
    }
  }, [requestParams, entries.length])

  // Sort entries client-side (already fetched, sorted by created_at desc from DB)
  const sortedEntries = useMemo(() => {
    if (sortField === 'created_at' && sortDir === 'desc') return entries

    // Filter out error exit codes if statusFilter is 'error'
    let filtered = entries
    if (statusFilter === 'error') {
      filtered = entries.filter((e) => e.exit_code !== null && e.exit_code !== 0)
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'created_at':
          cmp = a.created_at.localeCompare(b.created_at)
          break
        case 'tool_id':
          cmp = (a.tool_id ?? '').localeCompare(b.tool_id ?? '')
          break
        case 'duration_ms':
          cmp = (a.duration_ms ?? 0) - (b.duration_ms ?? 0)
          break
        case 'exit_code':
          cmp = (a.exit_code ?? -1) - (b.exit_code ?? -1)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [entries, sortField, sortDir, statusFilter])

  // Re-run: navigate to tool-form with the same module and attempt to parse args
  const handleReRun = useCallback((entry: CommandHistoryEntry) => {
    if (!entry.tool_id) return
    // Navigate to tool form — the scan's original args are not stored in command_history,
    // but the tool form will load with defaults. The user can see the original command
    // in the preview and adjust.
    navigate('tool-form', {
      moduleId: entry.tool_id,
      ...(entry.target_id ? { targetId: entry.target_id } : {}),
    })
  }, [navigate])

  const clearFilters = useCallback(() => {
    setToolFilter('')
    setTargetFilter('')
    setStatusFilter('')
    setFromDate('')
    setToDate('')
  }, [])

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'created_at' ? 'desc' : 'asc')
    }
  }, [sortField])

  // ── Render ──

  return (
    <div className="flex flex-col h-full animate-[view-enter_0.2s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-accent" />
          <h2 className="text-base font-display font-bold text-text-primary">Command History</h2>
          {!loading && (
            <span className="text-xs text-text-muted font-mono">
              {sortedEntries.length} command{sortedEntries.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            onClear={() => setSearch('')}
            placeholder="Search commands..."
            className="w-56"
          />
          <Button
            variant={showFilters ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setShowFilters((s) => !s)}
          >
            <Filter className="w-3.5 h-3.5 mr-1" />
            Filters
            {hasFilters && (
              <span className="ml-1 w-4 h-4 rounded-full bg-accent text-bg-primary text-[10px] flex items-center justify-center font-bold">
                !
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="px-4 pt-3">
          <FilterPanel
            toolFilter={toolFilter}
            targetFilter={targetFilter}
            statusFilter={statusFilter}
            fromDate={fromDate}
            toDate={toDate}
            onToolChange={setToolFilter}
            onTargetChange={setTargetFilter}
            onStatusChange={setStatusFilter}
            onFromChange={setFromDate}
            onToChange={setToDate}
            onClear={clearFilters}
            targets={targets}
            modules={modules}
            hasFilters={hasFilters}
          />
        </div>
      )}

      {/* Sort bar */}
      <div className="flex items-center gap-4 px-4 py-2 text-[10px] text-text-muted font-sans uppercase tracking-wider">
        <span className="text-text-muted">Sort by:</span>
        {([
          ['created_at', 'Date'],
          ['tool_id', 'Tool'],
          ['duration_ms', 'Duration'],
          ['exit_code', 'Exit Code'],
        ] as [SortField, string][]).map(([field, label]) => (
          <button
            key={field}
            onClick={() => toggleSort(field)}
            className={`flex items-center gap-0.5 hover:text-text-primary transition-colors ${
              sortField === field ? 'text-accent' : ''
            }`}
          >
            {label}
            {sortField === field && (
              sortDir === 'asc'
                ? <ChevronUp className="w-3 h-3" />
                : <ChevronDown className="w-3 h-3" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex flex-col gap-2 mt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-bg-elevated animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 mt-12 text-center">
            <AlertCircle className="w-8 h-8 text-error" />
            <p className="text-sm text-error font-sans">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchHistory}>
              Retry
            </Button>
          </div>
        ) : sortedEntries.length === 0 ? (
          <EmptyState
            title="No commands found"
            description={
              hasFilters || search
                ? 'No commands match your filters. Try adjusting your search or clearing filters.'
                : 'Commands will appear here after you run tools on targets.'
            }
          />
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            {sortedEntries.map((entry) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                targets={targets}
                modules={modules}
                onReRun={handleReRun}
              />
            ))}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={loadMore}
                className="mt-2 py-2 text-xs font-sans text-accent hover:text-text-primary transition-colors"
              >
                Load more...
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
