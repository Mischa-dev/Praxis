// Zustand store for application settings

import { create } from 'zustand'
import type { AppSettings, ThemeId } from '@shared/types/settings'
import { DEFAULT_SETTINGS } from '@shared/types/settings'
import { useProfileStore } from './profile-store'

const api = window.api

interface SettingsState {
  settings: AppSettings
  loading: boolean
  error: string | null
}

interface SettingsActions {
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  setTheme: (theme: ThemeId) => Promise<void>
  resetToDefaults: () => Promise<void>
}

function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute('data-theme', theme === 'terminal-green' ? '' : theme)
  // terminal-green is the default (no data-theme attribute needed), others set the attribute
  if (theme === 'terminal-green') {
    document.documentElement.removeAttribute('data-theme')
  }

  // Apply expanded theme fields from profile manifest
  const manifest = useProfileStore.getState().manifest
  if (manifest) {
    const themeConfig = manifest.themes.find((t) => t.id === theme)
    if (themeConfig) {
      const el = document.documentElement
      // Apply optional expanded color tokens with auto-computation fallbacks
      if (themeConfig.accent_dim) {
        el.style.setProperty('--accent-dim', themeConfig.accent_dim)
      } else {
        el.style.removeProperty('--accent-dim')
      }
      if (themeConfig.accent_subtle) {
        el.style.setProperty('--accent-subtle', themeConfig.accent_subtle)
      } else {
        el.style.removeProperty('--accent-subtle')
      }
      if (themeConfig.accent_text) {
        el.style.setProperty('--accent-text', themeConfig.accent_text)
      } else {
        el.style.removeProperty('--accent-text')
      }
      if (themeConfig.button_primary_text) {
        el.style.setProperty('--button-primary-text', themeConfig.button_primary_text)
      } else {
        el.style.removeProperty('--button-primary-text')
      }
    }
  }
}

function applyEffects(settings: AppSettings): void {
  document.documentElement.style.setProperty('--font-size-base', `${settings.fontSize}px`)
  document.documentElement.classList.toggle('no-animations', !settings.animations)
  document.documentElement.classList.toggle('no-scanlines', !settings.scanlineEffect)
  document.documentElement.classList.toggle('no-glow', !settings.glowEffect)
}

export const useSettingsStore = create<SettingsState & SettingsActions>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loading: false,
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null })
    try {
      const settings = (await api.invoke('settings:get')) as AppSettings
      set({ settings, loading: false })
      applyTheme(settings.theme)
      applyEffects(settings)
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  updateSettings: async (updates) => {
    const current = get().settings
    // Optimistic update
    const optimistic = { ...current, ...updates }
    set({ settings: optimistic })

    // Apply visual changes immediately
    if (updates.theme) applyTheme(updates.theme)
    applyEffects(optimistic)

    try {
      const persisted = (await api.invoke('settings:set', { settings: updates })) as AppSettings
      set({ settings: persisted })
    } catch (err) {
      // Revert on error
      set({ settings: current, error: (err as Error).message })
      applyTheme(current.theme)
      applyEffects(current)
    }
  },

  setTheme: async (theme) => {
    await get().updateSettings({ theme })
  },

  resetToDefaults: async () => {
    await get().updateSettings(DEFAULT_SETTINGS)
  }
}))

// Selectors
export const selectSettings = (s: SettingsState & SettingsActions) => s.settings
export const selectTheme = (s: SettingsState & SettingsActions) => s.settings.theme
