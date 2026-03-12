import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs text-text-secondary font-sans uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2 text-sm font-mono
            bg-bg-input text-text-primary
            border rounded-md
            placeholder:text-text-muted
            focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
            ${error ? 'border-error' : 'border-border'}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-error font-sans">{error}</p>}
        {hint && !error && <p className="text-xs text-text-muted font-sans">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
export type { InputProps }
