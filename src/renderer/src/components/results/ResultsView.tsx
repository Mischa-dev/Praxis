import { useEffect, useState, useRef } from 'react'
import {
  ArrowLeft,
  Terminal,
  Table2,
  Hash,
  Copy,
  Check,
  Clock,
  Loader2,
} from 'lucide-react'
import { useScanStore } from '../../stores/scan-store'
import { useUiStore } from '../../stores/ui-store'
import { Badge, Tabs, EmptyState, Button } from '../common'
import {
  ServicesTable,
  VulnerabilitiesTable,
  CredentialsTable,
  WebPathsTable,
  FindingsTable,
} from './ResultsTable'
import { ResultExplanation } from './ResultExplanation'
import { NextStepsSuggestion } from './NextStepsSuggestion'
import type { ScanStatus } from '@shared/types'

// ── Types ──

type ResultsTab = 'raw' | 'parsed' | 'entities'

interface ResultsViewProps {
  scanId: number
}

// ── Status config ──

const statusConfig: Record<ScanStatus, { label: string; variant: 'default' | 'accent' | 'success' | 'error' }> = {
  queued: { label: 'QUEUED', variant: 'default' },
  running: { label: 'RUNNING', variant: 'accent' },
  completed: { label: 'COMPLETED', variant: 'success' },
  failed: { label: 'FAILED', variant: 'error' },
  cancelled: { label: 'CANCELLED', variant: 'default' },
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  return `${mins}m ${secs % 60}s`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString()
}

// ── Main Component ──

export function ResultsView({ scanId }: ResultsViewProps) {
  const {
    activeScan,
    parsedResults,
    scanModule,
    loading,
    resultsLoading,
    error,
    loadScanDetail,
    clearActiveScan,
  } = useScanStore()
  const navigate = useUiStore((s) => s.navigate)
  const [activeTab, setActiveTab] = useState<ResultsTab>('parsed')

  useEffect(() => {
    loadScanDetail(scanId)
    return () => clearActiveScan()
  }, [scanId, loadScanDetail, clearActiveScan])

  // Loading skeleton
  if (loading && !activeScan) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 skeleton rounded" />
        <div className="h-4 w-96 skeleton rounded" />
        <div className="h-10 w-full skeleton rounded mt-6" />
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Error loading scan"
        description={error}
        action={
          <Button variant="secondary" onClick={() => navigate('targets')}>
            Back to Targets
          </Button>
        }
      />
    )
  }

  if (!activeScan) {
    return (
      <EmptyState
        title="Scan not found"
        description="This scan may have been removed."
        action={
          <Button variant="secondary" onClick={() => navigate('targets')}>
            Back to Targets
          </Button>
        }
      />
    )
  }

  const status = statusConfig[activeScan.status]
  const entities = parsedResults?.entities

  // Count parsed entities
  const entityCounts = entities
    ? {
        services: entities.services.length,
        vulns: entities.vulnerabilities.length,
        creds: entities.credentials.length,
        webPaths: entities.webPaths.length,
        findings: entities.findings.length,
        hosts: entities.hosts.length,
      }
    : null

  const totalEntities = entityCounts
    ? Object.values(entityCounts).reduce((a, b) => a + b, 0)
    : 0

  // Build tabs
  const tabs = [
    {
      id: 'parsed' as const,
      label: 'Parsed',
      icon: <Table2 className="w-3.5 h-3.5" />,
      count: totalEntities || undefined,
    },
    {
      id: 'raw' as const,
      label: 'Raw Output',
      icon: <Terminal className="w-3.5 h-3.5" />,
    },
    {
      id: 'entities' as const,
      label: 'Entities',
      icon: <Hash className="w-3.5 h-3.5" />,
      count: entityCounts
        ? (entityCounts.services + entityCounts.vulns + entityCounts.creds + entityCounts.webPaths) || undefined
        : undefined,
    },
  ]

  // Navigation back — go to target detail if we have a target, otherwise targets list
  const goBack = () => {
    if (activeScan.target_id) {
      navigate('target-detail', { targetId: activeScan.target_id })
    } else {
      navigate('targets')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-border">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-display font-bold text-text-primary">
                {scanModule?.name ?? activeScan.tool_id}
              </h1>
              <Badge variant={status.variant}>{status.label}</Badge>
              {activeScan.status === 'running' && (
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              )}
              <span className="text-xs text-text-muted font-mono">#{activeScan.id}</span>
            </div>

            {/* Command */}
            <p className="text-xs font-mono text-text-secondary truncate" title={activeScan.command}>
              {activeScan.command}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(activeScan.started_at)}
              </span>
              {activeScan.duration_ms !== null && (
                <span className="font-mono">{formatDuration(activeScan.duration_ms)}</span>
              )}
              {activeScan.exit_code !== null && (
                <Badge
                  variant={activeScan.exit_code === 0 ? 'success' : 'error'}
                  className="text-[9px]"
                >
                  exit {activeScan.exit_code}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as ResultsTab)}
        className="flex-shrink-0 px-6"
      />

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {resultsLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 skeleton rounded" />
            ))}
          </div>
        )}

        {!resultsLoading && activeTab === 'parsed' && (
          <ParsedTab
            results={parsedResults}
            module={scanModule}
            targetId={activeScan.target_id}
          />
        )}

        {!resultsLoading && activeTab === 'raw' && (
          <RawTab rawOutput={parsedResults?.raw ?? null} scan={activeScan} />
        )}

        {!resultsLoading && activeTab === 'entities' && (
          <EntitiesTab results={parsedResults} />
        )}
      </div>
    </div>
  )
}

// ── Parsed Tab ──

