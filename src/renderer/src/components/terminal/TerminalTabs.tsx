/**
 * TerminalTabs — manages multiple concurrent terminal sessions.
 * Shows a tab bar with session labels, status indicators, and action buttons.
 * Renders TerminalPane instances for each session (kept alive for scrollback).
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import {
  Terminal as TerminalIcon,
  X,
  Search,
  Trash2,
  Minus
} from 'lucide-react'
import { TerminalPane } from './TerminalPane'
import {
  useTerminalStore,
  type TerminalSession
} from '../../stores/terminal-store'
import '../../terminal.css'

// Status colors for session indicator dot
function statusColor(status: TerminalSession['status']): string {
  switch (status) {
    case 'running':
      return 'bg-accent animate-pulse'
    case 'completed':
      return 'bg-success'
    case 'failed':
      return 'bg-error'
    case 'cancelled':
      return 'bg-severity-medium'
    case 'idle':
    default:
      return 'bg-text-muted'
  }
}

interface TerminalTabsProps {
  onClose: () => void
}

export function TerminalTabs({ onClose }: TerminalTabsProps) {
  const sessions = useTerminalStore((s) => s.sessions)
  const activeSessionId = useTerminalStore((s) => s.activeSessionId)
  const setActiveSession = useTerminalStore((s) => s.setActiveSession)
  const removeSession = useTerminalStore((s) => s.removeSession)

  // Drag-to-resize state
  const containerRef = useRef<HTMLDivElement>(null)
  const setPaneHeight = useTerminalStore((s) => s.setPaneHeight)
  const paneHeight = useTerminalStore((s) => s.paneHeight)
  const [resizing, setResizing] = useState(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setResizing(true)
      startYRef.current = e.clientY
      startHeightRef.current = paneHeight
    },
    [paneHeight]
  )

  useEffect(() => {
    if (!resizing) return

    const handleMove = (e: MouseEvent) => {
      const delta = startYRef.current - e.clientY
      setPaneHeight(startHeightRef.current + delta)
    }
    const handleUp = () => setResizing(false)

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
  }, [resizing, setPaneHeight])

  // Close a tab
  const handleCloseTab = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      removeSession(id)
    },
    [removeSession]
  )

  // Dispatch custom events to the active terminal pane
  const dispatchToActivePane = useCallback(
    (action: 'clear' | 'search') => {
      if (!activeSessionId) return
      // Find the scanId from the active session
      const session = sessions.find((s) => s.id === activeSessionId)
      const scanId = session?.scanId
      window.dispatchEvent(new CustomEvent(`terminal:${action}:${scanId}`))
    },
    [activeSessionId, sessions]
  )

  if (sessions.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="flex flex-col border-t border-border bg-bg-base relative"
      style={{ height: paneHeight }}
    >
      {/* Resize handle */}
      <div
        className={`terminal-resize-handle ${resizing ? 'active' : ''}`}
        onMouseDown={handleResizeStart}
      />

      {/* Tab bar */}
      <div className="flex items-center gap-0 px-1 h-8 min-h-[32px] bg-bg-surface border-b border-border">
        {/* Terminal icon */}
        <div className="flex items-center px-2 text-text-muted">
          <TerminalIcon size={14} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 flex-1 min-w-0 overflow-x-auto scrollbar-hidden">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={`group flex items-center gap-1.5 px-3 h-7 text-xs font-sans whitespace-nowrap border-r border-border transition-colors ${
                session.id === activeSessionId
                  ? 'bg-bg-base text-text-primary'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              {/* Status dot */}
              <span className={`w-1.5 h-1.5 rounded-full ${statusColor(session.status)}`} />

              {/* Label */}
              <span className="truncate max-w-[120px]">{session.label}</span>

              {/* Close button */}
              <button
                onClick={(e) => handleCloseTab(e, session.id)}
                className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-elevated transition-opacity"
                title="Close session"
              >
                <X size={10} />
              </button>
            </button>
          ))}
        </div>

        {/* Toolbar buttons */}
        <div className="flex items-center gap-0.5 px-1">
          <ToolbarButton
            icon={<Search size={13} />}
            title="Search in terminal (Ctrl+F)"
            onClick={() => dispatchToActivePane('search')}
          />
          <ToolbarButton
            icon={<Trash2 size={13} />}
            title="Clear terminal (Ctrl+L)"
            onClick={() => dispatchToActivePane('clear')}
          />
          <ToolbarButton
            icon={<Minus size={13} />}
            title="Collapse terminal (Ctrl+J)"
            onClick={onClose}
          />
        </div>
      </div>

      {/* Terminal panes — all mounted, visibility toggled */}
      <div className="flex-1 min-h-0 relative">
        {sessions.map((session) => (
          <TerminalPane
            key={session.id}
            scanId={session.scanId}
            active={session.id === activeSessionId}
          />
        ))}
      </div>
    </div>
  )
}

// Small toolbar button helper
function ToolbarButton({
  icon,
  title,
  onClick
}: {
  icon: React.ReactNode
  title: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-6 h-6 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
    >
      {icon}
    </button>
  )
}
