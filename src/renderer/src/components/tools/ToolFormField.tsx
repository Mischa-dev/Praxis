import { type ChangeEvent, useCallback } from 'react'
import type { ModuleArgument } from '@shared/types/module'
import { Input, Select, Toggle, Tooltip } from '../common'

// ── Validation ──

export function validateField(
  value: unknown,
  arg: ModuleArgument
): string | undefined {
  if (arg.required && (value === undefined || value === null || value === '')) {
    return `${arg.name} is required`
  }
  if (value === undefined || value === null || value === '') return undefined

  const v = arg.validation
  if (!v) return undefined

  const str = String(value)

  if (v.pattern) {
    try {
      if (!new RegExp(v.pattern).test(str)) {
        return v.message ?? `Invalid format for ${arg.name}`
      }
    } catch {
      // Invalid regex in module YAML — skip
    }
  }

  if (arg.type === 'number' || arg.type === 'port' || arg.type === 'range') {
    const num = Number(value)
    if (!isNaN(num)) {
      if (v.min !== undefined && num < v.min) return `Minimum value is ${v.min}`
      if (v.max !== undefined && num > v.max) return `Maximum value is ${v.max}`
    }
  }

  if (v.min_length !== undefined && str.length < v.min_length) {
    return `Minimum length is ${v.min_length} characters`
  }
  if (v.max_length !== undefined && str.length > v.max_length) {
    return `Maximum length is ${v.max_length} characters`
  }

  return undefined
}

// ── Field Props ──

interface ToolFormFieldProps {
  arg: ModuleArgument
  value: unknown
  onChange: (argId: string, value: unknown) => void
  error?: string
  activeTargetValue?: string
}

export function ToolFormField({
  arg,
  value,
  onChange,
  error,
  activeTargetValue
}: ToolFormFieldProps): React.JSX.Element | null {
  // Hidden fields are not rendered
  if (arg.type === 'hidden') return null

  const handleChange = useCallback(
    (newVal: unknown) => onChange(arg.id, newVal),
    [arg.id, onChange]
  )

  return (
    <div className="flex flex-col gap-1.5">
      {renderField(arg, value, handleChange, error, activeTargetValue)}
      {arg.help && !error && (
        <p className="text-xs text-text-muted font-sans leading-relaxed">{arg.help}</p>
      )}
    </div>
  )
}

// ── Field Renderers ──

