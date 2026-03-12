// Active executions section for the context panel — shows running/queued scans

import { useMemo } from 'react'
import { Loader2, Clock, CheckCircle2, XCircle, Square } from 'lucide-react'
import { useScanStore } from '../../stores/scan-store'
import { useUiStore } from '../../stores/ui-store'
import { ProgressBar } from '../common'
import type { Scan } from '@shared/types'

function ScanStatusIcon({ status }: { status: string }): React.JSX.Element {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3 h-3 text-accent animate-spin" />
    case 'queued':
      return <Clock className="w-3 h-3 text-text-muted" />
    case 'completed':
      return <CheckCircle2 className="w-3 h-3 text-success" />
    case 'failed':
      return <XCircle className="w-3 h-3 text-error" />
    case 'cancelled':
      return <Square className="w-3 h-3 text-text-muted" />
    default:
      return <Clock className="w-3 h-3 text-text-muted" />
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

function ScanRow({ scan, onClick }: { scan: Scan; onClick: () => void }): React.JSX.Element {
  const isRunning = scan.status === 'running'

  return (
    <button
      onClick={onClick}
      className="flex flex-col w-full text-left px-2 py-1.5 rounded hover:bg-bg-elevated transition-colors gap-1"
    >
      <div className="flex items-center gap-1.5 w-full">
        <ScanStatusIcon status={scan.status} />
        <span className="text-[11px] font-mono text-text-primary truncate flex-1">
          {scan.tool_id}
        </span>
        <span className="text-[9px] text-text-muted font-mono flex-shrink-0">
          {scan.completed_at
            ? formatRelativeTime(scan.completed_at)
            : scan.started_at
              ? formatRelativeTime(scan.started_at)
              : ''}
        </span>
      </div>
      {isRunning && (
        <ProgressBar value={0} indeterminate variant="accent" size="sm" className="ml-4.5" />
      )}
      {scan.status === 'completed' && scan.duration_ms != null && (
        <span className="text-[9px] text-text-muted font-mono ml-4.5">
          {formatDuration(scan.duration_ms)}
        </span>
      )}
    </button>
  )
}

interface ActiveExecutionsSectionProps {
  targetId?: number
}

export function ActiveExecutionsSection(_props: ActiveExecutionsSectionProps): React.JSX.Element | null {
  const scans = useScanStore((s) => s.scans)
  const navigate = useUiStore((s) => s.navigate)

  const runningScans = useMemo(
    () => scans.filter((s) => s.status === 'running' || s.status === 'queued'),
    [scans]
  )

  const recentScans = useMemo(
    () => scans.filter((s) => s.status === 'completed').slice(0, 10),
    [scans]
  )

  if (runningScans.length === 0 && recentScans.length === 0) return null

  return (
    <div className="space-y-2">
      {runningScans.length > 0 && (
        <div className="space-y-0.5">
          {runningScans.map((scan) => (
            <ScanRow
              key={scan.id}
              scan={scan}
              onClick={() => navigate('scan-results', { scanId: scan.id })}
            />
          ))}
        </div>
      )}
      {recentScans.length > 0 && (
        <div className="space-y-0.5">
          {recentScans.map((scan) => (
            <ScanRow
              key={scan.id}
              scan={scan}
              onClick={() => navigate('scan-results', { scanId: scan.id })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
