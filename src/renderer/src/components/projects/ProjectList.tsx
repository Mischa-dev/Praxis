import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  FolderOpen,
  Trash2,
  Download,
  Clock,
  MoreVertical,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { Button, Card, Badge, EmptyState, SearchInput, Dialog, DialogFooter } from '../common'
import type { Workspace } from '@shared/types/workspace'

const TYPE_LABELS: Record<string, string> = {
  external: 'External',
  internal: 'Internal',
  web: 'Web App',
  wireless: 'Wireless',
  custom: 'Custom',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ProjectCard({
  workspace,
  isActive,
  onSwitch,
  onDelete,
  onExport,
}: {
  workspace: Workspace
  isActive: boolean
  onSwitch: () => void
  onDelete: () => void
  onExport: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <Card
      hoverable
      active={isActive}
      padding="none"
      className="relative group"
      onClick={onSwitch}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-sans font-semibold text-text-primary truncate">
                {workspace.name}
              </h3>
              {isActive && <Badge variant="accent">ACTIVE</Badge>}
            </div>
            {workspace.description && (
              <p className="text-xs text-text-muted font-sans line-clamp-2 mb-2">
                {workspace.description}
              </p>
            )}
          </div>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(!menuOpen)
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-elevated transition-all text-text-muted hover:text-text-primary"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-bg-surface border border-border-bright rounded-md shadow-lg py-1 min-w-[140px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      onExport()
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-sans text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                  {!isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(false)
                        onDelete()
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-sans text-error hover:bg-error/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono">
          <Badge>{TYPE_LABELS[workspace.type] ?? workspace.type}</Badge>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(workspace.updated_at)}
          </span>
        </div>
      </div>
    </Card>
  )
}

interface ProjectListProps {
  onCreateNew: () => void
}

export function ProjectList({ onCreateNew }: ProjectListProps) {
  const {
    workspaces,
    activeWorkspace,
    loading,
    loadWorkspaces,
    switchWorkspace,
    deleteWorkspace,
    exportWorkspace,
  } = useWorkspaceStore()

  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  const filtered = search.trim()
    ? workspaces.filter(
        (w) =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          (w.description && w.description.toLowerCase().includes(search.toLowerCase()))
      )
    : workspaces

  const handleSwitch = useCallback(
    async (ws: Workspace) => {
      if (ws.id === activeWorkspace?.id) return
      await switchWorkspace(ws.id)
    },
    [activeWorkspace, switchWorkspace]
  )

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    await deleteWorkspace(deleteTarget.id)
    setDeleteTarget(null)
  }, [deleteTarget, deleteWorkspace])

  const handleExport = useCallback(
    async (ws: Workspace) => {
      await exportWorkspace(ws.id)
    },
    [exportWorkspace]
  )

  if (loading && workspaces.length === 0) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="skeleton w-40 h-6 rounded" />
          <div className="skeleton w-28 h-8 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-sans font-semibold text-text-primary">Projects</h2>
        <div className="flex items-center gap-3">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search projects..."
            className="text-xs w-48"
          />
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="w-3.5 h-3.5" />
            New Project
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-10 h-10" />}
          title={search ? 'No matching projects' : 'No projects yet'}
          description={
            search
              ? 'Try a different search term.'
              : 'Create your first project to get started.'
          }
          action={
            !search ? (
              <Button size="sm" onClick={onCreateNew}>
                <Plus className="w-3.5 h-3.5" />
                Create Project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ws) => (
            <ProjectCard
              key={ws.id}
              workspace={ws}
              isActive={ws.id === activeWorkspace?.id}
              onSwitch={() => handleSwitch(ws)}
              onDelete={() => setDeleteTarget(ws)}
              onExport={() => handleExport(ws)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Project"
        description="This will permanently delete the project and all its data."
      >
        {deleteTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-text-secondary font-sans">
              Are you sure you want to delete{' '}
              <span className="text-text-primary font-semibold">{deleteTarget.name}</span>?
              This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>
    </div>
  )
}
