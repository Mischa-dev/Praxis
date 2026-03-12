import { useState } from 'react'
import { Dialog, DialogFooter, Button, Badge } from '../common'
import { AlertTriangle, ExternalLink, ShieldAlert } from 'lucide-react'
import type { ScopeCheckResult } from '@shared/types/ipc'

interface ScopeWarningProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  result: ScopeCheckResult
  targetValue: string
}

export function ScopeWarning({ open, onClose, onConfirm, result, targetValue }: ScopeWarningProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  const isCloudProvider = !!result.cloudProvider
  const title = isCloudProvider ? 'Cloud Provider Detected' : 'Scope Warning'

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-lg">
      <div className="space-y-4">
        {/* Warning icon and target */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-lg bg-severity-high/10">
            {isCloudProvider ? (
              <ShieldAlert className="w-5 h-5 text-severity-high" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-severity-medium" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono text-text-primary break-all">{targetValue}</p>
            {isCloudProvider && (
              <Badge variant="error" className="mt-1.5 text-[10px]">
                {result.cloudProvider!.description}
              </Badge>
            )}
          </div>
        </div>

        {/* Warning messages */}
        <div className="space-y-2">
          {result.warnings.map((warning, i) => (
            <p key={i} className="text-xs text-text-secondary leading-relaxed">
              {warning}
            </p>
          ))}
        </div>

        {/* Auth policy link */}
        {isCloudProvider && result.cloudProvider!.authPolicyUrl && (
          <a
            href={result.cloudProvider!.authPolicyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-accent hover:underline"
            onClick={(e) => {
              e.preventDefault()
              // Electron's setWindowOpenHandler routes this to shell.openExternal
              window.open(result.cloudProvider!.authPolicyUrl, '_blank')
            }}
          >
            <ExternalLink className="w-3 h-3" />
            View {result.cloudProvider!.name} authorization policy
          </a>
        )}

        {/* Acknowledgment checkbox */}
        {isCloudProvider && (
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border-bright bg-bg-input accent-accent
                         focus:ring-1 focus:ring-accent/50 cursor-pointer"
            />
            <span className="text-xs text-text-secondary leading-relaxed group-hover:text-text-primary transition-colors">
              I have authorization to test this target and understand it is hosted on{' '}
              {result.cloudProvider!.description} infrastructure.
            </span>
          </label>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={isCloudProvider ? 'danger' : 'primary'}
            size="sm"
            onClick={() => {
              setAcknowledged(false)
              onConfirm()
            }}
            disabled={isCloudProvider && !acknowledged}
          >
            {isCloudProvider ? 'I Have Authorization — Proceed' : 'Continue'}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}
