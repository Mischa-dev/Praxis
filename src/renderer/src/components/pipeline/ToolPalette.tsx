import { useState, useMemo } from 'react'
import {
  Plus,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  GitBranch,
  Repeat,
  Timer,
  StickyNote,
  Terminal,
  MessageCircle,
  Braces,
  type LucideIcon,
} from 'lucide-react'
import { SearchInput } from '../common'
import { useModuleStore } from '../../stores/module-store'
import type { Module } from '@shared/types'
import type { PipelineNodeType } from '@shared/types/pipeline'

interface LogicNodeDef {
  type: PipelineNodeType
  label: string
  icon: LucideIcon
  color: string
}

const LOGIC_NODES: LogicNodeDef[] = [
  { type: 'start', label: 'Start', icon: PlayCircle, color: 'text-accent-primary' },
  { type: 'shell', label: 'Shell Command', icon: Terminal, color: 'text-emerald-400' },
  { type: 'prompt', label: 'User Prompt', icon: MessageCircle, color: 'text-violet-400' },
  { type: 'set-variable', label: 'Set Variable', icon: Braces, color: 'text-cyan-400' },
  { type: 'condition', label: 'Condition', icon: GitBranch, color: 'text-amber-400' },
  { type: 'for-each', label: 'For Each', icon: Repeat, color: 'text-blue-400' },
  { type: 'delay', label: 'Delay', icon: Timer, color: 'text-text-muted' },
  { type: 'note', label: 'Note', icon: StickyNote, color: 'text-yellow-400' },
]

interface ToolPaletteProps {
  onAddToolNode: (mod: Module, x: number, y: number) => void
  onAddLogicNode: (type: PipelineNodeType, x: number, y: number) => void
  hasStartNode?: boolean
}

export function ToolPalette({ onAddToolNode, onAddLogicNode, hasStartNode }: ToolPaletteProps) {
  const modules = useModuleStore((s) => s.modules)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    if (!search.trim()) return modules
    const q = search.toLowerCase()
    return modules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.binary.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q),
    )
  }, [modules, search])

  const groupedFiltered = useMemo(() => {
    const map = new Map<string, Module[]>()
    for (const mod of filtered) {
      const list = map.get(mod.category) ?? []
      list.push(mod)
      map.set(mod.category, list)
    }
    return map
  }, [filtered])

  const toggle = (cat: string) => {
    const next = new Set(expanded)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setExpanded(next)
  }

  const getRandomPosition = () => ({
    x: 250 + Math.random() * 200,
    y: 100 + Math.random() * 200,
  })

  return (
    <div className="w-56 h-full bg-bg-surface border-r border-border flex flex-col">
      <div className="p-2 border-b border-border">
        <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          Tool Palette
        </div>
        <SearchInput
          placeholder="Filter tools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        {/* Flow Control section */}
        <div className="border-b border-border">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-accent-primary uppercase tracking-widest">
            Flow Control
          </div>
          {LOGIC_NODES.map((node) => {
            const Icon = node.icon
            const disabled = node.type === 'start' && hasStartNode
            return (
              <button
                key={node.type}
                className={`w-full flex items-center gap-2 px-5 py-1.5 text-xs transition-colors group ${
                  disabled
                    ? 'text-text-muted cursor-not-allowed opacity-50'
                    : 'text-text-primary hover:bg-bg-elevated'
                }`}
                onClick={() => {
                  if (disabled) return
                  const pos = getRandomPosition()
                  onAddLogicNode(node.type, pos.x, pos.y)
                }}
                disabled={disabled}
                title={disabled ? 'Only one Start node per pipeline' : node.label}
              >
                <Icon size={12} className={`${node.color} shrink-0`} />
                <span className="truncate">{node.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tool categories */}
        {Array.from(groupedFiltered.entries()).map(([category, mods]) => (
          <div key={category}>
            <button
              className="w-full flex items-center gap-1 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-elevated transition-colors"
              onClick={() => toggle(category)}
            >
              {expanded.has(category) ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              <span className="uppercase tracking-wider flex-1 text-left">{category}</span>
              <span className="text-text-muted">{mods.length}</span>
            </button>
            {expanded.has(category) &&
              mods.map((mod) => (
                <button
                  key={mod.id}
                  className="w-full flex items-center gap-2 px-5 py-1.5 text-xs text-text-primary hover:bg-bg-elevated transition-colors group"
                  onClick={() => {
                    const pos = getRandomPosition()
                    onAddToolNode(mod, pos.x, pos.y)
                  }}
                  title={mod.description}
                >
                  <Plus size={10} className="text-text-muted group-hover:text-accent-primary transition-colors shrink-0" />
                  <span className="truncate">{mod.name}</span>
                  {!mod.installed && (
                    <span className="text-[9px] text-red-400 ml-auto shrink-0">N/A</span>
                  )}
                </button>
              ))}
          </div>
        ))}
        {groupedFiltered.size === 0 && (
          <div className="px-3 py-4 text-xs text-text-muted text-center">No tools match</div>
        )}
      </div>
    </div>
  )
}
