import { useState } from 'react'
import { ProjectDashboard } from './ProjectDashboard'
import { ProjectList } from './ProjectList'
import { ProjectCreate } from './ProjectCreate'

type ProjectView = 'dashboard' | 'list' | 'create'

export function ProjectHome() {
  const [view, setView] = useState<ProjectView>('dashboard')

  switch (view) {
    case 'list':
      return <ProjectList onCreateNew={() => setView('create')} />
    case 'create':
      return (
        <ProjectCreate
          onDone={() => setView('dashboard')}
          onCancel={() => setView('list')}
        />
      )
    case 'dashboard':
    default:
      return <ProjectDashboard onShowProjects={() => setView('list')} />
  }
}
