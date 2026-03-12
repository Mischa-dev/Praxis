import { type ReactNode, type KeyboardEvent, useRef } from 'react'

interface Tab {
  id: string
  label: string
  icon?: ReactNode
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
}

function Tabs({ tabs, activeTab, onTabChange, className = '' }: TabsProps): React.JSX.Element {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let nextIndex: number | null = null

    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      nextIndex = 0
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1
    }

    if (nextIndex !== null) {
      e.preventDefault()
      tabRefs.current[nextIndex]?.focus()
      onTabChange(tabs[nextIndex].id)
    }
  }

  return (
    <div className={`flex border-b border-border ${className}`} role="tablist">
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-xs font-sans uppercase tracking-wider
              border-b-2 -mb-px transition-colors duration-150
              ${
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-bright'
              }
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`
                  px-1.5 py-0.5 rounded text-[10px] leading-none font-semibold
                  ${isActive ? 'bg-accent/15 text-accent' : 'bg-bg-elevated text-text-muted'}
                `}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export { Tabs }
export type { TabsProps, Tab }
