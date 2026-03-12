// Settings view — Appearance, Execution, Paths, Scope, Notifications

import { useEffect } from 'react'
import {
  Settings,
  Palette,
  Cpu,
  FolderOpen,
  Shield,
  Bell,
  RotateCcw
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settings-store'
import { Button, Toggle, Card, Input, Select } from '../common'
import type { ThemeId, ScopeEnforcement, SudoMethod, AppSettings } from '@shared/types/settings'

// ---------- Theme Data ----------

const THEMES: { id: ThemeId; name: string; primary: string; secondary: string }[] = [
  { id: 'terminal-green', name: 'Terminal Green', primary: '#00ff41', secondary: '#ffb000' },
  { id: 'midnight-blue', name: 'Midnight Blue', primary: '#0088ff', secondary: '#00d4ff' },
  { id: 'blood-red', name: 'Blood Red', primary: '#ff3333', secondary: '#ff6b35' },
  { id: 'stealth', name: 'Stealth', primary: '#737373', secondary: '#a3a3a3' }
]

// ---------- Section Header ----------

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
      <Icon className="w-4 h-4 text-accent" />
      <h3 className="text-sm font-sans font-semibold text-text-primary uppercase tracking-wider">
        {title}
      </h3>
    </div>
  )
}

// ---------- Setting Row ----------

