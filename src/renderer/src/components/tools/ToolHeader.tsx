import type { Module } from '@shared/types/module'
import { Badge } from '../common'

interface ToolHeaderProps {
  module: Module
  onCheckInstall?: () => void
  checkingInstall?: boolean
}

export function ToolHeader({
  module: mod,
  onCheckInstall,
  checkingInstall
}: ToolHeaderProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {/* Top row: name + badges */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-display text-text-primary truncate">
              {mod.name}
            </h1>
            <Badge variant={mod.installed ? 'success' : 'error'}>
              {mod.installed ? 'INSTALLED' : 'NOT INSTALLED'}
            </Badge>
            {mod.executionMode === 'reference' && (
              <Badge variant="purple">REFERENCE</Badge>
            )}
            {mod.interactive && (
              <Badge variant="accent">INTERACTIVE</Badge>
            )}
          </div>
          <p className="text-sm text-text-secondary font-sans">{mod.description}</p>
        </div>

        {/* Install / docs buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {!mod.installed && mod.installCommand && (
            <button
              type="button"
              onClick={onCheckInstall}
              disabled={checkingInstall}
              className="px-3 py-1.5 text-xs font-sans bg-accent/10 text-accent border border-accent/20 rounded-md hover:bg-accent/20 transition-colors disabled:opacity-40"
            >
              {checkingInstall ? 'Checking...' : 'Check Install'}
            </button>
          )}
          {mod.documentationUrl && (
            <a
              href={mod.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-sans text-text-secondary border border-border rounded-md hover:border-border-bright hover:text-text-primary transition-colors"
            >
              Docs
            </a>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs font-mono text-text-muted">
        <span>
          <span className="text-text-secondary">Binary:</span>{' '}
          <span className="text-accent/70">{mod.binary}</span>
        </span>
        <span>
          <span className="text-text-secondary">Category:</span>{' '}
          {mod.category}
        </span>
        {mod.requiresRoot && (
          <span className="text-severity-high">
            Requires root
          </span>
        )}
        {mod.rootOptional && !mod.requiresRoot && (
          <span className="text-severity-medium">
            Root optional (enables more features)
          </span>
        )}
        {mod.timeout && (
          <span>
            <span className="text-text-secondary">Timeout:</span>{' '}
            {mod.timeout}s
          </span>
        )}
      </div>

      {/* Tags */}
      {mod.tags && mod.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mod.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[10px] font-mono text-text-muted bg-bg-elevated border border-border rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Install command hint */}
      {!mod.installed && mod.installCommand && (
        <div className="px-3 py-2 bg-bg-elevated border border-border rounded-md">
          <p className="text-xs text-text-muted font-sans mb-1">Install with:</p>
          <code className="text-xs font-mono text-accent">{mod.installCommand}</code>
        </div>
      )}

      {/* Reference mode info */}
      {mod.executionMode === 'reference' && mod.transferCommands && (
        <div className="px-3 py-2 bg-accent/5 border border-accent/10 rounded-md">
          <p className="text-xs text-text-secondary font-sans mb-1.5">
            This tool runs on the target, not locally. Transfer it first:
          </p>
          <div className="flex flex-col gap-1">
            {mod.transferCommands.map((tc) => (
              <div key={tc.label} className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted font-mono w-16">{tc.label}:</span>
                <code className="text-xs font-mono text-accent/70">{tc.command}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
