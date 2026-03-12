import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
import {
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useUiStore } from '../../stores/ui-store'
import { useScanStore } from '../../stores/scan-store'
import { useEntityStore, selectPrimaryType, selectActiveEntity } from '../../stores/entity-store'
import {
  QuickAddSection,
  EntitySummarySection,
  ActiveExecutionsSection,
  SuggestedActionsSection,
  EntityStatsSection,
} from '../context'

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

// ── Main ContextPanel ──

export function ContextPanel() {
  const { contextPanelOpen, contextPanelWidth, toggleContextPanel, setContextPanelWidth } = useUiStore(
    useShallow((s) => ({
      contextPanelOpen: s.contextPanelOpen,
      contextPanelWidth: s.contextPanelWidth,
      toggleContextPanel: s.toggleContextPanel,
      setContextPanelWidth: s.setContextPanelWidth,
    }))
  )

  // Entity system
  const primaryType = useEntityStore(selectPrimaryType)
  const activeEntity = useEntityStore(selectActiveEntity)
  const loadEntityActions = useEntityStore((s) => s.loadActions)

  // Scans
  const loadScans = useScanStore((s) => s.loadScans)
  const scans = useScanStore((s) => s.scans)

  const runningScans = useMemo(
    () => scans.filter((s) => s.status === 'running' || s.status === 'queued'),
    [scans]
  )
  const queuedScans = useMemo(
    () => scans.filter((s) => s.status === 'queued'),
    [scans]
  )

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
  const [actionsExpanded, setActionsExpanded] = useState(true)

  // Load scans and actions when active entity changes
  useEffect(() => {
    if (activeEntity) {
      loadScans({ targetId: activeEntity.id, limit: 20 })
      if (primaryType) loadEntityActions(primaryType.id, activeEntity.id)
    }
  }, [activeEntity?.id, primaryType?.id, loadScans, loadEntityActions])

  // Auto-refresh scans on tool:status events
  useEffect(() => {
    const cleanup = window.api.on('tool:status', () => {
      if (activeEntity) {
        loadScans({ targetId: activeEntity.id, limit: 20 })
      }
    })
    return cleanup
  }, [activeEntity?.id, loadScans])

  // Two-phase collapse animation
  const [contentVisible, setContentVisible] = useState(contextPanelOpen)

  useLayoutEffect(() => {
    if (contextPanelOpen) {
      setContentVisible(true)
      return undefined
    }
    const timer = setTimeout(() => setContentVisible(false), 100)
    return () => clearTimeout(timer)
  }, [contextPanelOpen])

  return (
    <aside
      className="flex flex-col bg-bg-surface border-l border-border shrink-0 relative overflow-hidden transition-[width] duration-200 ease-out"
      style={{ width: contextPanelOpen ? contextPanelWidth : 32 }}
    >
      {/* Collapsed toggle button */}
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
      {/* Resize handle */}
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
        <QuickAddSection />

        <div className="border-t border-border" />

        {!activeEntity ? (
          <div className="text-text-muted text-xs text-center mt-4">
            <Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>Select a {primaryType?.label.toLowerCase() ?? 'target'} to see</p>
            <p className="mt-1">scans, actions, and suggestions.</p>
          </div>
        ) : (
          <>
            <EntitySummarySection />

            <div>
              <SectionHeader
                title="Active Scans"
                count={runningScans.length + queuedScans.length}
                expanded={scansExpanded}
                onToggle={() => setScansExpanded(!scansExpanded)}
              />
              {scansExpanded && (
                <ActiveExecutionsSection targetId={activeEntity.id} />
              )}
            </div>

            <div>
              <SectionHeader
                title="Suggested Actions"
                count={useEntityStore.getState().actions.length}
                expanded={actionsExpanded}
                onToggle={() => setActionsExpanded(!actionsExpanded)}
              />
              {actionsExpanded && <SuggestedActionsSection />}
            </div>

            <div className="border-t border-border pt-3">
              <EntityStatsSection />
            </div>
          </>
        )}
      </div>
        </div>
      )}
    </aside>
  )
}
