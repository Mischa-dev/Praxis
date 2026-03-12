import { create } from 'zustand'
import type { ProfileManifest, ProfileTheme, CategoryConfig } from '@shared/types'
import { viewRegistry } from '../lib/view-registry'

interface ProfileState {
  manifest: ProfileManifest | null
  activeTheme: ProfileTheme | null
  loading: boolean
  error: string | null
}

interface ProfileActions {
  loadProfile: () => Promise<void>
  setTheme: (themeId: string) => void
}

export const useProfileStore = create<ProfileState & ProfileActions>((set, get) => ({
  manifest: null,
  activeTheme: null,
  loading: true,
  error: null,

  loadProfile: async () => {
    try {
      set({ loading: true, error: null })
      const manifest = await window.api.invoke('profile:get')
      const defaultTheme =
        manifest.themes.find((t: ProfileTheme) => t.default) ?? manifest.themes[0] ?? null

      // Register manifest-declared views into the view registry
      if (manifest.views) {
        viewRegistry.registerManifestViews(manifest.views)
      }

      set({ manifest, activeTheme: defaultTheme, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load profile',
        loading: false,
      })
    }
  },

  setTheme: (themeId: string) => {
    const { manifest } = get()
    if (!manifest) return
    const theme = manifest.themes.find((t: ProfileTheme) => t.id === themeId)
    if (theme) {
      set({ activeTheme: theme })
    }
  },
}))

// Selectors
export const selectCategories = (state: ProfileState): CategoryConfig[] =>
  state.manifest?.categories ?? []

export const selectBranding = (state: ProfileState) => state.manifest?.branding ?? null

export const selectAppName = (state: ProfileState): string =>
  state.manifest?.name ?? 'Loading...'

export const selectTagline = (state: ProfileState): string => state.manifest?.tagline ?? ''
