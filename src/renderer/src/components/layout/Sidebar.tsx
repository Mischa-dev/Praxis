import {
  Home,
  Target,
  Play,
  FileText,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Radar,
  Globe,
  Chrome,
  Zap,
  Key,
  Database,
  Radio,
  ShieldOff,
  Terminal,
  GitBranch,
  Wrench,
  Star,
  Check,
  X,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useProfileStore, selectCategories } from '../../stores/profile-store'
import {
  useModuleStore,
  selectFilteredModules,
  selectFavoriteModules,
  selectRecentModules,
} from '../../stores/module-store'
import { useUiStore } from '../../stores/ui-store'
import { useEntityStore, selectPrimaryType } from '../../stores/entity-store'
import { getIcon } from '../../lib/icon-map'
import type { ViewId, Module, CategoryConfig, ProfileViewConfig } from '@shared/types'
import { SearchInput } from '../common'
import { useCallback, useMemo, useRef, useState, useEffect } from 'react'

/** Map profile icon strings to lucide components */
const iconMap: Record<string, LucideIcon> = {
  home: Home,
  target: Target,
  radar: Radar,
  globe: Globe,
  chrome: Chrome,
  zap: Zap,
  key: Key,
  database: Database,
  radio: Radio,
  'shield-off': ShieldOff,
  terminal: Terminal,
  'git-branch': GitBranch,
  tool: Wrench,
  play: Play,
  'file-text': FileText,
  clock: Clock,
  search: Search,
  settings: Settings,
}

interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  view: ViewId
  order: number
}

/** Engine nav items with built-in order values */
const ENGINE_NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, view: 'home', order: 10 },
  { id: 'targets', label: 'Targets', icon: Target, view: 'targets', order: 20 },
  { id: 'workflows', label: 'Workflows', icon: Play, view: 'workflow-view', order: 30 },
  { id: 'pipelines', label: 'Pipelines', icon: GitBranch, view: 'pipeline-builder', order: 40 },
  { id: 'history', label: 'History', icon: Clock, view: 'history', order: 80 },
]

interface PrimaryEntityInfo {
  label: string
  icon: string
}

/** Merge engine nav items with profile-declared views and schema primary entity */
function buildNavItems(profileViews?: ProfileViewConfig[], primaryEntity?: PrimaryEntityInfo | null): NavItem[] {
  const items = [...ENGINE_NAV_ITEMS]

  // Replace the hardcoded 'Targets' nav item with schema-driven primary entity
  if (primaryEntity) {
    const idx = items.findIndex((i) => i.id === 'targets')
    if (idx >= 0) {
      items[idx] = {
        id: 'entities',
        label: primaryEntity.label,
        icon: getIcon(primaryEntity.icon),
        view: 'entities',
        order: 20,
      }
    }
  }

  if (profileViews) {
    for (const pv of profileViews) {
      if (pv.nav_section === 'hidden') continue
      items.push({
        id: pv.id,
        label: pv.label,
        icon: iconMap[pv.icon] ?? Wrench,
        view: pv.id,
        order: pv.nav_order,
      })
    }
  }

  items.sort((a, b) => a.order - b.order)
  return items
}

function InstallBadge({ installed }: { installed: boolean }) {
  return installed ? (
    <Check className="w-3 h-3 text-success shrink-0" />
  ) : (
    <X className="w-3 h-3 text-error shrink-0" />
  )
}

function ModuleItem({
  mod,
  collapsed,
  isFavorite,
  onNavigate,
  onToggleFavorite,
}: {
  mod: Module
  collapsed: boolean
  isFavorite: boolean
  onNavigate: () => void
  onToggleFavorite: () => void
}) {
  return (
    <div className="flex items-center group">
      <button
        onClick={onNavigate}
        className="flex-1 flex items-center gap-2 px-2 py-1 rounded text-xs text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors truncate"
        title={collapsed ? mod.name : `${mod.name} — ${mod.description}`}
      >
        <InstallBadge installed={mod.installed} />
        {!collapsed && <span className="truncate">{mod.name}</span>}
      </button>
      {!collapsed && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
            isFavorite ? 'opacity-100 text-accent-secondary' : 'text-text-muted hover:text-accent-secondary'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      )}
    </div>
  )
}

