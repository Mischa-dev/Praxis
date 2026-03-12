import { type ReactNode, useEffect, useRef, useCallback } from 'react'

type DialogSize = 'sm' | 'md' | 'lg'

const dialogSizeClasses: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: DialogSize
  className?: string
}

function Dialog({ open, onClose, title, description, children, size = 'md', className = '' }: DialogProps): React.JSX.Element | null {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    contentRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className={`
          bg-bg-surface border border-border-bright rounded-lg shadow-overlay
          w-full ${dialogSizeClasses[size]} mx-4
          view-enter
          focus:outline-none
          ${className}
        `}
      >
        {title && (
          <div className="px-5 pt-5 pb-0">
            <h2 className="text-sm font-sans font-semibold text-text-primary">{title}</h2>
            {description && (
              <p className="mt-1 text-xs text-text-secondary">{description}</p>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// --- Dialog footer helper ---
interface DialogFooterProps {
  children: ReactNode
}

function DialogFooter({ children }: DialogFooterProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
      {children}
    </div>
  )
}

export { Dialog, DialogFooter }
export type { DialogProps, DialogSize, DialogFooterProps }
