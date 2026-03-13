/**
 * Process manager — spawns CLI tools, streams output via IPC,
 * manages a queue with configurable parallelism, handles cancellation and timeouts.
 *
 * This module is domain-agnostic — it knows nothing about specific tools.
 * It receives a binary + args array and manages the child process lifecycle.
 */

import { spawn, type ChildProcess } from 'child_process'
import { mkdirSync, createWriteStream, type WriteStream } from 'fs'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import { getUserDataPath } from './app-paths'
import type { Scan, ScanStatus } from '@shared/types/scan'
import type { ToolOutputEvent, ToolStatusEvent } from '@shared/types/ipc'
import { getDatabase } from './workspace-manager'
import { parseAndStoreScanResults } from './scan-result-store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpawnRequest {
  scanId: number
  binary: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
  timeout?: number // ms, 0 = no timeout
  sudo?: boolean
  shell?: boolean
}

interface ManagedProcess {
  scanId: number
  child: ChildProcess
  startedAt: number
  timeoutHandle?: ReturnType<typeof setTimeout>
  outputFile?: WriteStream
  errorOutput: string
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let windowGetter: (() => BrowserWindow | null) | null = null
const running = new Map<number, ManagedProcess>()
const queue: SpawnRequest[] = []
let maxParallel = 5

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/** Initialize the process manager with a window getter for IPC streaming. */
export function initProcessManager(getWindow: () => BrowserWindow | null): void {
  windowGetter = getWindow
}

/** Set the maximum number of concurrent processes. */
export function setMaxParallel(n: number): void {
  maxParallel = Math.max(1, n)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Queue a process for execution. Spawns immediately if slots are available. */
export function execute(req: SpawnRequest): void {
  if (running.size >= maxParallel) {
    queue.push(req)
    return
  }
  spawnProcess(req)
}

/** Cancel a running or queued process. Returns true if found. */
export function cancel(scanId: number): boolean {
  // Check running processes
  const managed = running.get(scanId)
  if (managed) {
    killGracefully(managed)
    return true
  }

  // Check queue
  const idx = queue.findIndex((q) => q.scanId === scanId)
  if (idx >= 0) {
    queue.splice(idx, 1)
    updateScanInDb(scanId, {
      status: 'cancelled' as ScanStatus,
      completed_at: new Date().toISOString()
    })
    sendStatusEvent({ scanId, status: 'cancelled' })
    return true
  }

  return false
}

/** Cancel all running and queued processes. */
export function cancelAll(): void {
  // Cancel queued
  for (const q of queue) {
    updateScanInDb(q.scanId, {
      status: 'cancelled' as ScanStatus,
      completed_at: new Date().toISOString()
    })
    sendStatusEvent({ scanId: q.scanId, status: 'cancelled' })
  }
  queue.length = 0

  // Cancel running
  for (const [, managed] of running) {
    killGracefully(managed)
  }
}

/** Check if a scan is currently running. */
export function isRunning(scanId: number): boolean {
  return running.has(scanId)
}

/** Get the number of currently running processes. */
export function getRunningCount(): number {
  return running.size
}

/** Get the number of queued processes. */
export function getQueuedCount(): number {
  return queue.length
}

/** Clean up all processes on app exit. */
export function cleanupProcessManager(): void {
  cancelAll()
  windowGetter = null
}

// ---------------------------------------------------------------------------
// Internal — process lifecycle
// ---------------------------------------------------------------------------

function spawnProcess(req: SpawnRequest): void {
  const { scanId, binary, args, cwd, env, timeout, sudo, shell } = req

  let spawnBinary = binary
  let spawnArgs = [...args]

  // When shell mode is enabled, escape arguments to prevent injection
  if (shell) {
    spawnArgs = spawnArgs.map(escapeShellArg)
  }

  if (sudo) {
    spawnArgs = [binary, ...args]
    spawnBinary = 'sudo'
  }

  const startedAt = Date.now()

  // Update DB: running
  updateScanInDb(scanId, {
    status: 'running' as ScanStatus,
    started_at: new Date().toISOString()
  })

  // Send status event to renderer
  sendStatusEvent({ scanId, status: 'running' })

  // Create output directory for raw output
  const outputDir = getOutputDir(scanId)
  mkdirSync(outputDir, { recursive: true })
  const outputPath = join(outputDir, 'output.txt')
  const outputFile = createWriteStream(outputPath, { flags: 'w' })

  const child = spawn(spawnBinary, spawnArgs, {
    cwd: cwd || undefined,
    env: env ? { ...process.env, ...env } : undefined,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: shell ?? false
  })

  const managed: ManagedProcess = {
    scanId,
    child,
    startedAt,
    outputFile,
    errorOutput: ''
  }

  // Timeout enforcement
  if (timeout && timeout > 0) {
    managed.timeoutHandle = setTimeout(() => {
      killGracefully(managed)
    }, timeout)
  }

  running.set(scanId, managed)

  // Stream stdout
  child.stdout?.on('data', (data: Buffer) => {
    const text = data.toString()
    outputFile.write(text)
    sendOutputEvent({ scanId, data: text, stream: 'stdout' })
  })

  // Stream stderr
  child.stderr?.on('data', (data: Buffer) => {
    const text = data.toString()
    managed.errorOutput += text
    outputFile.write(text)
    sendOutputEvent({ scanId, data: text, stream: 'stderr' })
  })

  // Handle process exit
  child.on('close', (code, signal) => {
    const duration = Date.now() - startedAt
    const errorOutput = managed.errorOutput
    cleanupManaged(managed)

    const wasCancelled = signal === 'SIGTERM' || signal === 'SIGKILL'
    const status: ScanStatus = wasCancelled
      ? 'cancelled'
      : code === 0
        ? 'completed'
        : 'failed'

    updateScanInDb(scanId, {
      status,
      exit_code: code ?? -1,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      raw_output_path: outputPath,
      error_output: errorOutput || null
    })

    sendStatusEvent({
      scanId,
      status,
      exitCode: code ?? undefined,
      error: wasCancelled ? `Process terminated (${signal})` : undefined
    })

    // Parse output and store results for completed scans
    if (status === 'completed') {
      parseAndStoreScanResults(scanId).catch((err) => {
        console.error(`Failed to parse results for scan ${scanId}:`, err)
      })
    }

    drainQueue()
  })

  // Handle spawn errors (e.g., binary not found)
  child.on('error', (err) => {
    const duration = Date.now() - startedAt
    cleanupManaged(managed)

    updateScanInDb(scanId, {
      status: 'failed' as ScanStatus,
      exit_code: -1,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      error_output: err.message
    })

    sendStatusEvent({ scanId, status: 'failed', error: err.message })
    drainQueue()
  })
}

// ---------------------------------------------------------------------------
// Internal — process control
// ---------------------------------------------------------------------------

/** Send SIGTERM, then SIGKILL after 5s grace period. */
function killGracefully(managed: ManagedProcess): void {
  try {
    managed.child.kill('SIGTERM')
  } catch {
    // Process may already be dead
  }

  // Force kill after 5 second grace period
  setTimeout(() => {
    try {
      if (!managed.child.killed) {
        managed.child.kill('SIGKILL')
      }
    } catch {
      // Ignore — process already exited
    }
  }, 5000)
}

/** Clean up timeout and output file for a managed process. */
function cleanupManaged(managed: ManagedProcess): void {
  if (managed.timeoutHandle) {
    clearTimeout(managed.timeoutHandle)
  }
  if (managed.outputFile) {
    managed.outputFile.end()
  }
  running.delete(managed.scanId)
}

/** Spawn queued processes if slots are available. */
function drainQueue(): void {
  while (queue.length > 0 && running.size < maxParallel) {
    const next = queue.shift()!
    spawnProcess(next)
  }
}

// ---------------------------------------------------------------------------
// Internal — IPC streaming
// ---------------------------------------------------------------------------

function sendOutputEvent(event: ToolOutputEvent): void {
  const win = windowGetter?.()
  if (win && !win.isDestroyed()) {
    win.webContents.send('tool:output', event)
  }
}

function sendStatusEvent(event: ToolStatusEvent): void {
  const win = windowGetter?.()
  if (win && !win.isDestroyed()) {
    win.webContents.send('tool:status', event)
  }
}

// ---------------------------------------------------------------------------
// Internal — database updates
// ---------------------------------------------------------------------------

type ScanUpdates = Partial<
  Pick<
    Scan,
    | 'status'
    | 'exit_code'
    | 'started_at'
    | 'completed_at'
    | 'duration_ms'
    | 'raw_output_path'
    | 'parsed_results'
    | 'error_output'
  >
>

function updateScanInDb(scanId: number, updates: ScanUpdates): void {
  try {
    getDatabase().updateScan(scanId, updates)
  } catch (err) {
    console.error(`Failed to update scan ${scanId}:`, err)
  }
}

function getOutputDir(scanId: number): string {
  return join(getUserDataPath(), 'output', String(scanId))
}

/** Escape a string for safe use as a shell argument */
function escapeShellArg(arg: string): string {
  // Wrap in single quotes, escaping any embedded single quotes
  return "'" + arg.replace(/'/g, "'\\''") + "'"
}
