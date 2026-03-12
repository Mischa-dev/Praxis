import { useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Button, Dialog } from '../common'
import { usePipelineStore } from '../../stores/pipeline-store'
import type { Pipeline } from '@shared/types/pipeline'

export function LoadDialog({
  onClose,
  onLoad,
  onDelete,
}: {
  onClose: () => void
  onLoad: (pipeline: Pipeline) => void
  onDelete: (id: number) => void
}) {
  const { pipelines, loading, loadPipelines } = usePipelineStore()

  useEffect(() => {
    loadPipelines()
  }, [loadPipelines])

  return (
    <Dialog open onClose={onClose} title="Load Pipeline">
      <div className="max-h-[50vh] overflow-y-auto space-y-2">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        )}
        {!loading && pipelines.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-4">No saved pipelines yet.</p>
        )}
        {!loading &&
          pipelines.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:border-border-bright cursor-pointer transition-colors group"
              onClick={() => {
                onLoad(p)
                onClose()
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary font-medium truncate">{p.name}</div>
                {p.description && (
                  <div className="text-xs text-text-secondary truncate">{p.description}</div>
                )}
                <div className="text-[10px] text-text-muted">
                  {new Date(p.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-400 transition-all"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(p.id)
                }}
                title="Delete pipeline"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
      </div>
      <div className="flex justify-end mt-4 pt-3 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  )
}
