import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search } from 'lucide-react'
import { Badge, SeverityBadge } from '../common'
import type { Service, Vulnerability, Credential, WebPath, Finding } from '@shared/types'

// ── Generic column definition ──

interface Column<T> {
  id: string
  label: string
  accessor: (row: T) => string | number | null | undefined
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

type SortDir = 'asc' | 'desc'

// ── Service columns ──

const serviceColumns: Column<Service>[] = [
  {
    id: 'port',
    label: 'Port',
    accessor: (s) => s.port,
    render: (s) => (
      <span className="font-mono font-semibold text-accent">{s.port}/{s.protocol}</span>
    ),
    sortable: true,
    width: 'w-24',
  },
  {
    id: 'state',
    label: 'State',
    accessor: (s) => s.state,
    render: (s) => (
      <Badge variant={s.state === 'open' ? 'success' : s.state === 'filtered' ? 'default' : 'error'}>
        {s.state}
      </Badge>
    ),
    sortable: true,
    width: 'w-24',
  },
  {
    id: 'service',
    label: 'Service',
    accessor: (s) => s.service_name,
    render: (s) => <span className="font-mono">{s.service_name || '—'}</span>,
    sortable: true,
  },
  {
    id: 'product',
    label: 'Product / Version',
    accessor: (s) => s.product,
    render: (s) => (
      <span className="text-text-secondary">
        {s.product || ''}
        {s.service_version ? ` ${s.service_version}` : ''}
        {!s.product && !s.service_version ? '—' : ''}
      </span>
    ),
    sortable: true,
  },
]

// ── Vulnerability columns ──

const vulnColumns: Column<Vulnerability>[] = [
  {
    id: 'severity',
    label: 'Severity',
    accessor: (v) => v.severity,
    render: (v) => <SeverityBadge severity={v.severity} />,
    sortable: true,
    width: 'w-24',
  },
  {
    id: 'title',
    label: 'Title',
    accessor: (v) => v.title,
    render: (v) => <span className="font-sans font-semibold">{v.title}</span>,
    sortable: true,
  },
  {
    id: 'cve',
    label: 'CVE',
    accessor: (v) => v.cve,
    render: (v) => v.cve ? <span className="font-mono text-accent text-xs">{v.cve}</span> : <span className="text-text-muted">—</span>,
    sortable: true,
    width: 'w-36',
  },
  {
    id: 'source',
    label: 'Source',
    accessor: (v) => v.discovered_by,
    render: (v) => <span className="text-text-muted text-xs font-mono">{v.discovered_by}</span>,
    width: 'w-28',
  },
]

// ── Credential columns ──

const credColumns: Column<Credential>[] = [
  {
    id: 'username',
    label: 'Username',
    accessor: (c) => c.username,
    render: (c) => <span className="font-mono font-semibold">{c.username}</span>,
    sortable: true,
  },
  {
    id: 'password',
    label: 'Password / Hash',
    accessor: (c) => c.password ?? c.hash,
    render: (c) =>
      c.password ? (
        <span className="font-mono text-success">{c.password}</span>
      ) : c.hash ? (
        <span className="font-mono text-xs text-text-secondary truncate" title={c.hash}>
          {c.hash_type && <span className="text-text-muted mr-1">[{c.hash_type}]</span>}
          {c.hash}
        </span>
      ) : (
        <span className="text-text-muted">—</span>
      ),
  },
  {
    id: 'status',
    label: 'Status',
    accessor: (c) => c.status,
    render: (c) => (
      <Badge variant={c.status === 'valid' ? 'success' : c.status === 'invalid' ? 'error' : 'default'}>
        {c.status}
      </Badge>
    ),
    sortable: true,
    width: 'w-24',
  },
  {
    id: 'source',
    label: 'Source',
    accessor: (c) => c.source,
    render: (c) => <span className="text-text-muted text-xs font-mono">{c.source}</span>,
    width: 'w-28',
  },
]

// ── Web Path columns ──

const webPathColumns: Column<WebPath>[] = [
  {
    id: 'status_code',
    label: 'Status',
    accessor: (w) => w.status_code,
    render: (w) => {
      const color =
        w.status_code < 300 ? 'text-success' :
        w.status_code < 400 ? 'text-accent' :
        w.status_code < 500 ? 'text-severity-medium' :
        'text-error'
      return <span className={`font-mono font-semibold ${color}`}>{w.status_code}</span>
    },
    sortable: true,
    width: 'w-20',
  },
  {
    id: 'path',
    label: 'Path',
    accessor: (w) => w.path,
    render: (w) => <span className="font-mono">{w.path}</span>,
    sortable: true,
  },
  {
    id: 'title',
    label: 'Title',
    accessor: (w) => w.title,
    render: (w) => <span className="text-text-secondary">{w.title || '—'}</span>,
    sortable: true,
  },
  {
    id: 'size',
    label: 'Size',
    accessor: (w) => w.content_length,
    render: (w) => (
      <span className="text-text-muted text-xs font-mono">
        {w.content_length !== null ? `${w.content_length}B` : '—'}
      </span>
    ),
    sortable: true,
    width: 'w-20',
  },
]

// ── Finding columns ──

const findingColumns: Column<Finding>[] = [
  {
    id: 'severity',
    label: 'Severity',
    accessor: (f) => f.severity,
    render: (f) => <SeverityBadge severity={f.severity} />,
    sortable: true,
    width: 'w-24',
  },
  {
    id: 'type',
    label: 'Type',
    accessor: (f) => f.type,
    render: (f) => <Badge variant="default">{f.type}</Badge>,
    sortable: true,
    width: 'w-28',
  },
  {
    id: 'title',
    label: 'Title',
    accessor: (f) => f.title,
    render: (f) => <span className="font-sans font-semibold">{f.title}</span>,
    sortable: true,
  },
  {
    id: 'description',
    label: 'Description',
    accessor: (f) => f.description,
    render: (f) => (
      <span className="text-text-secondary text-xs line-clamp-1">{f.description || '—'}</span>
    ),
  },
]

// ── Generic sortable table ──

function SortableTable<T extends { id: number }>({
  columns,
  data,
  emptyMessage,
}: {
  columns: Column<T>[]
  data: T[]
  emptyMessage: string
}) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    if (!filter.trim()) return data
    const q = filter.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => {
        const val = col.accessor(row)
        return val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      })
    )
  }, [data, filter, columns])

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    const col = columns.find((c) => c.id === sortCol)
    if (!col) return filtered
    return [...filtered].sort((a, b) => {
      const aVal = col.accessor(a)
      const bVal = col.accessor(b)
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const cmp = String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir, columns])

  const handleSort = (colId: string) => {
    if (sortCol === colId) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(colId)
      setSortDir('asc')
    }
  }

  if (data.length === 0) {
    return <p className="text-sm text-text-muted py-4 text-center">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      {/* Filter input */}
      {data.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Filter results..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-bg-input border border-border rounded text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-elevated border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`px-3 py-2 text-left text-[10px] font-sans uppercase tracking-wider text-text-muted ${col.width ?? ''} ${col.sortable ? 'cursor-pointer select-none hover:text-text-primary' : ''}`}
                  onClick={col.sortable ? () => handleSort(col.id) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortCol === col.id && (
                      sortDir === 'asc'
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border/50 last:border-0 hover:bg-bg-elevated/50 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.id} className={`px-3 py-2 ${col.width ?? ''}`}>
                    {col.render ? col.render(row) : String(col.accessor(row) ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Count */}
      <p className="text-[10px] text-text-muted font-sans">
        {sorted.length === data.length
          ? `${data.length} result${data.length !== 1 ? 's' : ''}`
          : `${sorted.length} of ${data.length} results`}
      </p>
    </div>
  )
}

// ── Public entity-specific table components ──

export function ServicesTable({ data }: { data: Service[] }) {
  return <SortableTable columns={serviceColumns} data={data} emptyMessage="No services discovered" />
}

export function VulnerabilitiesTable({ data }: { data: Vulnerability[] }) {
  return <SortableTable columns={vulnColumns} data={data} emptyMessage="No vulnerabilities found" />
}

export function CredentialsTable({ data }: { data: Credential[] }) {
  return <SortableTable columns={credColumns} data={data} emptyMessage="No credentials found" />
}

export function WebPathsTable({ data }: { data: WebPath[] }) {
  return <SortableTable columns={webPathColumns} data={data} emptyMessage="No web paths discovered" />
}

export function FindingsTable({ data }: { data: Finding[] }) {
  return <SortableTable columns={findingColumns} data={data} emptyMessage="No findings" />
}
