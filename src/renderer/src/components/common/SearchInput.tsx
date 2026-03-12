import { type InputHTMLAttributes, forwardRef } from 'react'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onClear, value, className = '', ...props }, ref) => {
    const hasValue = value !== undefined && value !== ''

    return (
      <div className={`relative ${className}`}>
        {/* Search icon */}
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={ref}
          type="text"
          value={value}
          className={`
            w-full pl-8 pr-8 py-1.5 text-xs font-mono
            bg-bg-input text-text-primary
            border border-border rounded-md
            placeholder:text-text-muted
            focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
          `}
          {...props}
        />
        {/* Clear button */}
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            aria-label="Clear search"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    )
  }
)

SearchInput.displayName = 'SearchInput'

export { SearchInput }
export type { SearchInputProps }
