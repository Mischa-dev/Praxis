import { useState, useMemo, useCallback, useRef } from 'react'
import { Plus, Crosshair } from 'lucide-react'
import { useTargetStore, selectTargetCount } from '../../stores/target-store'
import { useUiStore } from '../../stores/ui-store'
import { Button, SearchInput, EmptyState } from '../common'
import { TargetCard } from './TargetCard'
import { AddTargetDialog } from './AddTargetDialog'
import { ScopeWarning } from './ScopeWarning'
import type { Target, TargetStatus, ScopeCheckResult } from '@shared/types'

type FilterMode = 'all' | TargetStatus

export function TargetBoard() {
  const { targets, activeTargetId, loading, addTarget, removeTarget, setActiveTarget } = useTargetStore()
  const targetCount = useTargetStore(selectTargetCount)
  const navigate = useUiStore((s) => s.navigate)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [scopeWarningOpen, setScopeWarningOpen] = useState(false)
  const [scopeResult, setScopeResult] = useState<ScopeCheckResult | null>(null)
  const pendingTarget = useRef<{ value: string; label?: string } | null>(null)

  // Filter and search targets
  const filteredTargets = useMemo(() => {
    let result = targets

    // Status filter
    if (filter !== 'all') {
      result = result.filter((t) => t.status === filter)
    }

    // Text search
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (t) =>
          t.value.toLowerCase().includes(q) ||
          (t.label && t.label.toLowerCase().includes(q)) ||
          t.type.includes(q) ||
          (t.os_guess && t.os_guess.toLowerCase().includes(q))
      )
    }

    return result
  }, [targets, filter, search])

  const handleAdd = useCallback(
    async (value: string, label?: string) => {
      // Run scope check before adding
      try {
        const result = (await window.api.invoke('scope:check', { target: value })) as ScopeCheckResult
        if (result.cloudProvider) {
          // Cloud provider detected — show warning, defer add
          pendingTarget.current = { value, label }
          setScopeResult(result)
          setScopeWarningOpen(true)
          return
        }
      } catch {
        // Scope check failed — proceed without blocking
      }
      await addTarget(value, label)
    },
    [addTarget]
  )

  const handleScopeConfirm = useCallback(async () => {
    setScopeWarningOpen(false)
    if (pendingTarget.current) {
      const { value, label } = pendingTarget.current
      pendingTarget.current = null
      await addTarget(value, label)
    }
    setScopeResult(null)
  }, [addTarget])

  const handleRemove = useCallback(
    (targetId: number) => {
      removeTarget(targetId)
    },
    [removeTarget]
  )

  const handleOpen = useCallback(
    (targetId: number) => {
      setActiveTarget(targetId)
      navigate('target-detail', { targetId })
    },
    [setActiveTarget, navigate]
  )

  const handleSelect = useCallback(
    (targetId: number) => {
      setActiveTarget(activeTargetId === targetId ? null : targetId)
    },
    [activeTargetId, setActiveTarget]
  )

  const filterButtons: { value: FilterMode; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'new', label: 'New' },
    { value: 'scanning', label: 'Scanning' },
    { value: 'scanned', label: 'Scanned' },
    { value: 'compromised', label: 'Pwned' }
  ]

  // Loading skeleton
  if (loading && targets.length === 0) {
    return (
      <div className="p-6">
        <div className="skeleton w-40 h-6 rounded mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-36 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-sm font-sans font-semibold text-text-primary uppercase tracking-wider">
          Targets
        </h1>
        <span className="text-xs text-text-muted font-mono">{targetCount}</span>
        <div className="flex-1" />
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search targets..."
          className="w-56"
        />
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          Add Target
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-border shrink-0">
        {filterButtons.map((fb) => (
          <button
            key={fb.value}
            onClick={() => setFilter(fb.value)}
            className={`
              px-2.5 py-1 text-xs font-sans rounded transition-colors
              ${filter === fb.value
                ? 'bg-accent/10 text-accent'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated'}
            `}
          >
            {fb.label}
          </button>
        ))}
        {search && (
          <span className="ml-2 text-[11px] text-text-muted">
            {filteredTargets.length} result{filteredTargets.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTargets.length === 0 ? (
          targets.length === 0 ? (
            <EmptyState
              icon={<Crosshair className="w-12 h-12" />}
              title="No targets yet"
              description="Add your first target to get started. Enter an IP address, domain, URL, or hostname."
              action={
                <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  Add Target
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No matches"
              description="No targets match your current search or filter. Try adjusting your criteria."
            />
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTargets.map((target: Target) => (
              <TargetCard
                key={target.id}
                target={target}
                active={target.id === activeTargetId}
                onSelect={handleSelect}
                onRemove={handleRemove}
                onOpen={handleOpen}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Target Dialog */}
      <AddTargetDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAdd}
      />

      {/* Scope Warning Dialog */}
      {scopeResult && (
        <ScopeWarning
          open={scopeWarningOpen}
          onClose={() => {
            setScopeWarningOpen(false)
            pendingTarget.current = null
            setScopeResult(null)
          }}
          onConfirm={handleScopeConfirm}
          result={scopeResult}
          targetValue={pendingTarget.current?.value ?? ''}
        />
      )}
    </div>
  )
}
