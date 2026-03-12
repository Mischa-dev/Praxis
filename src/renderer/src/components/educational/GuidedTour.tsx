import { useState, useCallback, useEffect } from 'react'
import {
  Crosshair,
  Plus,
  Play,
  BarChart3,
  Lightbulb,
  ChevronRight,
  ChevronLeft,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '../common'
import { useProfileStore, selectAppName, selectTagline } from '../../stores/profile-store'
import { useUiStore } from '../../stores/ui-store'

const TOUR_STORAGE_KEY = 'aeth0n-tour-completed'

interface TourStep {
  title: string
  description: string
  icon: React.ReactNode
  highlight?: 'sidebar' | 'main' | 'context' | 'terminal' | 'statusbar'
  hint?: string
}

const tourSteps: TourStep[] = [
  {
    title: 'Welcome',
    description:
      'This is a guided command center for CLI security tools. It tells you what to do, explains every action, executes tools, parses output, and suggests next steps. You never need to memorize CLI flags.',
    icon: <Zap className="w-8 h-8" />,
  },
  {
    title: 'Target-Centric Workflow',
    description:
      'Everything revolves around targets — IPs, domains, URLs. Add a target, and the app tells you what tools you can run against it, what the results mean, and what to do next. New options appear as you discover more about a target.',
    icon: <Crosshair className="w-8 h-8" />,
    highlight: 'main',
    hint: 'Navigate to Targets from the sidebar to get started',
  },
  {
    title: 'Adding Targets',
    description:
      'Click "Add Target" on the Targets board. Type an IP address, domain, or URL and the app auto-detects the type. If the target resolves to a cloud provider, you\'ll get a scope warning before proceeding.',
    icon: <Plus className="w-8 h-8" />,
    highlight: 'main',
    hint: 'Try adding a local IP like 192.168.1.1 or a VM address',
  },
  {
    title: 'Running Scans',
    description:
      'Open a target to see suggested actions — the app tells you what to run based on what it already knows. Click an action to auto-fill the tool form, review the command preview, then hit Execute. Output streams live in the terminal below.',
    icon: <Play className="w-8 h-8" />,
    highlight: 'sidebar',
    hint: 'The sidebar lists all available tools organized by category',
  },
  {
    title: 'Understanding Results',
    description:
      'After a scan completes, results are parsed automatically. The app extracts services, vulnerabilities, and credentials, then explains what they mean and suggests logical next steps. Hover any highlighted term for a definition.',
    icon: <BarChart3 className="w-8 h-8" />,
    highlight: 'terminal',
    hint: 'Click a completed scan in Target Detail to see parsed results',
  },
  {
    title: 'Context Panel',
    description:
      'The right panel shows your active target, running scans, recent results, and top suggested actions. It updates in real-time as scans complete and new data is discovered. It\'s your mission briefing at a glance.',
    icon: <Lightbulb className="w-8 h-8" />,
    highlight: 'context',
    hint: 'Press Ctrl+J to toggle the terminal pane',
  },
]

/** Returns true if the user has completed or dismissed the tour */
function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function markTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true')
  } catch {
    // localStorage not available
  }
}

export function GuidedTour() {
  const [visible, setVisible] = useState(() => !isTourCompleted())
  const [step, setStep] = useState(0)
  const appName = useProfileStore(selectAppName)
  const tagline = useProfileStore(selectTagline)
  const navigate = useUiStore((s) => s.navigate)

  // Escape key to close
  useEffect(() => {
    if (!visible) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const handleSkip = useCallback(() => {
    markTourCompleted()
    setVisible(false)
  }, [])

  const handleNext = useCallback(() => {
    if (step < tourSteps.length - 1) {
      setStep((s) => s + 1)
    } else {
      // Last step — finish tour and navigate to targets
      markTourCompleted()
      setVisible(false)
      navigate('targets')
    }
  }, [step, navigate])

  const handlePrev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1)
  }, [step])

  if (!visible) return null

  const current = tourSteps[step]
  const isFirst = step === 0
  const isLast = step === tourSteps.length - 1
  const progress = ((step + 1) / tourSteps.length) * 100

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Highlight indicator — subtle border glow on the referenced UI area */}
      {current.highlight && <HighlightIndicator area={current.highlight} />}

      {/* Tour card */}
      <div className="relative z-10 w-full max-w-lg mx-4 view-enter">
        <div className="bg-bg-surface border border-border-bright rounded-lg shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-0.5 bg-bg-elevated">
            <div
              className="h-full bg-accent transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 p-1 text-text-muted hover:text-text-secondary transition-colors"
            aria-label="Skip tour"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="px-8 pt-8 pb-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[10px] font-sans text-text-muted tracking-widest uppercase">
                {step + 1} / {tourSteps.length}
              </span>
              {isFirst && (
                <span className="text-[10px] font-sans text-accent tracking-widest uppercase font-bold">
                  {appName}
                </span>
              )}
            </div>

            {/* Icon + Title */}
            <div className="flex items-start gap-4 mb-4">
              <div className="text-accent shrink-0 mt-0.5">{current.icon}</div>
              <div>
                <h2 className="text-lg font-display font-bold text-text-primary">
                  {current.title}
                </h2>
                {isFirst && tagline && (
                  <p className="text-xs text-accent font-sans mt-0.5 italic">
                    &quot;{tagline}&quot;
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-text-secondary leading-relaxed mb-4 font-sans">
              {current.description}
            </p>

            {/* Hint */}
            {current.hint && (
              <div className="flex items-start gap-2 px-3 py-2 rounded bg-accent/5 border border-accent/10 mb-4">
                <Lightbulb className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                <span className="text-xs text-accent/80 font-sans">{current.hint}</span>
              </div>
            )}

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1.5 mb-6">
              {tourSteps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                    i === step
                      ? 'bg-accent w-4'
                      : i < step
                        ? 'bg-accent/40'
                        : 'bg-bg-elevated'
                  }`}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between">
              <div>
                {!isFirst && (
                  <Button variant="ghost" size="sm" onClick={handlePrev}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Back
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  Skip Tour
                </Button>
                <Button variant="primary" size="sm" onClick={handleNext}>
                  {isLast ? 'Get Started' : 'Next'}
                  {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Visual indicator that pulses the border of the referenced UI area */
function HighlightIndicator({ area }: { area: string }) {
  // Position configs for each highlightable area
  const positionMap: Record<string, string> = {
    sidebar: 'left-0 top-9 bottom-6 w-56',
    main: 'left-56 top-9 bottom-6 right-72',
    context: 'right-0 top-9 bottom-6 w-72',
    terminal: 'left-56 bottom-6 right-72 h-32',
    statusbar: 'left-0 right-0 bottom-0 h-6',
  }

  const pos = positionMap[area]
  if (!pos) return null

  return (
    <div
      className={`absolute ${pos} border-2 border-accent/30 rounded-sm pointer-events-none z-[5]`}
      style={{
        boxShadow: '0 0 20px 4px color-mix(in srgb, var(--accent-primary) 15%, transparent)',
        animation: 'status-pulse 2s ease-in-out infinite',
      }}
    />
  )
}

/** Reset the tour so it shows again on next app load */
export function resetTour(): void {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY)
  } catch {
    // localStorage not available
  }
}
