// Profile manifest types — loaded from profile/manifest.yaml

export interface ProfileManifest {
  id: string
  name: string
  tagline: string
  description: string
  version: string
  branding: ProfileBranding
  themes: ProfileTheme[]
  target_types: TargetTypeConfig[]
  categories: CategoryConfig[]
  scope: ScopeConfig
  paths: ProfilePaths
  views?: ProfileViewConfig[]
  layout?: LayoutConfig
  effects?: EffectsConfig
}

export interface ProfileBranding {
  logo_ascii: string
  tagline_secondary: string
}

export interface ProfileTheme {
  id: string
  label: string
  accent_primary: string
  accent_secondary: string
  description: string
  default?: boolean
  accent_dim?: string
  accent_subtle?: string
  accent_text?: string
  button_primary_text?: string
}

export interface TargetTypeConfig {
  id: string
  label: string
  icon: string
  validation?: string
}

export interface CategoryConfig {
  id: string
  label: string
  icon: string
  description: string
}

export interface ScopeConfig {
  enabled: boolean
  cloud_providers_dir: string
  enforcement_default: 'warn' | 'block' | 'off'
}

export interface ProfilePaths {
  modules: string
  workflows: string
  glossary: string
  actions: string
  scope: string
  schema?: string
}

// ── Profile View Configuration ──

export interface ProfileViewConfig {
  id: string
  component: string
  label: string
  icon: string
  nav_section: 'primary' | 'secondary' | 'hidden'
  nav_order: number
}

// ── Layout Configuration ──

export interface LayoutConfig {
  sidebar?: SidebarLayoutConfig
  context_panel?: ContextPanelLayoutConfig
  terminal?: TerminalLayoutConfig
  title_bar?: TitleBarLayoutConfig
  status_bar?: StatusBarLayoutConfig
}

export interface SidebarLayoutConfig {
  position?: 'left' | 'right'
  default_width?: number
  min_width?: number
  max_width?: number
  collapsible?: boolean
  show_tool_categories?: boolean
  show_favorites?: boolean
  show_recents?: boolean
}

export interface ContextPanelLayoutConfig {
  position?: 'left' | 'right' | 'hidden'
  default_width?: number
  collapsible?: boolean
  default_open?: boolean
  sections?: ContextPanelSectionConfig[]
}

export interface ContextPanelSectionConfig {
  id: string
  enabled: boolean
}

export interface TerminalLayoutConfig {
  position?: 'bottom' | 'right' | 'hidden'
  default_height?: number
  collapsible?: boolean
}

export interface TitleBarLayoutConfig {
  show_ascii_logo?: boolean
  style?: 'custom' | 'native'
}

export interface StatusBarLayoutConfig {
  enabled?: boolean
}

// ── Effects Configuration ──

export interface EffectsConfig {
  scanlines?: boolean
  glow?: boolean
  glitch_logo?: boolean
  hover_lift?: boolean
}
