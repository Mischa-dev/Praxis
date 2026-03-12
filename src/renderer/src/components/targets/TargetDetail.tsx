import { useEffect, useState, useCallback } from 'react'
import {
  ArrowLeft,
  Globe,
  Monitor,
  Network,
  Link,
  Mail,
  Server,
  Shield,
  ShieldAlert,
  ShieldQuestion,
  Crosshair,
  Bug,
  ScanLine,
  Clock,
  Key,
  FileText,
  Plus,
  Trash2,
  Save,
  Zap,
  GitBranch
} from 'lucide-react'
import type {
  TargetType,
  ScopeStatus,
  TargetStatus,
  Note,
  Scan,
  ScanStatus,
  Severity,
  Credential,
  CredentialStatus
} from '@shared/types'
import { useTargetStore } from '../../stores/target-store'
import { useUiStore } from '../../stores/ui-store'
import { Badge, SeverityBadge, Tabs, Card, EmptyState, Button } from '../common'
import { ServiceCard } from './ServiceCard'
import { VulnerabilityCard } from './VulnerabilityCard'
import { TargetActions } from './TargetActions'
import { AttackPath } from './AttackPath'
import { useTargetActions } from '../../hooks/useTargetActions'

// ── Reusable maps (same as TargetCard for consistency) ──

const typeIcons: Record<TargetType, typeof Globe> = {
  ip: Monitor,
  cidr: Network,
  hostname: Server,
  domain: Globe,
  url: Link,
  email: Mail
}

const typeLabels: Record<TargetType, string> = {
  ip: 'IP Address',
  cidr: 'CIDR Range',
  hostname: 'Hostname',
  domain: 'Domain',
  url: 'URL',
  email: 'Email'
}

const scopeIcons: Record<ScopeStatus, typeof Shield> = {
  'in-scope': Shield,
  'out-of-scope': ShieldAlert,
  unchecked: ShieldQuestion
}

const scopeClasses: Record<ScopeStatus, string> = {
  'in-scope': 'text-success',
  'out-of-scope': 'text-error',
  unchecked: 'text-text-muted'
}

const scopeLabels: Record<ScopeStatus, string> = {
  'in-scope': 'In Scope',
  'out-of-scope': 'Out of Scope',
  unchecked: 'Unchecked'
}

const statusConfig: Record<
  TargetStatus,
  { label: string; variant: 'default' | 'accent' | 'success' | 'error' }
> = {
  new: { label: 'NEW', variant: 'default' },
  scanning: { label: 'SCANNING', variant: 'accent' },
  scanned: { label: 'SCANNED', variant: 'success' },
  compromised: { label: 'PWNED', variant: 'error' }
}

const scanStatusClasses: Record<ScanStatus, string> = {
  queued: 'text-text-muted',
  running: 'text-accent',
  completed: 'text-success',
  failed: 'text-error',
  cancelled: 'text-text-muted'
}

const credStatusVariant: Record<CredentialStatus, 'success' | 'error' | 'default'> = {
  valid: 'success',
  found: 'default',
  invalid: 'error'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString()
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  return `${mins}m ${secs % 60}s`
}

// ── Tab IDs ──

type DetailTab = 'services' | 'findings' | 'scans' | 'credentials' | 'notes' | 'actions' | 'attack-path'

// ── Main Component ──

interface TargetDetailProps {
  targetId: number
}

