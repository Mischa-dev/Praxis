import { type HTMLAttributes, forwardRef } from 'react'

type CardDepth = 'flat' | 'raised' | 'floating'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  active?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  depth?: CardDepth
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6'
}

const depthClasses: Record<CardDepth, string> = {
  flat: '',
  raised: 'shadow-raised',
  floating: 'shadow-floating'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable, active, padding = 'md', depth = 'flat', className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          bg-bg-surface border rounded-lg
          ${active ? 'border-accent accent-border-glow' : 'border-border'}
          ${hoverable ? 'hover-lift cursor-pointer hover:border-border-bright' : ''}
          ${paddingClasses[padding]}
          ${depthClasses[depth]}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export { Card }
export type { CardProps, CardDepth }
