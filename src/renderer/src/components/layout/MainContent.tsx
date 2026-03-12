import { Suspense } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useUiStore } from '../../stores/ui-store'
import { viewRegistry } from '../../lib/view-registry'
import { ProjectHome } from '../projects'

function ViewSkeleton() {
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

export function MainContent() {
  const { activeView, viewParams } = useUiStore(
    useShallow((s) => ({ activeView: s.activeView, viewParams: s.viewParams }))
  )

  const entry = viewRegistry.get(activeView)

  let content: React.ReactNode
  if (entry) {
    const ViewComponent = entry.component
    content = (
      <Suspense fallback={<ViewSkeleton />}>
        <ViewComponent params={viewParams} />
      </Suspense>
    )
  } else {
    content = <ProjectHome />
  }

  return (
    <div key={activeView} className="view-enter h-full">
      {content}
    </div>
  )
}
