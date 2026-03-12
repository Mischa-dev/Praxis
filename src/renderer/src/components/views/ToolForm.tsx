import { ToolForm as ToolFormView } from '../tools'
export default function ToolForm({ params }: { params: Record<string, unknown> }) {
  return (
    <ToolFormView
      moduleId={(params.moduleId as string) ?? ''}
      autoArgs={params.autoArgs as Record<string, unknown> | undefined}
    />
  )
}
