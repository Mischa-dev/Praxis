// Icon string → Lucide component map
// Maps icon names from profile schema/manifest to Lucide React components.

import {
  Crosshair, Server, AlertTriangle, Key, Folder, Info, FileText,
  Monitor, Network, Globe, Link, Mail, Radio, Shield, ShieldOff,
  Terminal, GitBranch, Wrench, Zap, Database, Radar, Chrome,
  Search, Eye, Activity, Clock, Settings, Home, Play, Layers,
  Hash, Lock, Unlock, Bug, Code, Target, Cpu, HardDrive,
  type LucideIcon
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  crosshair: Crosshair,
  target: Target,
  server: Server,
  'alert-triangle': AlertTriangle,
  key: Key,
  folder: Folder,
  info: Info,
  'file-text': FileText,
  monitor: Monitor,
  network: Network,
  globe: Globe,
  link: Link,
  mail: Mail,
  radio: Radio,
  shield: Shield,
  'shield-off': ShieldOff,
  terminal: Terminal,
  'git-branch': GitBranch,
  tool: Wrench,
  zap: Zap,
  database: Database,
  radar: Radar,
  chrome: Chrome,
  search: Search,
  eye: Eye,
  activity: Activity,
  clock: Clock,
  settings: Settings,
  home: Home,
  play: Play,
  layers: Layers,
  hash: Hash,
  lock: Lock,
  unlock: Unlock,
  bug: Bug,
  code: Code,
  cpu: Cpu,
  'hard-drive': HardDrive,
}

/**
 * Get a Lucide icon component by string name.
 * Falls back to Info icon if the name is not recognized.
 */
export function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Info
}
