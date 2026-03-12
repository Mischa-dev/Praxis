// Settings persistence — stores app settings as a JSON file in userData directory

import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import type { AppSettings } from '@shared/types/settings'
import { DEFAULT_SETTINGS } from '@shared/types/settings'

let settingsCache: AppSettings | null = null
let settingsPath = ''

function getSettingsPath(): string {
  if (!settingsPath) {
    const userDataDir = app.getPath('userData')
    settingsPath = join(userDataDir, 'settings.json')
  }
  return settingsPath
}

/** Load settings from disk, merging with defaults for any missing keys. */
export function getSettings(): AppSettings {
  if (settingsCache) return settingsCache

  const filePath = getSettingsPath()
  try {
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      // Merge with defaults so new settings keys get default values
      settingsCache = { ...DEFAULT_SETTINGS, ...parsed }
    } else {
      settingsCache = { ...DEFAULT_SETTINGS }
    }
  } catch {
    console.warn('Failed to read settings, using defaults')
    settingsCache = { ...DEFAULT_SETTINGS }
  }

  return settingsCache!
}

/** Update settings (partial merge) and persist to disk. Returns the full updated settings. */
export function setSettings(updates: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...updates }
  settingsCache = updated

  const filePath = getSettingsPath()
  try {
    const dir = join(filePath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to write settings:', err)
  }

  return updated
}

/** Reset settings to defaults and persist. */
export function resetSettings(): AppSettings {
  return setSettings(DEFAULT_SETTINGS)
}
