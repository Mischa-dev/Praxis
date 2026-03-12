import { type ButtonHTMLAttributes, forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-bg-base hover:brightness-110 focus-visible:ring-accent/40 font-semibold glow-sm',
  secondary:
    'bg-bg-elevated text-text-primary border border-border-bright hover:bg-bg-surface hover:border-text-muted',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
  danger:
    'bg-error/10 text-error border border-error/20 hover:bg-error/20 hover:border-error/40'
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs gap-1.5',
  md: 'px-3.5 py-1.5 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2.5'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center rounded-md font-sans
          transition-all duration-150 ease-out
          press-feedback
          disabled:opacity-40 disabled:pointer-events-none
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
export type { ButtonProps, ButtonVariant, ButtonSize }