function CategorySection({
  category,
  modules,
  expanded,
  collapsed,
  favoriteIds,
  onToggle,
  onNavigateModule,
  onToggleFavorite,
}: {
  category: CategoryConfig
  modules: Module[]
  expanded: boolean
  collapsed: boolean
  favoriteIds: string[]
  onToggle: () => void
  onNavigateModule: (moduleId: string) => void
  onToggleFavorite: (moduleId: string) => void
}) {
  const Icon = iconMap[category.icon] ?? Wrench
  const installedCount = modules.filter((m) => m.installed).length

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors w-full"
        title={collapsed ? category.label : category.description}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="truncate flex-1 text-left">{category.label}</span>
            <span className="text-[10px] text-text-muted tabular-nums">
              {installedCount}/{modules.length}
            </span>
            {expanded ? (
              <ChevronUp className="w-3 h-3 text-text-muted shrink-0" />
            ) : (
              <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
            )}
          </>
        )}
      </button>
      {expanded && !collapsed && modules.length > 0 && (
        <div className="ml-3 pl-2 border-l border-border flex flex-col gap-0.5 py-0.5">
          {modules.map((mod) => (
            <ModuleItem
              key={mod.id}
              mod={mod}
              collapsed={collapsed}
              isFavorite={favoriteIds.includes(mod.id)}
              onNavigate={() => onNavigateModule(mod.id)}
              onToggleFavorite={() => onToggleFavorite(mod.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const categories = useProfileStore(selectCategories)
  const profileViews = useProfileStore((s) => s.manifest?.views)
  const primaryType = useEntityStore(selectPrimaryType)
  const primaryEntityInfo = useMemo(
    () => primaryType ? { label: primaryType.label_plural, icon: primaryType.icon } : null,
    [primaryType?.label_plural, primaryType?.icon]
  )
  const navItems = useMemo(
    () => buildNavItems(profileViews, primaryEntityInfo),
    [profileViews, primaryEntityInfo]
  )
  const { activeView, sidebarCollapsed, sidebarWidth, navigate, toggleSidebar, setSidebarWidth } = useUiStore(
    useShallow((s) => ({
      activeView: s.activeView,
      sidebarCollapsed: s.sidebarCollapsed,
      sidebarWidth: s.sidebarWidth,
      navigate: s.navigate,
      toggleSidebar: s.toggleSidebar,
      setSidebarWidth: s.setSidebarWidth,
    }))
  )

  // Drag-to-resize state
  const [resizing, setResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = sidebarWidth
    },
    [sidebarWidth],
  )

  useEffect(() => {
    if (!resizing) return
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current
      setSidebarWidth(startWidthRef.current + delta)
    }
    const handleUp = () => setResizing(false)
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
  }, [resizing, setSidebarWidth])

  const search = useModuleStore((s) => s.search)
  const setSearch = useModuleStore((s) => s.setSearch)
  const favoriteIds = useModuleStore((s) => s.favoriteIds)
  const expandedCategories = useModuleStore((s) => s.expandedCategories)
  const toggleCategory = useModuleStore((s) => s.toggleCategory)
  const toggleFavorite = useModuleStore((s) => s.toggleFavorite)
  const addRecent = useModuleStore((s) => s.addRecent)
  const modulesLoading = useModuleStore((s) => s.loading)

  const modules = useModuleStore((s) => s.modules)
  const filteredModules = useModuleStore(useShallow(selectFilteredModules))
  const favoriteModules = useModuleStore(useShallow(selectFavoriteModules))
  const recentModules = useModuleStore(useShallow(selectRecentModules))

  // Compute derived map locally to avoid new Map reference on every store change
  const modulesByCategory = useMemo(() => {
    const map = new Map<string, Module[]>()
    for (const mod of modules) {
      const list = map.get(mod.category) ?? []
      list.push(mod)
      map.set(mod.category, list)
    }
    return map
  }, [modules])

  const isSearching = search.trim().length > 0

  // When searching, group filtered results by category
  const filteredByCategory = useMemo(() => {
    if (!isSearching) return null
    const map = new Map<string, Module[]>()
    for (const mod of filteredModules) {
      const list = map.get(mod.category) ?? []
      list.push(mod)
      map.set(mod.category, list)
    }
    return map
  }, [isSearching, filteredModules])

  const handleNavigateModule = useCallback(
    (moduleId: string) => {
      addRecent(moduleId)
      navigate('tool-form', { moduleId })
    },
    [addRecent, navigate],
  )

  return (
    <aside
      className={`flex flex-col bg-bg-surface border-r border-border shrink-0 transition-[width] duration-200 ease-out relative ${
        sidebarCollapsed ? 'w-12' : ''
      }`}
      style={sidebarCollapsed ? undefined : { width: sidebarWidth }}
    >
      {/* Resize handle (right edge) */}
      {!sidebarCollapsed && (
        <div
          className={`panel-resize-handle panel-resize-handle-right ${resizing ? 'active' : ''}`}
          onMouseDown={handleResizeStart}
        />
      )}
      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-8 hover:bg-bg-elevated transition-colors border-b border-border"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-4 h-4 text-text-secondary" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-text-secondary" />
        )}
      </button>

      {/* Search */}
      {!sidebarCollapsed && (
        <div className="px-2 py-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search tools..."
            className="text-xs"
          />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-1 py-1">
        {navItems.map((item) => {
          const isActive = activeView === item.view
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.view)}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-bg-elevated text-accent glow-sm'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Separator */}
      <div className="mx-2 border-b border-border my-1" />

      {/* Tool modules section */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        {modulesLoading && !sidebarCollapsed && (
          <div className="px-3 py-2 flex flex-col gap-2">
            <div className="skeleton w-24 h-3 rounded" />
            <div className="skeleton w-32 h-3 rounded" />
            <div className="skeleton w-20 h-3 rounded" />
          </div>
        )}

        {!modulesLoading && !isSearching && (
          <>
            {/* Favorites */}
            {favoriteModules.length > 0 && !sidebarCollapsed && (
              <>
                <div className="px-3 py-1">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Favorites
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 px-1 py-0.5">
                  {favoriteModules.map((mod) => (
                    <ModuleItem
                      key={mod.id}
                      mod={mod}
                      collapsed={sidebarCollapsed}
                      isFavorite={true}
                      onNavigate={() => handleNavigateModule(mod.id)}
                      onToggleFavorite={() => toggleFavorite(mod.id)}
                    />
                  ))}
                </div>
                <div className="mx-2 border-b border-border my-1" />
              </>
            )}

            {/* Recents */}
            {recentModules.length > 0 && !sidebarCollapsed && (
              <>
                <div className="px-3 py-1">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Recent
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 px-1 py-0.5">
                  {recentModules.map((mod) => (
                    <ModuleItem
                      key={mod.id}
                      mod={mod}
                      collapsed={sidebarCollapsed}
                      isFavorite={favoriteIds.includes(mod.id)}
                      onNavigate={() => handleNavigateModule(mod.id)}
                      onToggleFavorite={() => toggleFavorite(mod.id)}
                    />
                  ))}
                </div>
                <div className="mx-2 border-b border-border my-1" />
              </>
            )}

            {/* Tool categories */}
            {!sidebarCollapsed && (
              <div className="px-3 py-1">
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                  Tools
                </span>
              </div>
            )}
            <nav className="flex flex-col gap-0.5 px-1 py-0.5">
              {categories.map((cat) => {
                const mods = modulesByCategory.get(cat.id) ?? []
                return (
                  <CategorySection
                    key={cat.id}
                    category={cat}
                    modules={mods}
                    expanded={expandedCategories.has(cat.id)}
                    collapsed={sidebarCollapsed}
                    favoriteIds={favoriteIds}
                    onToggle={() => toggleCategory(cat.id)}
                    onNavigateModule={handleNavigateModule}
                    onToggleFavorite={toggleFavorite}
                  />
                )
              })}
            </nav>
          </>
        )}

        {/* Search results */}
        {!modulesLoading && isSearching && !sidebarCollapsed && (
          <>
            <div className="px-3 py-1">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                Results ({filteredModules.length})
              </span>
            </div>
            {filteredModules.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-text-muted">No tools found</p>
              </div>
            ) : (
              <nav className="flex flex-col gap-0.5 px-1 py-0.5">
                {categories
                  .filter((cat) => filteredByCategory?.has(cat.id))
                  .map((cat) => {
                    const mods = filteredByCategory?.get(cat.id) ?? []
                    return (
                      <CategorySection
                        key={cat.id}
                        category={cat}
                        modules={mods}
                        expanded={true}
                        collapsed={sidebarCollapsed}
                        favoriteIds={favoriteIds}
                        onToggle={() => toggleCategory(cat.id)}
                        onNavigateModule={handleNavigateModule}
                        onToggleFavorite={toggleFavorite}
                      />
                    )
                  })}
              </nav>
            )}
          </>
        )}
      </div>

      {/* Settings at bottom */}
      <div className="border-t border-border px-1 py-1">
        <button
          onClick={() => navigate('settings')}
          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm w-full transition-colors ${
            activeView === 'settings'
              ? 'bg-bg-elevated text-accent glow-sm'
              : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
          }`}
          title={sidebarCollapsed ? 'Settings' : undefined}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  )
}