function renderField(
  arg: ModuleArgument,
  value: unknown,
  onChange: (val: unknown) => void,
  error?: string,
  activeTargetValue?: string
): React.JSX.Element {
  switch (arg.type) {
    case 'toggle':
      return (
        <Toggle
          label={arg.name}
          description={error}
          checked={value === true}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        />
      )

    case 'select':
      return (
        <SelectField arg={arg} value={value} onChange={onChange} error={error} />
      )

    case 'multiselect':
      return (
        <MultiselectField arg={arg} value={value} onChange={onChange} error={error} />
      )

    case 'target':
      return (
        <Input
          label={requiredLabel(arg)}
          value={String(value ?? activeTargetValue ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={arg.placeholder ?? 'IP, hostname, or domain'}
          error={error}
        />
      )

    case 'password':
      return (
        <Input
          label={requiredLabel(arg)}
          type="password"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={arg.placeholder}
          error={error}
        />
      )

    case 'number':
      return (
        <Input
          label={requiredLabel(arg)}
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => {
            const v = e.target.value
            onChange(v === '' ? undefined : Number(v))
          }}
          placeholder={arg.placeholder}
          error={error}
          min={arg.validation?.min}
          max={arg.validation?.max}
        />
      )

    case 'port':
      return (
        <Input
          label={requiredLabel(arg)}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={arg.placeholder ?? '80, 443, 1-1024, or -'}
          error={error}
        />
      )

    case 'ip':
      return (
        <Input
          label={requiredLabel(arg)}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={arg.placeholder ?? '192.168.1.1'}
          error={error}
        />
      )

    case 'range':
      return (
        <RangeField arg={arg} value={value} onChange={onChange} error={error} />
      )

    case 'file':
    case 'wordlist':
    case 'directory':
      return (
        <FileField arg={arg} value={value} onChange={onChange} error={error} />
      )

    case 'textarea':
      return (
        <TextareaField arg={arg} value={value} onChange={onChange} error={error} />
      )

    case 'text':
    default:
      return (
        <Input
          label={requiredLabel(arg)}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={arg.placeholder}
          error={error}
        />
      )
  }
}

// ── Specialized Field Components ──

function SelectField({
  arg,
  value,
  onChange,
  error
}: {
  arg: ModuleArgument
  value: unknown
  onChange: (val: unknown) => void
  error?: string
}) {
  const options = (arg.options ?? []).map((opt) => ({
    value: opt.value,
    label: opt.label
  }))

  // Check if any option has help text for tooltips
  const hasHelp = arg.options?.some((o) => o.help)

  if (!hasHelp) {
    return (
      <Select
        label={requiredLabel(arg)}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        options={options}
        placeholder={arg.placeholder ?? `Select ${arg.name.toLowerCase()}...`}
        error={error}
      />
    )
  }

  // Custom select with help tooltips
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-text-secondary font-sans uppercase tracking-wider">
        {requiredLabel(arg)}
      </label>
      <div className="relative">
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full px-3 py-2 text-sm font-mono appearance-none
            bg-bg-input text-text-primary
            border rounded-md
            focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
            ${error ? 'border-error' : 'border-border'}
          `}
        >
          <option value="" disabled>
            {arg.placeholder ?? `Select ${arg.name.toLowerCase()}...`}
          </option>
          {(arg.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {/* Show selected option's help text */}
      {value != null && value !== '' && (() => {
        const selected = arg.options?.find((o) => o.value === String(value))
        if (selected?.help) {
          return <p className="text-xs text-accent/70 font-sans">{selected.help}</p>
        }
        return null
      })()}
      {error && <p className="text-xs text-error font-sans">{error}</p>}
    </div>
  )
}

function MultiselectField({
  arg,
  value,
  onChange,
  error
}: {
  arg: ModuleArgument
  value: unknown
  onChange: (val: unknown) => void
  error?: string
}) {
  const selected = Array.isArray(value) ? (value as string[]) : []

  const toggle = (optValue: string) => {
    if (selected.includes(optValue)) {
      onChange(selected.filter((v) => v !== optValue))
    } else {
      onChange([...selected, optValue])
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-text-secondary font-sans uppercase tracking-wider">
        {requiredLabel(arg)}
        {selected.length > 0 && (
          <span className="ml-2 text-accent">{selected.length} selected</span>
        )}
      </label>
      <div className="flex flex-wrap gap-2">
        {(arg.options ?? []).map((opt) => {
          const isSelected = selected.includes(opt.value)
          const btn = (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`
                px-2.5 py-1 text-xs font-mono rounded-md border transition-colors
                ${
                  isSelected
                    ? 'bg-accent/15 text-accent border-accent/30'
                    : 'bg-bg-input text-text-secondary border-border hover:border-border-bright hover:text-text-primary'
                }
              `}
            >
              {opt.label}
            </button>
          )
          if (opt.help) {
            return (
              <Tooltip key={opt.value} content={opt.help} position="top">
                {btn}
              </Tooltip>
            )
          }
          return btn
        })}
      </div>
      {error && <p className="text-xs text-error font-sans">{error}</p>}
    </div>
  )
}

function FileField({
  arg,
  value,
  onChange,
  error
}: {
  arg: ModuleArgument
  value: unknown
  onChange: (val: unknown) => void
  error?: string
}) {
  const typeLabel =
    arg.type === 'wordlist'
      ? 'Wordlist'
      : arg.type === 'directory'
        ? 'Directory'
        : 'File'

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-text-secondary font-sans uppercase tracking-wider">
        {requiredLabel(arg)}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={arg.placeholder ?? `/path/to/${typeLabel.toLowerCase()}`}
          className={`
            flex-1 px-3 py-2 text-sm font-mono
            bg-bg-input text-text-primary
            border rounded-md
            placeholder:text-text-muted
            focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
            ${error ? 'border-error' : 'border-border'}
          `}
        />
        <button
          type="button"
          onClick={() => {
            // TODO: Open Electron file dialog via IPC in a future task
          }}
          className="px-3 py-2 text-xs font-sans bg-bg-elevated text-text-secondary border border-border-bright rounded-md hover:bg-bg-surface hover:text-text-primary transition-colors"
        >
          Browse
        </button>
      </div>
      {arg.type === 'wordlist' && arg.default != null && (
        <p className="text-xs text-text-muted font-sans">
          Default: <span className="text-accent/70">{String(arg.default)}</span>
        </p>
      )}
      {arg.file_filter && (
        <p className="text-xs text-text-muted font-sans">
          {arg.file_filter.description ?? `Accepts: ${arg.file_filter.extensions.join(', ')}`}
        </p>
      )}
      {error && <p className="text-xs text-error font-sans">{error}</p>}
    </div>
  )
}

function TextareaField({
  arg,
  value,
  onChange,
  error
}: {
  arg: ModuleArgument
  value: unknown
  onChange: (val: unknown) => void
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-text-secondary font-sans uppercase tracking-wider">
        {requiredLabel(arg)}
      </label>
      <textarea
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder={arg.placeholder}
        rows={4}
        className={`
          w-full px-3 py-2 text-sm font-mono resize-y
          bg-bg-input text-text-primary
          border rounded-md
          placeholder:text-text-muted
          focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
          ${error ? 'border-error' : 'border-border'}
        `}
      />
      {error && <p className="text-xs text-error font-sans">{error}</p>}
    </div>
  )
}

function RangeField({
  arg,
  value,
  onChange,
  error
}: {
  arg: ModuleArgument
  value: unknown
  onChange: (val: unknown) => void
  error?: string
}) {
  const v = arg.validation
  const numVal = value !== undefined && value !== null ? Number(value) : (v?.min ?? 0)

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-text-secondary font-sans uppercase tracking-wider">
        {requiredLabel(arg)}
        <span className="ml-2 text-accent">{numVal}</span>
      </label>
      <input
        type="range"
        value={numVal}
        onChange={(e) => onChange(Number(e.target.value))}
        min={v?.min ?? 0}
        max={v?.max ?? 100}
        className="w-full accent-[var(--accent-primary)]"
      />
      <div className="flex justify-between text-[10px] text-text-muted font-mono">
        <span>{v?.min ?? 0}</span>
        <span>{v?.max ?? 100}</span>
      </div>
      {error && <p className="text-xs text-error font-sans">{error}</p>}
    </div>
  )
}

// ── Helpers ──

function requiredLabel(arg: ModuleArgument): string {
  return arg.required ? `${arg.name} *` : arg.name
}
