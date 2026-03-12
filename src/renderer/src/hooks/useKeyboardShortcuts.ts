/**
 * useKeyboardShortcuts — global keyboard shortcut handler.
 *
 * Registers all shortcuts from PRD Section 4.4 and exposes
 * a typed shortcut registry for display in the command palette
 * and tooltips.
 */

import { useEffect } from 'react'
import { useUiStore } from '../stores/ui-store'
import { useTerminalStore } from '../stores/terminal-store'
import type { ViewId } from '@shared/types'

// ── Shortcut registry (for display in palette / tooltips) ──

export interface ShortcutEntry {
  /** Human-readable key combo, e.g. "Ctrl+K" */
  keys: string
  /** What the shortcut does */
  label: string
  /** Associated view (if it navigates) */
  view?: ViewId
}

/**
 * Static registry of all keyboard shortcuts.
 * Used by the command palette to show shortcut badges.
 */
export const SHORTCUTS: ShortcutEntry[] = [
  { keys: 'Ctrl+K', label: 'Command palette' },
  { keys: 'Ctrl+J', label: 'Toggle terminal pane' },
  { keys: 'Ctrl+N', label: 'New target', view: 'targets' },
  { keys: 'Ctrl+L', label: 'Clear terminal' },
  { keys: 'Ctrl+Shift+P', label: 'Pipeline builder', view: 'pipeline-builder' },
  { keys: 'Ctrl+,', label: 'Settings', view: 'settings' },
  { keys: 'Ctrl+H', label: 'Command history', view: 'history' },
  { keys: 'Ctrl+1', label: 'Home', view: 'home' },
  { keys: 'Ctrl+2', label: 'Targets', view: 'targets' },
  { keys: 'Ctrl+3', label: 'Workflows', view: 'workflow-view' },
  { keys: 'Ctrl+4', label: 'Pipelines', view: 'pipeline-builder' },
  { keys: 'Ctrl+5', label: 'Reports', view: 'report-builder' },
  { keys: 'Ctrl+6', label: 'History', view: 'history' },
  { keys: 'Ctrl+Shift+F', label: 'Search project', view: 'global-search' },
]

/** Look up the shortcut string for a given view ID */
export function shortcutForView(viewId: ViewId): string | undefined {
  return SHORTCUTS.find((s) => s.view === viewId)?.keys
}

// ── Sidebar nav items in order (Ctrl+1-9 mapping) ──

const SIDEBAR_VIEWS: ViewId[] = [
  'home',
  'targets',
  'workflow-view',
  'pipeline-builder',
  'report-builder',
  'history',
]

// ── Hook ──

interface UseKeyboardShortcutsOptions {
  /** Toggle command palette open/close */
  onToggleCommandPalette: () => void
}

export function useKeyboardShortcuts({ onToggleCommandPalette }: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return

      // Ignore when typing in inputs (except for global shortcuts)
      const target = e.target as HTMLElement | null
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      switch (e.key) {
        // Ctrl+K — Command palette (always active)
        case 'k':
          e.preventDefault()
          onToggleCommandPalette()
          return

        // Ctrl+J — Toggle terminal pane (always active)
        case 'j':
          e.preventDefault()
          useTerminalStore.getState().togglePane()
          return

        // Ctrl+L — Clear terminal (always active)
        case 'l':
          if (!isInput) {
            e.preventDefault()
            // Clear the active terminal session's output
            // The terminal pane handles this via xterm.js clear
            const pane = document.querySelector('[data-terminal-active]') as HTMLElement | null
            if (pane) {
              pane.dispatchEvent(new CustomEvent('terminal:clear'))
            }
          }
          return

        // Ctrl+N — New target
        case 'n':
          if (!isInput) {
            e.preventDefault()
            useUiStore.getState().navigate('targets')
          }
          return

        // Ctrl+, — Settings
        case ',':
          e.preventDefault()
          useUiStore.getState().navigate('settings')
          return

        // Ctrl+H — Command history
        case 'h':
          if (!isInput) {
            e.preventDefault()
            useUiStore.getState().navigate('history')
          }
          return

        // Ctrl+Shift+P — Pipeline builder
        case 'P':
          if (e.shiftKey) {
            e.preventDefault()
            useUiStore.getState().navigate('pipeline-builder')
          }
          return

        // Ctrl+Shift+F — Global search
        case 'F':
          if (e.shiftKey) {
            e.preventDefault()
            useUiStore.getState().navigate('global-search')
          }
          return
      }

      // Ctrl+1-9 — Switch sidebar sections
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= 9 && !isInput) {
        const viewIndex = num - 1
        if (viewIndex < SIDEBAR_VIEWS.length) {
          e.preventDefault()
          useUiStore.getState().navigate(SIDEBAR_VIEWS[viewIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onToggleCommandPalette])
}
