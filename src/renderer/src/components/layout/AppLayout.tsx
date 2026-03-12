import { useCallback } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { MainContent } from './MainContent'
import { ContextPanel } from './ContextPanel'
import { StatusBar } from './StatusBar'
import { TerminalTabs } from '../terminal'
import { useTerminalStore } from '../../stores/terminal-store'
import { useProfileStore } from '../../stores/profile-store'

export function AppLayout() {
  const paneOpen = useTerminalStore((s) => s.paneOpen)
  const closePane = useTerminalStore((s) => s.closePane)
  const sessionCount = useTerminalStore((s) => s.sessions.length)
  const layout = useProfileStore((s) => s.manifest?.layout)

  const handleCloseTerminal = useCallback(() => {
    closePane()
  }, [closePane])

  const sidebarPos = layout?.sidebar?.position ?? 'left'
  const contextPos = layout?.context_panel?.position ?? 'right'
  const terminalPos = layout?.terminal?.position ?? 'bottom'
  const statusBarEnabled = layout?.status_bar?.enabled ?? true
  const contextHidden = contextPos === 'hidden'
  const terminalHidden = terminalPos === 'hidden'

  return (
    <div className="flex flex-col h-screen w-screen bg-bg-base text-text-primary font-sans overflow-hidden">
      {/* Custom title bar */}
      <TitleBar />

      {/* 3-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar (configurable position) */}
        {sidebarPos === 'left' && <Sidebar />}
        {!contextHidden && contextPos === 'left' && <ContextPanel />}

        {/* Center: main content + terminal */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Main content area */}
          <main className="flex-1 min-h-0 overflow-y-auto">
            <MainContent />
          </main>

          {/* Terminal pane (collapsible, position-configurable) */}
          {!terminalHidden && paneOpen && sessionCount > 0 && (
            <TerminalTabs onClose={handleCloseTerminal} />
          )}
        </div>

        {/* Right panels */}
        {sidebarPos === 'right' && <Sidebar />}
        {!contextHidden && contextPos === 'right' && <ContextPanel />}
      </div>

      {/* Bottom status bar */}
      {statusBarEnabled && <StatusBar />}
    </div>
  )
}
