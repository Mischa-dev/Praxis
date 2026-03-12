// View registry — auto-discovers views from engine and profile directories via import.meta.glob
// Profile views can override engine views of the same ID.

import { lazy, type ComponentType } from 'react'
import type { ProfileViewConfig } from '@shared/types'

export interface ViewEntry {
  id: string
  component: ComponentType<{ params: Record<string, unknown> }>
}

type LazyModule = { default: ComponentType<unknown> } | Record<string, ComponentType<unknown>>

// ── Discover engine views ──
// Each file in components/views/ should default-export a React component.
// The view ID is derived from the filename: PascalCase → kebab-case.
const engineModules = import.meta.glob<LazyModule>(
  '../components/views/*.tsx',
  { eager: false }
)

// ── Discover profile views ──
// Relative path from src/renderer/src/lib/ → profile/src/views/
const profileModules = import.meta.glob<LazyModule>(
  '../../../../profile/src/views/*.tsx',
  { eager: false }
)

function fileNameToId(path: string): string {
  // Extract filename without extension
  const match = path.match(/\/([^/]+)\.tsx$/)
  if (!match) return path
  const name = match[1]
  // PascalCase → kebab-case
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function resolveComponent(loader: () => Promise<LazyModule>): ComponentType<{ params: Record<string, unknown> }> {
  return lazy(async () => {
    const mod = await loader()
    // Support both default export and first named export
    const Component = ('default' in mod ? mod.default : Object.values(mod)[0]) as ComponentType<unknown>
    return { default: Component as ComponentType<{ params: Record<string, unknown> }> }
  })
}

class ViewRegistry {
  private views = new Map<string, ViewEntry>()

  constructor() {
    // Register engine views
    for (const [path, loader] of Object.entries(engineModules)) {
      const id = fileNameToId(path)
      this.views.set(id, {
        id,
        component: resolveComponent(loader),
      })
    }

    // Register profile views (override engine views of same ID)
    for (const [path, loader] of Object.entries(profileModules)) {
      const id = fileNameToId(path)
      this.views.set(id, {
        id,
        component: resolveComponent(loader),
      })
    }
  }

  /** Register views declared in the manifest's views section */
  registerManifestViews(viewConfigs: ProfileViewConfig[]): void {
    for (const config of viewConfigs) {
      // Only register if we actually discovered the component file
      // The component filename maps to the view id
      if (this.views.has(config.id)) {
        // Already discovered — just ensure it's registered
        continue
      }
      // If not auto-discovered, it might have a different filename than the id
      // Check if any profile module matches the component name
      const matchingPath = Object.keys(profileModules).find(
        (p) => fileNameToId(p) === config.component.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()
      )
      if (matchingPath) {
        this.views.set(config.id, {
          id: config.id,
          component: resolveComponent(profileModules[matchingPath]),
        })
      }
    }
  }

  get(viewId: string): ViewEntry | undefined {
    return this.views.get(viewId)
  }

  has(viewId: string): boolean {
    return this.views.has(viewId)
  }

  getAll(): ViewEntry[] {
    return Array.from(this.views.values())
  }
}

export const viewRegistry = new ViewRegistry()
