import { TargetDetail as TargetDetailView } from '../targets'
export default function TargetDetail({ params }: { params: Record<string, unknown> }) {
  return <TargetDetailView targetId={(params.targetId as number) ?? 0} />
}
