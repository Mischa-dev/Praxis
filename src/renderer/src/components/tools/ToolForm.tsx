import { useCallback, useEffect, useMemo, useState } from 'react'
import { useModuleStore, selectModule } from '../../stores/module-store'
import { useEntityStore, selectPrimaryType, selectActiveEntity } from '../../stores/entity-store'
import { getDisplayValue } from '../../lib/schema-utils'
import { useUiStore } from '../../stores/ui-store'
import { useTerminalStore } from '../../stores/terminal-store'
import { Button, EmptyState } from '../common'
import { ToolHeader } from './ToolHeader'
import { ToolFormField, validateField } from './ToolFormField'
import { CommandPreview } from './CommandPreview'
import type { ModuleArgument } from '@shared/types/module'

interface ToolFormProps {
  moduleId: string
  autoArgs?: Record<string, unknown>
}

export function ToolForm({ moduleId, autoArgs }: ToolFormProps): React.JSX.Element {
  const mod = useModuleStore(selectModule(moduleId))
  const loading = useModuleStore((s) => s.loading)
  const activeEntity = useEntityStore(selectActiveEntity)
  const primaryType = useEntityStore(selectPrimaryType)
  const activeEntityValue = activeEntity && primaryType ? getDisplayValue(activeEntity, primaryType) : null
  const navigate = useUiStore((s) => s.navigate)

  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [executing, setExecuting] = useState(false)
  const [checkingInstall, setCheckingInstall] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Initialize form with defaults + active target + autoArgs from action rules
  useEffect(() => {
    if (!mod) return
    const defaults: Record<string, unknown> = {}
    for (const arg of mod.arguments) {
      if (arg.default !== undefined) {
        defaults[arg.id] = arg.default
      }
      // Pre-populate target fields from active target
      if (arg.type === 'target' && activeEntity) {
        defaults[arg.id] = activeEntityValue
      }
    }
    // Apply autoArgs from action rules (overrides defaults)
    if (autoArgs) {
      for (const [key, value] of Object.entries(autoArgs)) {
        defaults[key] = value
      }
    }
    setFormValues(defaults)
    setErrors({})
    setSubmitError(null)
  }, [mod, activeEntity, autoArgs])

  // ── Field change handler ──
  const handleFieldChange = useCallback(
    (argId: string, value: unknown) => {
      setFormValues((prev) => ({ ...prev, [argId]: value }))
      // Clear error for this field on change
      setErrors((prev) => {
        if (!prev[argId]) return prev
        const next = { ...prev }
        delete next[argId]
        return next
      })
      setSubmitError(null)
    },
    []
  )

  // ── Check install ──
  const handleCheckInstall = useCallback(async () => {
    setCheckingInstall(true)
    try {
      await window.api.invoke('module:check-install', { moduleId })
      // Reload module state to reflect updated install status
      await useModuleStore.getState().reloadModules()
    } finally {
      setCheckingInstall(false)
    }
  }, [moduleId])

  // ── Dependency visibility check ──
  const isVisible = useCallback(
    (arg: ModuleArgument): boolean => {
      if (!arg.depends_on) return true
      const depVal = formValues[arg.depends_on.field]
      if (arg.depends_on.value !== undefined && depVal !== arg.depends_on.value) return false
      if (arg.depends_on.values && !arg.depends_on.values.includes(depVal)) return false
      if (arg.depends_on.not_value !== undefined && depVal === arg.depends_on.not_value) return false
      return true
    },
    [formValues]
  )

  // ── Group visible arguments ──
  const groupedArgs = useMemo(() => {
    if (!mod) return new Map<string, ModuleArgument[]>()
    const groups = new Map<string, ModuleArgument[]>()
    for (const arg of mod.arguments) {
      if (arg.type === 'hidden') continue
      if (!isVisible(arg)) continue
      const group = arg.group ?? 'General'
      const list = groups.get(group) ?? []
      list.push(arg)
      groups.set(group, list)
    }
    return groups
  }, [mod, isVisible])

  // ── All form values (including hidden fields) for command preview ──
  const allFormValues = useMemo(() => {
    if (!mod) return formValues
    const vals = { ...formValues }
    for (const arg of mod.arguments) {
      if (arg.type === 'hidden' && arg.value !== undefined) {
        vals[arg.id] = arg.value
      }
    }
    return vals
  }, [mod, formValues])

  // ── Validate all fields ──
  const validateAll = useCallback((): boolean => {
    if (!mod) return false
    const newErrors: Record<string, string> = {}
    for (const arg of mod.arguments) {
      if (arg.type === 'hidden') continue
      if (!isVisible(arg)) continue
      const err = validateField(formValues[arg.id], arg)
      if (err) newErrors[arg.id] = err
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [mod, formValues, isVisible])

  // ── Execute tool ──
  const handleExecute = useCallback(async () => {
    if (!mod) return
    if (!validateAll()) return

    setExecuting(true)
    setSubmitError(null)

    try {
      // Collect hidden field values (they might have fixed values)
      const allValues = { ...formValues }
      for (const arg of mod.arguments) {
        if (arg.type === 'hidden' && arg.value !== undefined) {
          allValues[arg.id] = arg.value
        }
      }

      const result = (await window.api.invoke('tool:execute', {
        toolId: moduleId,
        args: allValues,
        targetId: activeEntity?.id
      })) as { scanId: number }

      // Create a terminal session for this scan
      useTerminalStore.getState().addSession({
        id: `scan-${result.scanId}`,
        scanId: result.scanId,
        label: mod.name,
        toolId: moduleId,
        status: 'running',
        createdAt: Date.now()
      })

      // Add to recent modules
      useModuleStore.getState().addRecent(moduleId)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Execution failed')
    } finally {
      setExecuting(false)
    }
  }, [mod, moduleId, formValues, activeEntity, validateAll])

  // ── Reset form ──
  const handleReset = useCallback(() => {
    if (!mod) return
    const defaults: Record<string, unknown> = {}
    for (const arg of mod.arguments) {
      if (arg.default !== undefined) {
        defaults[arg.id] = arg.default
      }
      if (arg.type === 'target' && activeEntity) {
        defaults[arg.id] = activeEntityValue
      }
    }
    if (autoArgs) {
      for (const [key, value] of Object.entries(autoArgs)) {
        defaults[key] = value
      }
    }
    setFormValues(defaults)
    setErrors({})
    setSubmitError(null)
  }, [mod, activeEntity, autoArgs])

  // ── Loading state ──
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-bg-elevated rounded-md shimmer" />
        ))}
      </div>
    )
  }

  // ── Module not found ──
  if (!mod) {
    return (
      <EmptyState
        title="Module Not Found"
        description={`No module found with ID "${moduleId}".`}
        action={
          <Button variant="secondary" onClick={() => navigate('targets')}>
            Back to Targets
          </Button>
        }
      />
    )
  }

  const isReference = mod.executionMode === 'reference'
  const canExecute = mod.installed && !isReference && !executing
  const groupEntries = Array.from(groupedArgs.entries())

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <ToolHeader
          module={mod}
          onCheckInstall={handleCheckInstall}
          checkingInstall={checkingInstall}
        />

        {/* Separator */}
        <div className="border-t border-border" />

        {/* Command preview — live-updates as form values change */}
        {mod.executionMode !== 'reference' && (
          <CommandPreview module={mod} formValues={allFormValues} />
        )}

        {/* Form fields grouped */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleExecute()
          }}
          className="space-y-6"
        >
          {groupEntries.map(([groupName, args], groupIdx) => (
            <FieldGroup
              key={groupName}
              name={groupName}
              args={args}
              formValues={formValues}
              errors={errors}
              onChange={handleFieldChange}
              collapsed={groupIdx > 0}
            />
          ))}

          {/* Root warning */}
          {mod.requiresRoot && (
            <div className="px-3 py-2 bg-severity-high/5 border border-severity-high/15 rounded-md">
              <p className="text-xs font-sans text-severity-high">
                This tool requires root privileges. The command will be run with sudo.
              </p>
            </div>
          )}
          {mod.rootOptional && !mod.requiresRoot && (
            <div className="px-3 py-2 bg-severity-medium/5 border border-severity-medium/15 rounded-md">
              <p className="text-xs font-sans text-severity-medium">
                Running as root enables additional scan types and features.
              </p>
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="px-3 py-2 bg-error/5 border border-error/15 rounded-md">
              <p className="text-xs font-sans text-error">{submitError}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={executing}
              disabled={!canExecute}
            >
              {executing
                ? 'Executing...'
                : isReference
                  ? 'Reference Only'
                  : !mod.installed
                    ? 'Tool Not Installed'
                    : 'Execute'}
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Field Group ──

interface FieldGroupProps {
  name: string
  args: ModuleArgument[]
  formValues: Record<string, unknown>
  errors: Record<string, string>
  onChange: (argId: string, value: unknown) => void
  collapsed?: boolean
}

function FieldGroup({
  name,
  args,
  formValues,
  errors,
  onChange,
  collapsed: initialCollapsed
}: FieldGroupProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? false)
  const isGeneral = name === 'General'

  return (
    <div className="space-y-4">
      {/* Group header (hide for "General" when it's the only group) */}
      {!isGeneral && (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 w-full group"
        >
          <svg
            className={`w-3 h-3 text-text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-sans uppercase tracking-wider text-text-secondary group-hover:text-text-primary transition-colors">
            {name}
          </span>
          <div className="flex-1 border-t border-border" />
        </button>
      )}

      {/* Fields */}
      {!collapsed && (
        <div className="space-y-4">
          {args.map((arg) => (
            <ToolFormField
              key={arg.id}
              arg={arg}
              value={formValues[arg.id]}
              onChange={onChange}
              error={errors[arg.id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