function ParsedTab({
  results,
  module,
  targetId,
}: {
  results: import('@shared/types').ParsedResults | null
  module: import('@shared/types').Module | null
  targetId: number | null
}) {
  if (!results) {
    return (
      <EmptyState
        title="No parsed results"
        description="Results are not yet available. The scan may still be running, or no structured output was produced."
      />
    )
  }

  const { entities } = results
  const hasEntities =
    entities.services.length > 0 ||
    entities.vulnerabilities.length > 0 ||
    entities.credentials.length > 0 ||
    entities.webPaths.length > 0 ||
    entities.findings.length > 0

  return (
    <div className="space-y-6">
      {/* Educational explanation */}
      <ResultExplanation results={results} module={module} />

      {/* Next steps / suggestions */}
      <NextStepsSuggestion results={results} module={module} targetId={targetId} />

      {/* Entity tables */}
      {!hasEntities && (
        <EmptyState
          title="No structured data extracted"
          description="The parser did not extract structured entities from this scan's output. Check the Raw Output tab for the full output."
        />
      )}

      {entities.services.length > 0 && (
        <EntitySection title="Services" count={entities.services.length}>
          <ServicesTable data={entities.services} />
        </EntitySection>
      )}

      {entities.vulnerabilities.length > 0 && (
        <EntitySection title="Vulnerabilities" count={entities.vulnerabilities.length}>
          <VulnerabilitiesTable data={entities.vulnerabilities} />
        </EntitySection>
      )}

      {entities.credentials.length > 0 && (
        <EntitySection title="Credentials" count={entities.credentials.length}>
          <CredentialsTable data={entities.credentials} />
        </EntitySection>
      )}

      {entities.webPaths.length > 0 && (
        <EntitySection title="Web Paths" count={entities.webPaths.length}>
          <WebPathsTable data={entities.webPaths} />
        </EntitySection>
      )}

      {entities.findings.length > 0 && (
        <EntitySection title="Findings" count={entities.findings.length}>
          <FindingsTable data={entities.findings} />
        </EntitySection>
      )}
    </div>
  )
}

// ── Entity Section wrapper ──

function EntitySection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="text-xs font-sans uppercase tracking-wider text-text-muted mb-3">
        {title} ({count})
      </h3>
      {children}
    </div>
  )
}

// ── Raw Tab ──

function RawTab({
  rawOutput,
  scan,
}: {
  rawOutput: string | null
  scan: import('@shared/types').Scan
}) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  const handleCopy = () => {
    const text = rawOutput || ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!rawOutput && scan.status !== 'completed') {
    return (
      <EmptyState
        title="Output not available"
        description={
          scan.status === 'running'
            ? 'The scan is still running. Output will be available when it completes.'
            : 'No output was captured for this scan.'
        }
      />
    )
  }

  if (!rawOutput) {
    return (
      <EmptyState
        title="No output"
        description="This scan produced no output."
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-muted font-mono">
          {rawOutput.split('\n').length} lines
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-success" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Raw output */}
      <pre
        ref={preRef}
        className="p-4 bg-[#080808] border border-border rounded-lg text-xs font-mono text-text-primary leading-relaxed overflow-auto max-h-[calc(100vh-350px)] whitespace-pre-wrap break-all select-text"
      >
        {rawOutput}
      </pre>

      {/* Error output */}
      {scan.error_output && (
        <div>
          <h4 className="text-[10px] font-sans uppercase tracking-wider text-error mb-2">
            Error Output
          </h4>
          <pre className="p-4 bg-error/5 border border-error/20 rounded-lg text-xs font-mono text-error/80 leading-relaxed overflow-auto max-h-48 whitespace-pre-wrap break-all select-text">
            {scan.error_output}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Entities Tab ──

function EntitiesTab({ results }: { results: import('@shared/types').ParsedResults | null }) {
  if (!results) {
    return (
      <EmptyState
        title="No entities extracted"
        description="Parsed results are not available."
      />
    )
  }

  const { entities } = results

  // Build a flat list of all entity tables for the "all-in-one" view
  const sections: { type: string; count: number; content: React.ReactNode }[] = []

  if (entities.services.length > 0) {
    sections.push({
      type: 'Services',
      count: entities.services.length,
      content: <ServicesTable data={entities.services} />,
    })
  }

  if (entities.vulnerabilities.length > 0) {
    sections.push({
      type: 'Vulnerabilities',
      count: entities.vulnerabilities.length,
      content: <VulnerabilitiesTable data={entities.vulnerabilities} />,
    })
  }

  if (entities.credentials.length > 0) {
    sections.push({
      type: 'Credentials',
      count: entities.credentials.length,
      content: <CredentialsTable data={entities.credentials} />,
    })
  }

  if (entities.webPaths.length > 0) {
    sections.push({
      type: 'Web Paths',
      count: entities.webPaths.length,
      content: <WebPathsTable data={entities.webPaths} />,
    })
  }

  if (entities.findings.length > 0) {
    sections.push({
      type: 'Findings',
      count: entities.findings.length,
      content: <FindingsTable data={entities.findings} />,
    })
  }

  if (sections.length === 0) {
    return (
      <EmptyState
        title="No entities extracted"
        description="No structured entities were extracted from this scan. Check the Raw Output tab for the full output."
      />
    )
  }

  // Summary counts
  const totalCount = sections.reduce((sum, s) => sum + s.count, 0)

  return (
    <div className="space-y-6">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <Badge key={s.type} variant="default" className="text-xs">
            {s.type}: {s.count}
          </Badge>
        ))}
        <Badge variant="accent" className="text-xs">Total: {totalCount}</Badge>
      </div>

      {/* Entity tables */}
      {sections.map((s) => (
        <EntitySection key={s.type} title={s.type} count={s.count}>
          {s.content}
        </EntitySection>
      ))}
    </div>
  )
}
