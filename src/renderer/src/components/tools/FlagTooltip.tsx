/**
 * FlagTooltip — hover tooltip for command preview segments.
 *
 * Shows the argument name and help text when hovering over a flag
 * or value in the command preview.
 */

import { Tooltip } from '../common'

interface FlagTooltipProps {
  argName?: string
  help?: string
  children: React.ReactNode
}

export function FlagTooltip({ argName, help, children }: FlagTooltipProps): React.JSX.Element {
  if (!help && !argName) {
    return <>{children}</>
  }

  return (
    <Tooltip
      position="bottom"
      delay={200}
      content={
        <div className="max-w-xs whitespace-normal">
          {argName && (
            <div className="text-accent-primary font-semibold mb-0.5">{argName}</div>
          )}
          {help && <div className="text-text-secondary leading-tight">{help}</div>}
        </div>
      }
    >
      {children}
    </Tooltip>
  )
}
