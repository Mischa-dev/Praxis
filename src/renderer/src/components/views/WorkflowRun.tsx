import { WorkflowProgress } from '../workflows'
export default function WorkflowRun({ params }: { params: Record<string, unknown> }) {
  return <WorkflowProgress runId={(params.runId as string) ?? ''} />
}
