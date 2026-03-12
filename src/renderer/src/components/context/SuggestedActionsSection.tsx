// Suggested actions section for the context panel — shows evaluated actions

import { useMemo } from 'react'
import { Play, Shield, ShieldAlert, ShieldOff, ExternalLink } from 'lucide-react'
import { useEntityStore, selectActiveEntity, selectPrimaryType } from '../../stores/entity-store'
import { useUiStore } from '../../stores/ui-store'
import { Badge } from '../common'
import type { EvaluatedAction, RiskLevel } from '@shared/types'

const riskIcons: Record<RiskLevel, typeof Shield> = {
  passive: Shield,
  active: ShieldAlert,
  intrusive: ShieldOff,
}

const riskColorClass: Record<RiskLevel, string> = {
  passive: 'text-success',
  active: 'text-accent',
  intrusive: 'text-error',
}

function CompactActionCard({ action }: { action: EvaluatedAction }): React.JSX.Element {
  const navigate = useUiStore((s) => s.navigate)
  const RiskIcon = riskIcons[action.riskLevel]

  const handleRun = (e: React.MouseEvent): void => {
    e.stopPropagation()
    navigate('tool-form', {
      moduleId: action.tool,
      autoArgs: action.autoArgs,
    })
  }

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-bg-elevated transition-colors group">
      <RiskIcon className={`w-3 h-3 mt-0.5 flex-shrink-0 ${riskColorClass[action.riskLevel]}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-sans text-text-primary truncate">
            {action.title}
          </span>
          {action.priority <= 20 && (
            <Badge variant="error" className="text-[8px] px-1 py-0">!</Badge>
          )}
        </div>
        <span className="text-[9px] text-text-muted font-mono">{action.tool}</span>
      </div>
      <button
        onClick={handleRun}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent/10"
        title="Run"
      >
        <Play className="w-3 h-3 text-accent" />
      </button>
    </div>
  )
}

export function SuggestedActionsSection(): React.JSX.Element | null {
  const primaryType = useEntityStore(selectPrimaryType)
  const activeEntity = useEntityStore(selectActiveEntity)
  const actions = useEntityStore((s) => s.actions)
  const navigate = useUiStore((s) => s.navigate)

  const topActions = useMemo(() => actions.slice(0, 5), [actions])

  if (!primaryType || !activeEntity) return null

  if (topActions.length === 0) {
    return (
      <p className="text-[10px] text-text-muted font-sans px-2 py-2">
        No actions available. Run scans to discover data.
      </p>
    )
  }

  return (
    <div className="space-y-0.5">
      {topActions.map((action) => (
        <CompactActionCard
          key={`${action.ruleId}-${action.actionId}`}
          action={action}
        />
      ))}
      {actions.length > 5 && (
        <button
          onClick={() =>
            navigate('entity-detail-view', {
              entityType: primaryType.id,
              entityId: activeEntity.id,
            })
          }
          className="flex items-center gap-1 w-full px-2 py-1.5 text-[10px] text-accent hover:text-accent/80 transition-colors font-sans"
        >
          View all {actions.length} actions
          <ExternalLink className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