function SettingRow({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary font-sans">{label}</div>
        {description && (
          <div className="text-xs text-text-muted mt-0.5">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ---------- Theme Card ----------

function ThemeCard({
  theme,
  active,
  onClick
}: {
  theme: (typeof THEMES)[number]
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-150
        ${active
          ? 'border-accent bg-bg-elevated ring-1 ring-accent/30'
          : 'border-border bg-bg-surface hover:border-border-bright hover:bg-bg-elevated'
        }
      `}
    >
      {/* Color preview */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1.5">
          <div
            className="w-8 h-8 rounded-md border border-white/10"
            style={{ backgroundColor: theme.primary }}
          />
          <div
            className="w-8 h-3 rounded-sm border border-white/10"
            style={{ backgroundColor: theme.secondary }}
          />
        </div>
        <div className="w-24 flex flex-col gap-1">
          {/* Mini preview of a terminal-like UI */}
          <div className="h-1.5 rounded-full" style={{ backgroundColor: theme.primary, opacity: 0.8, width: '80%' }} />
          <div className="h-1 bg-white/10 rounded-full" style={{ width: '100%' }} />
          <div className="h-1 bg-white/10 rounded-full" style={{ width: '60%' }} />
          <div className="h-1.5 rounded-full" style={{ backgroundColor: theme.secondary, opacity: 0.6, width: '40%' }} />
        </div>
      </div>
      <span className="text-xs font-sans text-text-secondary">{theme.name}</span>
      {active && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />
      )}
    </button>
  )
}

// ---------- Main Settings View ----------

export function SettingsView() {
  const { settings, loading, error, loadSettings, updateSettings, resetToDefaults } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    updateSettings({ [key]: value })
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 bg-bg-surface rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-error font-sans text-sm">Failed to load settings</p>
          <p className="text-text-muted text-xs">{error}</p>
          <button onClick={loadSettings} className="text-accent text-xs hover:underline font-sans">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-display font-bold text-text-primary">Settings</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={resetToDefaults}>
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Defaults
        </Button>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* ── Appearance ── */}
        <Card>
          <SectionHeader icon={Palette} title="Appearance" />

          {/* Theme selector grid */}
          <div className="mb-4">
            <div className="text-xs text-text-muted font-sans uppercase tracking-wider mb-3">
              Theme
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {THEMES.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  active={settings.theme === theme.id}
                  onClick={() => update('theme', theme.id)}
                />
              ))}
            </div>
          </div>

          {/* Font size */}
          <SettingRow label="Font Size" description="Base font size for the interface">
            <div className="flex items-center gap-2">
              <button
                className="w-7 h-7 rounded border border-border bg-bg-input text-text-secondary hover:bg-bg-elevated text-sm font-sans"
                onClick={() => update('fontSize', Math.max(10, settings.fontSize - 1))}
              >
                -
              </button>
              <span className="w-8 text-center text-sm font-mono text-text-primary">
                {settings.fontSize}
              </span>
              <button
                className="w-7 h-7 rounded border border-border bg-bg-input text-text-secondary hover:bg-bg-elevated text-sm font-sans"
                onClick={() => update('fontSize', Math.min(24, settings.fontSize + 1))}
              >
                +
              </button>
            </div>
          </SettingRow>

          {/* Visual effects toggles */}
          <SettingRow
            label="Animations"
            description="Enable UI transitions and hover effects"
          >
            <Toggle
              size="sm"
              checked={settings.animations}
              onChange={(e) => update('animations', e.currentTarget.checked)}
            />
          </SettingRow>

          <SettingRow
            label="Scanline Effect"
            description="CRT scanline overlay on terminal areas"
          >
            <Toggle
              size="sm"
              checked={settings.scanlineEffect}
              onChange={(e) => update('scanlineEffect', e.currentTarget.checked)}
            />
          </SettingRow>

          <SettingRow
            label="Glow Effect"
            description="Accent-colored glow on key elements"
          >
            <Toggle
              size="sm"
              checked={settings.glowEffect}
              onChange={(e) => update('glowEffect', e.currentTarget.checked)}
            />
          </SettingRow>
        </Card>

        {/* ── Execution ── */}
        <Card>
          <SectionHeader icon={Cpu} title="Execution" />

          <SettingRow
            label="Max Parallel Scans"
            description="Maximum number of tools running simultaneously"
          >
            <div className="flex items-center gap-2">
              <button
                className="w-7 h-7 rounded border border-border bg-bg-input text-text-secondary hover:bg-bg-elevated text-sm font-sans"
                onClick={() => update('maxParallelScans', Math.max(1, settings.maxParallelScans - 1))}
              >
                -
              </button>
              <span className="w-8 text-center text-sm font-mono text-text-primary">
                {settings.maxParallelScans}
              </span>
              <button
                className="w-7 h-7 rounded border border-border bg-bg-input text-text-secondary hover:bg-bg-elevated text-sm font-sans"
                onClick={() => update('maxParallelScans', Math.min(10, settings.maxParallelScans + 1))}
              >
                +
              </button>
            </div>
          </SettingRow>

          <SettingRow
            label="Default Timeout"
            description="Maximum execution time per scan (seconds)"
          >
            <Select
              options={[
                { value: '120', label: '2 min' },
                { value: '300', label: '5 min' },
                { value: '600', label: '10 min' },
                { value: '1200', label: '20 min' },
                { value: '1800', label: '30 min' },
                { value: '3600', label: '1 hour' },
                { value: '0', label: 'No limit' }
              ]}
              value={String(settings.defaultTimeout)}
              onChange={(e) => update('defaultTimeout', Number(e.target.value))}
              className="w-32"
            />
          </SettingRow>

          <SettingRow
            label="Sudo Method"
            description="How to escalate privileges for tools requiring root"
          >
            <Select
              options={[
                { value: 'sudo', label: 'sudo' },
                { value: 'pkexec', label: 'pkexec' },
                { value: 'doas', label: 'doas' }
              ]}
              value={settings.sudoMethod}
              onChange={(e) => update('sudoMethod', e.target.value as SudoMethod)}
              className="w-32"
            />
          </SettingRow>

          <SettingRow
            label="Confirm Before Scan"
            description="Show confirmation dialog before executing tools"
          >
            <Toggle
              size="sm"
              checked={settings.confirmBeforeScan}
              onChange={(e) => update('confirmBeforeScan', e.currentTarget.checked)}
            />
          </SettingRow>

          <SettingRow
            label="Auto-Add Targets"
            description="Automatically add discovered targets to the board"
          >
            <Toggle
              size="sm"
              checked={settings.autoAddTargets}
              onChange={(e) => update('autoAddTargets', e.currentTarget.checked)}
            />
          </SettingRow>
        </Card>

        {/* ── Paths ── */}
        <Card>
          <SectionHeader icon={FolderOpen} title="Paths" />

          <div className="space-y-4">
            <Input
              label="Wordlists Directory"
              value={settings.wordlistsDir}
              onChange={(e) => update('wordlistsDir', e.target.value)}
              placeholder="/usr/share/wordlists"
              hint="Directory containing wordlist files for brute-force operations"
            />
            <Input
              label="Custom Modules Directory"
              value={settings.modulesDir}
              onChange={(e) => update('modulesDir', e.target.value)}
              placeholder="Leave empty to use bundled modules"
              hint="Additional YAML module definitions directory"
            />
          </div>
        </Card>

        {/* ── Scope ── */}
        <Card>
          <SectionHeader icon={Shield} title="Scope" />

          <SettingRow
            label="Scope Enforcement"
            description="How to handle targets outside the defined scope"
          >
            <Select
              options={[
                { value: 'warn', label: 'Warn' },
                { value: 'block', label: 'Block' },
                { value: 'off', label: 'Off' }
              ]}
              value={settings.scopeEnforcement}
              onChange={(e) => update('scopeEnforcement', e.target.value as ScopeEnforcement)}
              className="w-32"
            />
          </SettingRow>
        </Card>

        {/* ── Notifications ── */}
        <Card>
          <SectionHeader icon={Bell} title="Notifications" />

          <SettingRow
            label="Scan Complete"
            description="Notify when a scan finishes running"
          >
            <Toggle
              size="sm"
              checked={settings.notifyScanComplete}
              onChange={(e) => update('notifyScanComplete', e.currentTarget.checked)}
            />
          </SettingRow>

          <SettingRow
            label="Vulnerability Found"
            description="Notify when a new vulnerability is detected"
          >
            <Toggle
              size="sm"
              checked={settings.notifyVulnFound}
              onChange={(e) => update('notifyVulnFound', e.currentTarget.checked)}
            />
          </SettingRow>

          <SettingRow
            label="Desktop Notifications"
            description="Show system-level notifications (in addition to in-app)"
          >
            <Toggle
              size="sm"
              checked={settings.desktopNotifications}
              onChange={(e) => update('desktopNotifications', e.currentTarget.checked)}
            />
          </SettingRow>
        </Card>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  )
}
