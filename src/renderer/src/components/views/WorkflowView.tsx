import { useEffect, useState } from 'react'
import { WorkflowSelector, WorkflowProgress } from '../workflows'
import { useUiStore } from '../../stores/ui-store'
import { useWorkflowStore } from '../../stores/workflow-store'
import { usePipelineStore } from '../../stores/pipeline-store'
import { compileWorkflow } from '@shared/utils/workflow-compiler'

function WorkflowPipelineRedirect({ workflowId }: { workflowId: string }) {
  const navigate = useUiStore((s) => s.navigate)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    useWorkflowStore
      .getState()
      .getWorkflow(workflowId)
      .then((workflow) => {
        const def = compileWorkflow(workflow)
        const compiledPipeline = {
          id: -1,
          name: workflow.name,
          description: workflow.description,
          definition: JSON.stringify(def),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        usePipelineStore.getState().setActivePipeline(compiledPipeline)
        navigate('pipeline-builder', {})
      })
      .catch((err) => setError((err as Error).message))
  }, [workflowId, navigate])

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-400">Failed to load workflow: {error}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="skeleton h-8 w-48 rounded" />
      <div className="skeleton h-4 w-96 rounded" />
      <div className="space-y-2 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export default function WorkflowView({ params }: { params: Record<string, unknown> }) {
  const workflowId = params.workflowId as string | undefined
  return workflowId ? <WorkflowPipelineRedirect workflowId={workflowId} /> : <WorkflowSelector />
}
