/**
 * TerminalPane — xterm.js terminal emulator for a single session.
 * Receives streaming IPC output from process manager, supports ANSI colors,
 * scrollback, text selection/copy, search, and clear.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import type { ToolOutputEvent, ToolStatusEvent } from '@shared/types/ipc'

interface TerminalPaneProps {
  scanId?: number
  active: boolean
}

export function TerminalPane({ scanId, active }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Initialize xterm.js terminal
  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      scrollback: 10000,
      cursorBlink: false,
      cursorStyle: 'block',
      cursorInactiveStyle: 'none',
      convertEol: true,
      allowTransparency: true,
      theme: {
        background: '#080808',
        foreground: '#c8c8c8',
        cursor: '#00ff41',
        cursorAccent: '#080808',
        selectionBackground: 'rgba(0, 255, 65, 0.2)',
        selectionForeground: undefined,
        black: '#0a0a0a',
        red: '#ff5555',
        green: '#00ff41',
        yellow: '#ffb000',
        blue: '#4d9bff',
        magenta: '#bd93f9',
        cyan: '#00d4ff',
        white: '#e0e0e0',
        brightBlack: '#555555',
        brightRed: '#ff6e67',
        brightGreen: '#5af78e',
        brightYellow: '#f4f99d',
        brightBlue: '#caa9fa',
        brightMagenta: '#ff92d0',
        brightCyan: '#9aedfe',
        brightWhite: '#ffffff'
      }
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(searchAddon)
    terminal.loadAddon(webLinksAddon)

    terminal.open(containerRef.current)

    // Initial fit
    try {
      fitAddon.fit()
    } catch {
      // Container may not be visible yet
    }

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    // Resize observer for auto-fitting
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit()
      } catch {
        // Ignore errors during resize
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
      searchAddonRef.current = null
    }
  }, [])

  // Re-fit when active tab changes
  useEffect(() => {
    if (active && fitAddonRef.current) {
      try {
        fitAddonRef.current.fit()
      } catch {
        // Ignore
      }
    }
  }, [active])

  // Subscribe to IPC tool output events for this scanId
  useEffect(() => {
    if (scanId == null) return

    const cleanupOutput = window.api.on('tool:output', (event: unknown) => {
      const e = event as ToolOutputEvent
      if (e.scanId !== scanId) return
      terminalRef.current?.write(e.data)
    })

    const cleanupStatus = window.api.on('tool:status', (event: unknown) => {
      const e = event as ToolStatusEvent
      if (e.scanId !== scanId) return

      if (e.status === 'completed') {
        terminalRef.current?.write('\r\n\x1b[32m[Process completed]\x1b[0m\r\n')
      } else if (e.status === 'failed') {
        const msg = e.error ? `: ${e.error}` : ''
        terminalRef.current?.write(`\r\n\x1b[31m[Process failed${msg}]\x1b[0m\r\n`)
      } else if (e.status === 'cancelled') {
        terminalRef.current?.write('\r\n\x1b[33m[Process cancelled]\x1b[0m\r\n')
      }
    })

    return () => {
      cleanupOutput()
      cleanupStatus()
    }
  }, [scanId])

  // Search functionality
  const handleSearch = useCallback(
    (direction: 'next' | 'prev') => {
      if (!searchAddonRef.current || !searchQuery) return
      if (direction === 'next') {
        searchAddonRef.current.findNext(searchQuery)
      } else {
        searchAddonRef.current.findPrevious(searchQuery)
      }
    },
    [searchQuery]
  )

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSearch(e.shiftKey ? 'prev' : 'next')
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setSearchOpen(false)
        setSearchQuery('')
        searchAddonRef.current?.clearDecorations()
      }
    },
    [handleSearch]
  )

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => {
      if (!prev) {
        // Opening search — focus input after render
        setTimeout(() => searchInputRef.current?.focus(), 50)
      } else {
        // Closing search — clear decorations
        searchAddonRef.current?.clearDecorations()
        setSearchQuery('')
      }
      return !prev
    })
  }, [])

  // Listen for custom events from toolbar (clear, search toggle)
  useEffect(() => {
    const handleCustomClear = () => terminalRef.current?.clear()
    const handleCustomSearch = () => toggleSearch()

    window.addEventListener(`terminal:clear:${scanId}`, handleCustomClear)
    window.addEventListener(`terminal:search:${scanId}`, handleCustomSearch)
    return () => {
      window.removeEventListener(`terminal:clear:${scanId}`, handleCustomClear)
      window.removeEventListener(`terminal:search:${scanId}`, handleCustomSearch)
    }
  }, [scanId, toggleSearch])

  return (
    <div
      className="terminal-pane scanlines relative flex-1 min-h-0"
      style={{ display: active ? 'block' : 'none' }}
    >
      {/* Search bar overlay */}
      {searchOpen && (
        <div className="terminal-search-bar">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (e.target.value) {
                searchAddonRef.current?.findNext(e.target.value)
              } else {
                searchAddonRef.current?.clearDecorations()
              }
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search..."
            spellCheck={false}
            autoComplete="off"
          />
          <button onClick={() => handleSearch('prev')} title="Previous match (Shift+Enter)">
            <ChevronUp size={14} />
          </button>
          <button onClick={() => handleSearch('next')} title="Next match (Enter)">
            <ChevronDown size={14} />
          </button>
          <button onClick={toggleSearch} title="Close search (Escape)">
            <X size={14} />
          </button>
        </div>
      )}

      {/* xterm.js container */}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}

