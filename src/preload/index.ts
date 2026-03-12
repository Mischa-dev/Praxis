import { contextBridge, ipcRenderer } from 'electron'

// Channel allowlists for security — only these channels can be used from the renderer
const INVOKE_CHANNELS = [
  // Tool execution
  'tool:execute',
  'tool:cancel',
  // Scope
  'scope:check',
  'scope:set',
  // Workspace
  'workspace:create',
  'workspace:load',
  'workspace:list',
  'workspace:delete',
  'workspace:update',
  'workspace:export',
  'workspace:current',
  // Modules
  'module:list',
  'module:get',
  'module:check-install',
  'module:reload',
  // Scans
  'scan:list',
  'scan:get',
  'scan:results',
  // Workflows
  'workflow:list',
  'workflow:get',
  'workflow:execute',
  'workflow:cancel',
  // Pipelines
  'pipeline:add',
  'pipeline:get',
  'pipeline:list',
  'pipeline:update',
  'pipeline:remove',
  // Pipeline Execution
  'pipeline:execute',
  'pipeline:cancel-run',
  'pipeline:run-status',
  // Command History
  'history:list',
  // Profile
  'profile:get',
  // Glossary
  'glossary:list',
  // Settings
  'settings:get',
  'settings:set',
  // Reports
  'report:generate',
  'report:export',
  'report:templates',
  // Notifications
  'notification:desktop',
  // Generic Entity System
  'entity:schema',
  'entity:create',
  'entity:get',
  'entity:list',
  'entity:update',
  'entity:delete',
  'entity:detail',
  'entity:search',
  'entity:stats',
  'entity:actions',
  // Window controls
  'window:minimize',
  'window:maximize',
  'window:close',
  'window:isMaximized'
] as const

const EVENT_CHANNELS = [
  'tool:output',
  'tool:status',
  'workflow:step-status',
  'pipeline:node-status'
] as const

type InvokeChannel = (typeof INVOKE_CHANNELS)[number]
type EventChannel = (typeof EVENT_CHANNELS)[number]

function isValidInvokeChannel(channel: string): channel is InvokeChannel {
  return (INVOKE_CHANNELS as readonly string[]).includes(channel)
}

function isValidEventChannel(channel: string): channel is EventChannel {
  return (EVENT_CHANNELS as readonly string[]).includes(channel)
}

const api = {
  // Generic typed request-response IPC
  invoke: (channel: string, data?: unknown): Promise<unknown> => {
    if (!isValidInvokeChannel(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`))
    }
    return ipcRenderer.invoke(channel, data)
  },

  // Subscribe to streaming events from main process
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (!isValidEventChannel(channel)) {
      throw new Error(`IPC event channel not allowed: ${channel}`)
    }
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(...args)
    }
    ipcRenderer.on(channel, listener)
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },

  // Remove all listeners for a streaming event channel
  removeAllListeners: (channel: string): void => {
    if (!isValidEventChannel(channel)) {
      throw new Error(`IPC event channel not allowed: ${channel}`)
    }
    ipcRenderer.removeAllListeners(channel)
  },

  // Window controls (convenience methods per PRD Appendix G.4)
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized')
}

export type PreloadAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
