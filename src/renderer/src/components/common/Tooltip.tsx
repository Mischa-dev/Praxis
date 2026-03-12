import { type ReactNode, useState, useRef } from 'react'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: ReactNode
  position?: TooltipPosition
  delay?: number
  children: ReactNode
  className?: string
}

const positionClasses: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2'
}

function Tooltip({
  content,
  position = 'top',
  delay = 400,
  children,
  className = ''
}: TooltipProps): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = (): void => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay)
  }

  const hide = (): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setVisible(false)
  }

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`
            absolute z-50 px-2.5 py-1.5 max-w-xs
            bg-bg-elevated border border-border-bright rounded-md shadow-lg
            text-xs font-sans text-text-primary whitespace-nowrap
            pointer-events-none fade-in
            ${positionClasses[position]}
          `}
        >
          {content}
        </div>
      )}
    </div>
  )
}

export { Tooltip }
export type { TooltipProps, TooltipPosition }
