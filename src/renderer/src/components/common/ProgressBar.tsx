interface ProgressBarProps {
  value: number // 0-100
  max?: number
  variant?: 'accent' | 'success' | 'error' | 'severity-critical' | 'severity-high' | 'severity-medium' | 'severity-low'
  size?: 'sm' | 'md'
  label?: string
  showValue?: boolean
  indeterminate?: boolean
  className?: string
}

const variantClasses: Record<NonNullable<ProgressBarProps['variant']>, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  error: 'bg-error',
  'severity-critical': 'bg-severity-critical',
  'severity-high': 'bg-severity-high',
  'severity-medium': 'bg-severity-medium',
  'severity-low': 'bg-severity-low'
}

function ProgressBar({
  value,
  max = 100,
  variant = 'accent',
  size = 'md',
  label,
  showValue,
  indeterminate,
  className = ''
}: ProgressBarProps): React.JSX.Element {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))
  const heightClass = size === 'sm' ? 'h-1' : 'h-2'

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-xs font-sans text-text-secondary">{label}</span>}
          {showValue && (
            <span className="text-xs font-mono text-text-muted tabular-nums">
              {Math.round(percent)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`${heightClass} w-full bg-bg-elevated rounded-full overflow-hidden`}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {indeterminate ? (
          <div className={`h-full w-1/3 ${variantClasses[variant]} rounded-full animate-[progress-indeterminate_1.5s_ease-in-out_infinite]`} />
        ) : (
          <div
            className={`h-full ${variantClasses[variant]} rounded-full transition-[width] duration-300 ease-out`}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    </div>
  )
}

export { ProgressBar }
export type { ProgressBarProps }