export function TargetDetail({ targetId }: TargetDetailProps) {
  const { targetDetail, loading, loadTargetDetail, clearTargetDetail } = useTargetStore()
  const navigate = useUiStore((s) => s.navigate)
  const [activeTab, setActiveTab] = useState<DetailTab>('actions')
  const { actions, loading: actionsLoading, error: actionsError, refresh: refreshActions } = useTargetActions(targetId)

  useEffect(() => {
    loadTargetDetail(targetId)
    return () => clearTargetDetail()
  }, [targetId, loadTargetDetail, clearTargetDetail])

  // Loading skeleton
  if (loading && !targetDetail) {
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

  if (!targetDetail) {
    return (
      <EmptyState
        title="Target not found"
        description="This target may have been removed."
        action={
          <Button variant="secondary" onClick={() => navigate('targets')}>
            Back to Targets
          </Button>
        }
      />
    )
  }

  const detail = targetDetail
  const TypeIcon = typeIcons[detail.type]
  const ScopeIcon = scopeIcons[detail.scope_status]
  const status = statusConfig[detail.status]

  let tags: string[] = []
  try {
    tags = JSON.parse(detail.tags || '[]')
  } catch {
    // ignore
  }

  // Tab data
  const tabs = [
    { id: 'actions' as const, label: 'Actions', icon: <Zap className="w-3.5 h-3.5" />, count: actions.length },
    { id: 'attack-path' as const, label: 'Attack Path', icon: <GitBranch className="w-3.5 h-3.5" />, count: detail.scans.filter((s) => s.status === 'completed' || s.status === 'failed').length },
    { id: 'services' as const, label: 'Services', icon: <Crosshair className="w-3.5 h-3.5" />, count: detail.services.length },
    { id: 'findings' as const, label: 'Findings', icon: <Bug className="w-3.5 h-3.5" />, count: detail.vulnerabilities.length + detail.findings.length },
    { id: 'scans' as const, label: 'Scans', icon: <ScanLine className="w-3.5 h-3.5" />, count: detail.scans.length },
    { id: 'credentials' as const, label: 'Credentials', icon: <Key className="w-3.5 h-3.5" />, count: detail.credentials.length },
    { id: 'notes' as const, label: 'Notes', icon: <FileText className="w-3.5 h-3.5" />, count: detail.notes_list.length }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-border">
        {/* Back button */}
        <button
          onClick={() => navigate('targets')}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Targets
        </button>

        {/* Target info */}
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-bg-elevated border border-border">
            <TypeIcon className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-display font-bold text-text-primary truncate">
                {detail.value}
              </h1>
              <Badge variant={status.variant}>{status.label}</Badge>
              {detail.status === 'scanning' && (
                <span className="w-2 h-2 rounded-full bg-accent status-running" />
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <span>{typeLabels[detail.type]}</span>

              <span className={`flex items-center gap-1 ${scopeClasses[detail.scope_status]}`}>
                <ScopeIcon className="w-3.5 h-3.5" />
                {scopeLabels[detail.scope_status]}
              </span>

              {detail.os_guess && (
                <span className="font-mono">{detail.os_guess}</span>
              )}

              {detail.label && (
                <>
                  <span className="text-border">|</span>
                  <span>{detail.label}</span>
                </>
              )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-[10px] font-sans rounded bg-bg-elevated text-text-secondary border border-border"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex-shrink-0 flex gap-6 text-center">
            <StatBlock label="Services" value={detail.services.length} icon={<Crosshair className="w-4 h-4" />} />
            <StatBlock label="Vulns" value={detail.vulnerabilities.length} icon={<Bug className="w-4 h-4" />} />
            <StatBlock label="Creds" value={detail.credentials.length} icon={<Key className="w-4 h-4" />} />
            <StatBlock label="Scans" value={detail.scans.length} icon={<ScanLine className="w-4 h-4" />} />
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as DetailTab)}
        className="flex-shrink-0 px-6"
      />

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'actions' && (
          <TargetActions
            actions={actions}
            loading={actionsLoading}
            error={actionsError}
            onRefresh={refreshActions}
          />
        )}
        {activeTab === 'attack-path' && <AttackPath detail={detail} />}
        {activeTab === 'services' && <ServicesTab services={detail.services} />}
        {activeTab === 'findings' && (
          <FindingsTab
            vulnerabilities={detail.vulnerabilities}
            findings={detail.findings}
          />
        )}
        {activeTab === 'scans' && <ScansTab scans={detail.scans} />}
        {activeTab === 'credentials' && <CredentialsTab credentials={detail.credentials} />}
        {activeTab === 'notes' && <NotesTab targetId={targetId} notes={detail.notes_list} onRefresh={() => loadTargetDetail(targetId)} />}
      </div>
    </div>
  )
}

// ── Stat Block ──

function StatBlock({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-text-muted">{icon}</div>
      <span className="text-lg font-mono font-bold text-text-primary">{value}</span>
      <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
    </div>
  )
}

// ── Services Tab ──

function ServicesTab({ services }: { services: import('@shared/types').Service[] }) {
  if (services.length === 0) {
    return (
      <EmptyState
        icon={<Crosshair className="w-10 h-10" />}
        title="No services discovered"
        description="Run a port scan to discover services on this target."
      />
    )
  }

  // Sort: open first, then by port
  const sorted = [...services].sort((a, b) => {
    if (a.state === 'open' && b.state !== 'open') return -1
    if (a.state !== 'open' && b.state === 'open') return 1
    return a.port - b.port
  })

  return (
    <div className="space-y-2">
      {sorted.map((svc) => (
        <ServiceCard key={svc.id} service={svc} />
      ))}
    </div>
  )
}

// ── Findings Tab ──

function FindingsTab({
  vulnerabilities,
  findings
}: {
  vulnerabilities: import('@shared/types').Vulnerability[]
  findings: import('@shared/types').Finding[]
}) {
  const hasVulns = vulnerabilities.length > 0
  const hasFindings = findings.length > 0

  if (!hasVulns && !hasFindings) {
    return (
      <EmptyState
        icon={<Bug className="w-10 h-10" />}
        title="No findings yet"
        description="Scan results will populate vulnerabilities and findings here."
      />
    )
  }

  // Sort vulns by severity
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4
  }
  const sortedVulns = [...vulnerabilities].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  )
  const sortedFindings = [...findings].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  )

  return (
    <div className="space-y-6">
      {/* Vulnerabilities */}
      {hasVulns && (
        <div>
          <h3 className="text-xs font-sans uppercase tracking-wider text-text-muted mb-3">
            Vulnerabilities ({vulnerabilities.length})
          </h3>
          <div className="space-y-2">
            {sortedVulns.map((vuln) => (
              <VulnerabilityCard key={vuln.id} vuln={vuln} />
            ))}
          </div>
        </div>
      )}

      {/* General findings */}
      {hasFindings && (
        <div>
          <h3 className="text-xs font-sans uppercase tracking-wider text-text-muted mb-3">
            Findings ({findings.length})
          </h3>
          <div className="space-y-2">
            {sortedFindings.map((f) => (
              <div
                key={f.id}
                className="px-4 py-3 bg-bg-surface border border-border rounded-lg hover:border-border-bright transition-colors"
              >
                <div className="flex items-start gap-3">
                  <SeverityBadge severity={f.severity} className="flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-sans font-semibold text-text-primary truncate">
                        {f.title}
                      </h4>
                      <Badge variant="default" className="text-[10px]">{f.type}</Badge>
                    </div>
                    {f.description && (
                      <p className="text-xs text-text-secondary line-clamp-2">
                        {f.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Scans Tab ──

function ScansTab({ scans }: { scans: Scan[] }) {
  const navigate = useUiStore((s) => s.navigate)

  if (scans.length === 0) {
    return (
      <EmptyState
        icon={<ScanLine className="w-10 h-10" />}
        title="No scans yet"
        description="Run a tool against this target to see scan history."
      />
    )
  }

  return (
    <div className="space-y-2">
      {scans.map((scan) => (
        <div
          key={scan.id}
          onClick={() => navigate('scan-results', { scanId: scan.id })}
          className="flex items-center gap-4 px-4 py-3 bg-bg-surface border border-border rounded-lg hover:border-border-bright transition-colors cursor-pointer"
        >
          {/* Status dot */}
          <span className={`text-xs font-sans font-semibold uppercase ${scanStatusClasses[scan.status]}`}>
            {scan.status}
          </span>

          {/* Tool ID */}
          <span className="font-mono text-sm text-text-primary flex-shrink-0">
            {scan.tool_id}
          </span>

          {/* Command preview */}
          <span className="flex-1 text-xs font-mono text-text-muted truncate" title={scan.command}>
            {scan.command}
          </span>

          {/* Duration */}
          <span className="flex-shrink-0 text-xs text-text-muted font-mono">
            {formatDuration(scan.duration_ms)}
          </span>

          {/* Exit code */}
          {scan.exit_code !== null && (
            <Badge variant={scan.exit_code === 0 ? 'success' : 'error'} className="text-[10px]">
              exit {scan.exit_code}
            </Badge>
          )}

          {/* Timestamp */}
          <span className="flex-shrink-0 text-[10px] text-text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(scan.started_at)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Credentials Tab ──

function CredentialsTab({ credentials }: { credentials: Credential[] }) {
  if (credentials.length === 0) {
    return (
      <EmptyState
        icon={<Key className="w-10 h-10" />}
        title="No credentials found"
        description="Credentials discovered through brute-force or other attacks will appear here."
      />
    )
  }

  return (
    <div className="space-y-2">
      {credentials.map((cred) => (
        <div
          key={cred.id}
          className="flex items-center gap-4 px-4 py-3 bg-bg-surface border border-border rounded-lg hover:border-border-bright transition-colors"
        >
          <Key className="w-4 h-4 text-accent flex-shrink-0" />

          {/* Username */}
          <span className="font-mono text-sm text-text-primary font-semibold">
            {cred.username}
          </span>

          {/* Separator */}
          <span className="text-text-muted">:</span>

          {/* Password or hash */}
          {cred.password ? (
            <span className="font-mono text-sm text-success">{cred.password}</span>
          ) : cred.hash ? (
            <span className="font-mono text-xs text-text-secondary truncate max-w-xs" title={cred.hash}>
              {cred.hash_type && <span className="text-text-muted mr-1">[{cred.hash_type}]</span>}
              {cred.hash}
            </span>
          ) : (
            <span className="text-text-muted text-xs">—</span>
          )}

          <div className="flex-1" />

          {/* Status badge */}
          <Badge variant={credStatusVariant[cred.status]} className="text-[10px] uppercase">
            {cred.status}
          </Badge>

          {/* Source */}
          <span className="text-[10px] text-text-muted font-mono">
            via {cred.source}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Notes Tab ──

function NotesTab({
  targetId,
  notes,
  onRefresh
}: {
  targetId: number
  notes: Note[]
  onRefresh: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = useCallback(async () => {
    if (!newContent.trim()) return
    setSaving(true)
    try {
      await window.api.invoke('note:add', {
        targetId,
        content: newContent.trim(),
        title: newTitle.trim() || undefined
      })
      setNewTitle('')
      setNewContent('')
      setAdding(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }, [targetId, newContent, newTitle, onRefresh])

  const handleUpdate = useCallback(async (noteId: number) => {
    setSaving(true)
    try {
      await window.api.invoke('note:update', {
        noteId,
        updates: {
          title: editTitle.trim() || undefined,
          content: editContent.trim()
        }
      })
      setEditingId(null)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }, [editTitle, editContent, onRefresh])

  const handleRemove = useCallback(async (noteId: number) => {
    await window.api.invoke('note:remove', { noteId })
    onRefresh()
  }, [onRefresh])

  const startEdit = (note: Note) => {
    setEditingId(note.id)
    setEditTitle(note.title || '')
    setEditContent(note.content)
  }

  return (
    <div className="space-y-3">
      {/* Add note button/form */}
      {!adding ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setAdding(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Note
        </Button>
      ) : (
        <Card padding="md" className="space-y-3">
          <input
            type="text"
            placeholder="Title (optional)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent font-sans"
          />
          <textarea
            placeholder="Write your note..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={4}
            autoFocus
            className="w-full bg-bg-input border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent font-mono resize-y"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} loading={saving} disabled={!newContent.trim()}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setNewTitle(''); setNewContent('') }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Existing notes */}
      {notes.length === 0 && !adding && (
        <EmptyState
          icon={<FileText className="w-10 h-10" />}
          title="No notes"
          description="Add notes to keep track of observations and findings."
        />
      )}

      {notes.map((note) => (
        <Card key={note.id} padding="md" className="group relative">
          {editingId === note.id ? (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title (optional)"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent font-sans"
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                autoFocus
                className="w-full bg-bg-input border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent font-mono resize-y"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleUpdate(note.id)} loading={saving}>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Hover actions */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(note)}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                  aria-label="Edit note"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleRemove(note.id)}
                  className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                  aria-label="Delete note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {note.title && (
                <h4 className="text-sm font-sans font-semibold text-text-primary mb-1">
                  {note.title}
                </h4>
              )}
              <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>
              <p className="text-[10px] text-text-muted mt-2">
                {formatDate(note.updated_at)}
              </p>
            </>
          )}
        </Card>
      ))}
    </div>
  )
}
