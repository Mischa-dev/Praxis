import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Search, Terminal, Target, GitBranch, Home, Settings, Clock,
  FileText, Play, Plus, ChevronRight, Monitor, Globe,
  Network, Link, Mail, Server, Zap, History
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useUiStore } from '../../stores/ui-store'
import { useModuleStore, selectRecentModules } from '../../stores/module-store'
import { useTargetStore } from '../../stores/target-store'
import { useWorkflowStore } from '../../stores/workflow-store'
import { shortcutForView } from '../../hooks/useKeyboardShortcuts'
import type { ViewId } from '@shared/types'

// ── Types ──

type PaletteItemKind = 'tool' | 'target' | 'workflow' | 'view' | 'action'

interface PaletteItem {
  id: string
  label: string
  description?: string
  kind: PaletteItemKind
  icon: React.ReactNode
  /** Extra info displayed on the right side */
  meta?: string
  /** Keyboard shortcut hint, e.g. "Ctrl+K" */
  shortcut?: string
  onSelect: () => void
}

// ── Fuzzy match scoring ──

function fuzzyScore(text: string, query: string): number {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let j = 0
  let score = 0
  let lastMatch = -1
  for (let i = 0; i < lower.length && j < q.length; i++) {
    if (lower[i] === q[j]) {
      if (lastMatch >= 0) score += i - lastMatch - 1
      lastMatch = i
      j++
    }
  }
  if (j < q.length) return -1
  return score + (lower.indexOf(q[0]) ?? 0)
}

function fuzzyMatch(item: PaletteItem, query: string): number {
  const targets = [item.label, item.description ?? '', item.meta ?? '']
  let best = Infinity
  for (const t of targets) {
    const s = fuzzyScore(t, query)
    if (s >= 0 && s < best) best = s
  }
  return best
}

// ── Kind labels and colors ──

const KIND_LABELS: Record<PaletteItemKind, string> = {
  tool: 'Tool',
  target: 'Target',
  workflow: 'Workflow',
  view: 'View',
  action: 'Action',
}

const KIND_COLORS: Record<PaletteItemKind, string> = {
  tool: 'text-accent',
  target: 'text-accent-secondary',
  workflow: 'text-accent-purple',
  view: 'text-text-secondary',
  action: 'text-severity-medium',
}

// ── Target type icons ──

const TARGET_TYPE_ICONS: Record<string, React.ReactNode> = {
  ip: <Monitor className="w-4 h-4" />,
  domain: <Globe className="w-4 h-4" />,
  cidr: <Network className="w-4 h-4" />,
  url: <Link className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  hostname: <Server className="w-4 h-4" />,
}

// ── Static navigation items ──

