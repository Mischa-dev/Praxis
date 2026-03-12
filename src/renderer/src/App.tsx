import { Component, useCallback, useEffect, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AppLayout } from './components/layout'
import { GuidedTour } from './components/educational'
import { CommandPalette } from './components/command-palette'
import { ToastContainer } from './components/notifications'
import { useProfileStore } from './stores/profile-store'
import { useModuleStore } from './stores/module-store'
import { useTargetStore } from './stores/target-store'
import { useWorkspaceStore } from './stores/workspace-store'
import { useTerminalStore } from './stores/terminal-store'
import { useSettingsStore } from './stores/settings-store'
import { useNotificationStore } from './stores/notification-store'
import { sendDesktopNotification } from './stores/notification-store'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import type { ToolStatusEvent } from '@shared/types/ipc'

/** Error boundary so component crashes don't result in a blank screen */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; componentStack: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null, componentStack: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Aeth0n] React error boundary caught:', error, info.componentStack)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#0a0a0a', color: '#ff3333', fontFamily: 'monospace', padding: 32, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          <p style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 14 }}>Component Error</p>
          <p style={{ color: '#d4d4d4', fontSize: 12, maxWidth: 600, textAlign: 'center' }}>
            {this.state.error?.message ?? 'Unknown error'}
          </p>
          {this.state.componentStack && (
            <pre style={{ color: '#737373', fontSize: 10, maxWidth: 700, maxHeight: 300, overflow: 'auto', marginTop: 12, padding: 12, background: '#111', borderRadius: 4, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
              {this.state.componentStack}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null, componentStack: null })}
            style={{ marginTop: 16, padding: '6px 16px', background: '#1a1a1a', color: '#00ff41', border: '1px solid #2a2a2a', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function App(): React.JSX.Element {
  const { loadProfile, loading, error } = useProfileStore()
  const loadModules = useModuleStore((s) => s.loadModules)
  const loadTargets = useTargetStore((s) => s.loadTargets)
  const loadCurrentWorkspace = useWorkspaceStore((s) => s.loadCurrentWorkspace)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Load profile, settings, and workspace on mount, then load modules and targets
  useEffect(() => {
    loadSettings()
    loadCurrentWorkspace()
    loadProfile().then(() => {
      loadModules()
      loadTargets()

      // Apply profile-level effect defaults
      const manifest = useProfileStore.getState().manifest
      if (manifest?.effects) {
        const effects = manifest.effects
        if (effects.scanlines === false) document.documentElement.classList.add('no-scanlines')
        if (effects.glow === false) document.documentElement.classList.add('no-glow')
      }
    })
  }, [loadProfile, loadModules, loadTargets, loadSettings, loadCurrentWorkspace])

  // Global listener: update terminal session status + fire notifications on tool:status events
  useEffect(() => {
    const cleanup = window.api.on('tool:status', (event: unknown) => {
      const e = event as ToolStatusEvent
      const sessionId = `scan-${e.scanId}`
      useTerminalStore.getState().updateSessionStatus(sessionId, e.status)

      // Fire toast notifications based on scan status
      const settings = useSettingsStore.getState().settings
      const notify = useNotificationStore.getState()
      const session = useTerminalStore.getState().sessions.find((s) => s.id === sessionId)
      const label = session?.label || `Scan ${e.scanId}`

      if (e.status === 'completed' && settings.notifyScanComplete) {
        notify.success('Scan Complete', `${label} finished successfully`)
        if (settings.desktopNotifications) {
          sendDesktopNotification('Scan Complete', `${label} finished successfully`)
        }
      } else if (e.status === 'failed') {
        notify.error('Scan Failed', `${label} exited with an error`)
        if (settings.desktopNotifications) {
          sendDesktopNotification('Scan Failed', `${label} exited with an error`)
        }
      } else if (e.status === 'cancelled') {
        notify.warn('Scan Cancelled', `${label} was cancelled`)
      }
    })
    return cleanup
  }, [])

  // Global keyboard shortcuts (all shortcuts from PRD Section 4.4)
  const toggleCommandPalette = useCallback(() => setCommandPaletteOpen((prev) => !prev), [])
  useKeyboardShortcuts({ onToggleCommandPalette: toggleCommandPalette })


  if (loading) {
    return (
      <div className="h-screen w-screen bg-bg-base flex flex-col items-center justify-center gap-4 fade-in">
        <pre className="text-accent text-glow font-mono text-sm leading-tight whitespace-pre text-center">
{`     ___       __  __  ____
    /   | ____/ /_/ /_/ __ \\____
   / /| |/ _ \\ __/ __\\/ / / / __ \\
  / ___ /  __/ /_/ /_/ /_/ / / / /
 /_/  |_\\___/\\__/\\__/\\____/_/ /_/`}
        </pre>
        <div className="flex flex-col items-center gap-2">
          <div className="skeleton w-32 h-1 rounded" />
          <span className="text-text-muted text-xs font-mono tracking-wider">
            INITIALIZING
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-bg-base text-error flex items-center justify-center font-sans text-sm">
        <div className="text-center">
          <p className="font-bold mb-2">Profile Error</p>
          <p className="text-text-secondary">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <AppLayout />
      <GuidedTour />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <ToastContainer />
    </ErrorBoundary>
  )
}

export default App
