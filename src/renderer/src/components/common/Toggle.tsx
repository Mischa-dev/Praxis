import { type InputHTMLAttributes, forwardRef } from 'react'

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
  description?: string
  size?: 'sm' | 'md'
}

const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, description, size = 'md', checked, className = '', ...props }, ref) => {
    const trackSize = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5'
    const thumbSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
    const thumbTranslate = size === 'sm' ? 'translate-x-4' : 'translate-x-5'

    return (
      <label className={`inline-flex items-center gap-3 cursor-pointer select-none ${className}`}>
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            className="sr-only peer"
            {...props}
          />
          <div
            className={`
              ${trackSize} rounded-full transition-colors duration-150
              bg-border-bright
              peer-checked:bg-accent
              peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40
            `}
          />
          <div
            className={`
              ${thumbSize} absolute top-0.5 left-0.5
              bg-text-primary rounded-full
              transition-transform duration-150 ease-out
              peer-checked:${thumbTranslate}
            `}
          />
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && <span className="text-sm text-text-primary font-sans">{label}</span>}
            {description && <span className="text-xs text-text-muted">{description}</span>}
          </div>
        )}
      </label>
    )
  }
)

Toggle.displayName = 'Toggle'

export { Toggle }
export type { ToggleProps }
