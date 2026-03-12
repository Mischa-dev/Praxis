import { useState, useEffect, useRef } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'
import { useProfileStore, selectAppName, selectBranding } from '../../stores/profile-store'

export function TitleBar() {
  const appName = useProfileStore(selectAppName)
  const branding = useProfileStore(selectBranding)
  const [maximized, setMaximized] = useState(false)
  const [showLogo, setShowLogo] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    window.api.isMaximized().then(setMaximized)
  }, [])

  const handleMinimize = () => window.api.minimizeWindow()
  const handleMaximize = async () => {
    await window.api.maximizeWindow()
    setMaximized(await window.api.isMaximized())
  }
  const handleClose = () => window.api.closeWindow()

  const handleMouseEnter = () => {
    clearTimeout(hideTimer.current)
    setShowLogo(true)
  }
  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setShowLogo(false), 200)
  }

  return (
    <div className="flex items-center h-9 bg-bg-base border-b border-border select-none drag-region shrink-0">
      {/* App title — left side, with ASCII hover reveal */}
      <div
        className="flex items-center gap-2 px-4 no-drag-region relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="text-accent text-xs font-bold tracking-widest text-glow glitch" data-text={appName.toUpperCase()}>
          {appName.toUpperCase()}
        </span>

        {/* ASCII art logo popup */}
        {showLogo && branding?.logo_ascii && (
          <div className="absolute top-full left-2 mt-1 z-50 fade-in">
            <pre className="text-[9px] leading-tight text-accent text-glow font-mono whitespace-pre px-3 py-2 bg-bg-base border border-border rounded shadow-lg">
              {branding.logo_ascii.trimEnd()}
            </pre>
            {branding.tagline_secondary && (
              <div className="text-[9px] text-text-muted text-center mt-0.5 italic">
                {branding.tagline_secondary}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spacer — draggable */}
      <div className="flex-1" />

      {/* Window controls — right side */}
      <div className="flex items-center no-drag-region">
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-11 h-9 hover:bg-bg-elevated transition-colors"
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4 text-text-secondary" />
        </button>
        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-11 h-9 hover:bg-bg-elevated transition-colors"
          aria-label={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? (
            <Copy className="w-3.5 h-3.5 text-text-secondary" />
          ) : (
            <Square className="w-3.5 h-3.5 text-text-secondary" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-11 h-9 hover:bg-red-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-text-secondary" />
        </button>
      </div>
    </div>
  )
}
