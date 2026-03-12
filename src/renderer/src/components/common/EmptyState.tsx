import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-8 text-center ${className}`}>
      {icon && (
        <div className="mb-4 text-text-muted">{icon}</div>
      )}
      {!icon && (
        <div className="mb-4">
          <svg
            className="w-12 h-12 text-text-muted opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
      )}
      <h3 className="text-sm font-sans font-semibold text-text-secondary mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-text-muted max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
