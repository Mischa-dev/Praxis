interface DividerProps {
  className?: string
  label?: string
  orientation?: 'horizontal' | 'vertical'
}

export function Divider({ className = '', label, orientation = 'horizontal' }: DividerProps) {
  if (orientation === 'vertical') {
    return <div className={`w-px bg-border self-stretch ${className}`} />
  }

  if (label) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] font-sans uppercase tracking-wider text-text-muted">
          {label}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
    )
  }

  return <div className={`h-px bg-border ${className}`} />
}
