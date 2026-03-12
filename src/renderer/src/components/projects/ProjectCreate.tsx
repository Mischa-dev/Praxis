import { useState, useCallback } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button, Input, Select } from '../common'
import { ScopeEditor } from './ScopeEditor'
import { useWorkspaceStore } from '../../stores/workspace-store'
import type { WorkspaceType } from '@shared/types/workspace'

const PROJECT_TYPES: { value: WorkspaceType; label: string }[] = [
  { value: 'external', label: 'External Penetration Test' },
  { value: 'internal', label: 'Internal Penetration Test' },
  { value: 'web', label: 'Web Application Assessment' },
  { value: 'wireless', label: 'Wireless Assessment' },
  { value: 'custom', label: 'Custom / Other' },
]

interface ProjectCreateProps {
  onDone: () => void
  onCancel: () => void
}

export function ProjectCreate({ onDone, onCancel }: ProjectCreateProps) {
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace)

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<WorkspaceType>('external')
  const [scope, setScope] = useState<{ inScope: string[]; outOfScope: string[] }>({
    inScope: [],
    outOfScope: [],
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canNext = step === 0 ? name.trim().length > 0 : true

  const handleCreate = useCallback(async () => {
    setCreating(true)
    setError(null)
    try {
      await createWorkspace(
        name.trim(),
        description.trim() || undefined,
        type,
        scope.inScope.length > 0 || scope.outOfScope.length > 0 ? scope : undefined
      )
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }, [name, description, type, scope, createWorkspace, onDone])

  const steps = [
    {
      title: 'Project Details',
      content: (
        <div className="flex flex-col gap-4">
          <Input
            label="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Client External Assessment"
            autoFocus
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary font-sans uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the engagement..."
              rows={3}
              className="w-full px-3 py-2 text-sm font-sans bg-bg-input text-text-primary border border-border rounded-md placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 resize-none"
            />
          </div>
          <Select
            label="Project Type"
            value={type}
            onChange={(e) => setType(e.target.value as WorkspaceType)}
            options={PROJECT_TYPES}
          />
        </div>
      ),
    },
    {
      title: 'Scope Definition',
      content: (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-muted font-sans leading-relaxed">
            Define which targets are in scope and any exclusions. This helps prevent
            accidental testing of out-of-scope assets.
          </p>
          <ScopeEditor inScope={scope.inScope} outOfScope={scope.outOfScope} onChange={setScope} />
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onCancel}
          className="p-1.5 rounded hover:bg-bg-elevated transition-colors text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-sm font-sans font-semibold text-text-primary">
            New Project
          </h2>
          <p className="text-xs text-text-muted font-sans">
            Step {step + 1} of {steps.length}: {steps[step].title}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2 mb-6">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-accent' : 'bg-bg-elevated'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">{steps[step].content}</div>

      {/* Error */}
      {error && (
        <p className="text-xs text-error font-sans mt-3">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (step > 0 ? setStep(step - 1) : onCancel())}
        >
          {step > 0 ? 'Back' : 'Cancel'}
        </Button>
        <div className="flex gap-2">
          {step < steps.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canNext}>
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleCreate} loading={creating} disabled={!canNext}>
              <Check className="w-3.5 h-3.5" />
              Create Project
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
