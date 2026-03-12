import { type ReactNode, useState, useRef, useEffect, useCallback } from 'react'

interface DropdownItem {
  id: string
  label: string
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  separator?: boolean
}

interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  onSelect: (id: string) => void
  align?: 'left' | 'right'
  className?: string
}

function Dropdown({ trigger, items, onSelect, align = 'left', className = '' }: DropdownProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(-1)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setFocusIndex(-1)
  }, [])

  useEffect(() => {
    if (!open) return

    const handleClick = (e: MouseEvent): void => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        close()
      }
    }

    const handleKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        close()
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, close])

  const selectableItems = items.filter((i) => !i.separator && !i.disabled)

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
        setFocusIndex(0)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((prev) => (prev + 1) % selectableItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((prev) => (prev - 1 + selectableItems.length) % selectableItems.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (focusIndex >= 0 && focusIndex < selectableItems.length) {
        onSelect(selectableItems[focusIndex].id)
        close()
      }
    }
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        className="focus:outline-none"
      >
        {trigger}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={handleKeyDown}
          className={`
            absolute z-40 mt-1 min-w-[180px] py-1
            bg-bg-elevated border border-border-bright rounded-lg shadow-xl
            fade-in
            ${align === 'right' ? 'right-0' : 'left-0'}
          `}
        >
          {items.map((item, index) => {
            if (item.separator) {
              return <div key={`sep-${index}`} className="my-1 border-t border-border" />
            }

            const selectableIndex = selectableItems.indexOf(item)
            const isFocused = selectableIndex === focusIndex

            return (
              <button
                key={item.id}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  onSelect(item.id)
                  close()
                }}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-sans text-left
                  transition-colors duration-100
                  disabled:opacity-40 disabled:pointer-events-none
                  ${item.danger ? 'text-error hover:bg-error/10' : 'text-text-primary hover:bg-bg-surface'}
                  ${isFocused ? (item.danger ? 'bg-error/10' : 'bg-bg-surface') : ''}
                `}
              >
                {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { Dropdown }
export type { DropdownProps, DropdownItem }
