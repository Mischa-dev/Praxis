// Application settings — persisted via electron-store

export type ThemeId = 'terminal-green' | 'midnight-blue' | 'blood-red' | 'stealth'
export type ScopeEnforcement = 'warn' | 'block' | 'off'
export type SudoMethod = 'sudo' | 'pkexec' | 'doas'

export interface AppSettings {
  // Appearance
  theme: ThemeId
  fontSize: number
  animations: boolean
  scanlineEffect: boolean
  glowEffect: boolean

  // Execution
  maxParallelScans: number
  defaultTimeout: number // seconds
  sudoMethod: SudoMethod
  confirmBeforeScan: boolean
  autoAddTargets: boolean

  // Paths
  wordlistsDir: string
  modulesDir: string

  // Scope
  scopeEnforcement: ScopeEnforcement

  // Notifications
  notifyScanComplete: boolean
  notifyVulnFound: boolean
  desktopNotifications: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'terminal-green',
  fontSize: 14,
  animations: true,
  scanlineEffect: true,
  glowEffect: true,

  maxParallelScans: 3,
  defaultTimeout: 600,
  sudoMethod: 'sudo',
  confirmBeforeScan: true,
  autoAddTargets: true,

  wordlistsDir: '/usr/share/wordlists',
  modulesDir: '',

  scopeEnforcement: 'warn',

  notifyScanComplete: true,
  notifyVulnFound: true,
  desktopNotifications: true
}
