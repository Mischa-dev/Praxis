import { PipelineBuilder as PipelineBuilderView } from '../pipeline'
export default function PipelineBuilder({ params }: { params: Record<string, unknown> }) {
  return <PipelineBuilderView pipelineId={params.pipelineId as number | undefined} />
}