const VIEW_ITEMS: Array<{ id: ViewId; label: string; icon: React.ReactNode }> = [
  { id: 'home', label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
  { id: 'targets', label: 'Targets', icon: <Target className="w-4 h-4" /> },
  { id: 'workflow-view', label: 'Workflows', icon: <Play className="w-4 h-4" /> },
  { id: 'pipeline-builder', label: 'Pipeline Builder', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'history', label: 'Command History', icon: <History className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  { id: 'report-builder', label: 'Report Builder', icon: <FileText className="w-4 h-4" /> },
]

// ── Component ──

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const navigate = useUiStore((s) => s.navigate)
  const modules = useModuleStore((s) => s.modules)
  const recentModules = useModuleStore(useShallow(selectRecentModules))
  const targets = useTargetStore((s) => s.targets)
  const setActiveTarget = useTargetStore((s) => s.setActiveTarget)
  const workflows = useWorkflowStore((s) => s.workflows)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      // Small timeout to ensure DOM is ready
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Build all palette items
  const allItems = useMemo((): PaletteItem[] => {
    const items: PaletteItem[] = []

    // Quick actions
    items.push({
      id: 'action:add-target',
      label: 'Add Target',
      description: 'Add a new target to the workspace',
      kind: 'action',
      icon: <Plus className="w-4 h-4" />,
      onSelect: () => {
        navigate('targets')
        onClose()
      },
    })

    // Navigation views
    for (const v of VIEW_ITEMS) {
      items.push({
        id: `view:${v.id}`,
        label: v.label,
        description: `Navigate to ${v.label}`,
        kind: 'view',
        icon: v.icon,
        shortcut: shortcutForView(v.id),
        onSelect: () => {
          navigate(v.id)
          onClose()
        },
      })
    }

    // Tools
    for (const mod of modules) {
      items.push({
        id: `tool:${mod.id}`,
        label: mod.name,
        description: mod.description,
        kind: 'tool',
        icon: <Terminal className="w-4 h-4" />,
        meta: mod.installed ? undefined : 'not installed',
        onSelect: () => {
          navigate('tool-form', { moduleId: mod.id })
          onClose()
        },
      })
    }

    // Targets
    for (const t of targets) {
      items.push({
        id: `target:${t.id}`,
        label: t.label || t.value,
        description: t.value !== (t.label || t.value) ? t.value : undefined,
        kind: 'target',
        icon: TARGET_TYPE_ICONS[t.type] ?? <Monitor className="w-4 h-4" />,
        meta: t.type,
        onSelect: () => {
          setActiveTarget(t.id)
          navigate('target-detail', { targetId: t.id })
          onClose()
        },
      })
    }

    // Workflows
    for (const wf of workflows) {
      items.push({
        id: `workflow:${wf.id}`,
        label: wf.name,
        description: wf.description,
        kind: 'workflow',
        icon: <Zap className="w-4 h-4" />,
        onSelect: () => {
          navigate('workflow-view', { workflowId: wf.id })
          onClose()
        },
      })
    }

    return items
  }, [modules, targets, workflows, navigate, onClose, setActiveTarget])

  // Build recent items from recent modules
  const recentItems = useMemo((): PaletteItem[] => {
    return recentModules.slice(0, 5).map((mod) => ({
      id: `recent:${mod.id}`,
      label: mod.name,
      description: mod.description,
      kind: 'tool' as PaletteItemKind,
      icon: <Clock className="w-4 h-4" />,
      onSelect: () => {
        navigate('tool-form', { moduleId: mod.id })
        onClose()
      },
    }))
  }, [recentModules, navigate, onClose])

  // Filter and sort items based on query
  const filteredItems = useMemo((): PaletteItem[] => {
    if (!query.trim()) {
      // No query: show recent items first, then actions, views, targets (limited), workflows
      const result: PaletteItem[] = []
      if (recentItems.length > 0) {
        result.push(...recentItems)
      }
      // Add actions and views
      result.push(...allItems.filter((i) => i.kind === 'action'))
      result.push(...allItems.filter((i) => i.kind === 'view'))
      // Add first few targets and workflows
      result.push(...allItems.filter((i) => i.kind === 'target').slice(0, 5))
      result.push(...allItems.filter((i) => i.kind === 'workflow'))
      return result
    }

    // Fuzzy filter and sort
    return allItems
      .map((item) => ({ item, score: fuzzyMatch(item, query.trim()) }))
      .filter((r) => r.score < Infinity)
      .sort((a, b) => a.score - b.score)
      .slice(0, 50)
      .map((r) => r.item)
  }, [query, allItems, recentItems])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredItems.length])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredItems[selectedIndex]) {
            filteredItems[selectedIndex].onSelect()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [filteredItems, selectedIndex, onClose]
  )

  // Close on overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  if (!open) return null

  // Group items by kind for section headers (only when there's a query)
  const showSections = query.trim().length > 0
  let currentKind: PaletteItemKind | null = null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl mx-4 bg-bg-surface border border-border-bright rounded-lg shadow-overlay overflow-hidden view-enter"
        style={{ boxShadow: 'var(--shadow-overlay), 0 0 30px 2px color-mix(in srgb, var(--accent-primary) 10%, transparent)' }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, targets, workflows, views..."
            className="flex-1 bg-transparent text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-bg-elevated border border-border rounded">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1" role="listbox">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-text-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, index) => {
              // Section headers when searching
              let sectionHeader: React.ReactNode = null
              if (showSections && item.kind !== currentKind) {
                currentKind = item.kind
                sectionHeader = (
                  <div
                    key={`section-${item.kind}`}
                    className="px-4 pt-2 pb-1 text-[10px] font-sans uppercase tracking-wider text-text-muted"
                  >
                    {KIND_LABELS[item.kind]}s
                  </div>
                )
              }

              // Recent section header
              if (!showSections && index === 0 && recentItems.length > 0 && item.id.startsWith('recent:')) {
                sectionHeader = (
                  <div className="px-4 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                    Recent
                  </div>
                )
              }
              if (!showSections && recentItems.length > 0 && index === recentItems.length) {
                sectionHeader = (
                  <div className="px-4 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                    Quick Access
                  </div>
                )
              }

              const isSelected = index === selectedIndex

              return (
                <div key={`${item.id}-${index}`}>
                  {sectionHeader}
                  <div
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => item.onSelect()}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`
                      flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors duration-75
                      ${isSelected ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-elevated/50'}
                    `}
                  >
                    {/* Icon */}
                    <span className={`flex-shrink-0 ${isSelected ? KIND_COLORS[item.kind] : 'text-text-muted'}`}>
                      {item.icon}
                    </span>

                    {/* Label + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-sans truncate">{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-text-muted truncate hidden sm:inline">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Shortcut / meta / kind badge */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.shortcut && (
                        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-bg-elevated border border-border rounded">
                          {item.shortcut}
                        </kbd>
                      )}
                      {item.meta && (
                        <span className="text-[10px] font-mono text-text-muted">{item.meta}</span>
                      )}
                      <span className={`text-[10px] font-sans uppercase ${KIND_COLORS[item.kind]}`}>
                        {KIND_LABELS[item.kind]}
                      </span>
                      <ChevronRight className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100" />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer with hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[10px] text-text-muted font-sans">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-bg-elevated border border-border rounded">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-bg-elevated border border-border rounded">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-bg-elevated border border-border rounded">esc</kbd>
              close
            </span>
          </div>
          <span>{filteredItems.length} results</span>
        </div>
      </div>
    </div>
  )
}
