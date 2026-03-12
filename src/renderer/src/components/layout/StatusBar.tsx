import { Folder, Target, Activity, Crosshair, Terminal } from 'lucide-react'
import { useTargetStore, selectTargetCount, selectActiveTarget } from '../../stores/target-store'
import { useTerminalStore, selectRunningCount } from '../../stores/terminal-store'

export function StatusBar() {
  const targetCount = useTargetStore(selectTargetCount)
  const activeTarget = useTargetStore(selectActiveTarget)
  const runningCount = useTerminalStore(selectRunningCount)
  const togglePane = useTerminalStore((s) => s.togglePane)
  const sessionCount = useTerminalStore((s) => s.sessions.length)

  return (
    <div className="flex items-center h-6 bg-bg-surface border-t border-border px-3 text-[11px] text-text-muted shrink-0 gap-4">
      <span className="flex items-center gap-1.5">
        <Folder className="w-3 h-3" />
        Default Workspace
      </span>
      <span className="flex items-center gap-1.5">
        <Target className="w-3 h-3" />
        {targetCount} target{targetCount !== 1 ? 's' : ''}
      </span>
      {activeTarget && (
        <span className="flex items-center gap-1.5 text-accent text-glow">
          <Crosshair className="w-3 h-3" />
          {activeTarget.value}
        </span>
      )}
      <span className={`flex items-center gap-1.5 ${runningCount > 0 ? 'text-accent status-running' : ''}`}>
        <Activity className="w-3 h-3" />
        {runningCount > 0
          ? `${runningCount} scan${runningCount !== 1 ? 's' : ''} running`
          : 'Idle'}
      </span>
      <div className="flex-1" />
      {sessionCount > 0 && (
        <button
          onClick={togglePane}
          className="flex items-center gap-1 hover:text-text-primary transition-colors"
          title="Toggle terminal (Ctrl+J)"
        >
          <Terminal className="w-3 h-3" />
          {sessionCount}
        </button>
      )}
      <span className="text-text-muted">v0.1.0</span>
    </div>
  )
}
