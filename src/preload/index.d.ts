import type { IpcChannelMap, IpcEventMap } from '../shared/types/ipc'

/**
 * Typed IPC bridge API exposed to the renderer via contextBridge.
 *
 * - `invoke` is type-safe: the channel name determines request/response types.
 * - `on` subscribes to streaming events with typed payloads.
 * - Window controls are convenience wrappers around invoke.
 */
export interface PreloadAPI {
  /** Type-safe request-response IPC. Channel determines req/res types. */
  invoke<C extends keyof IpcChannelMap>(
    channel: C,
    data?: IpcChannelMap[C]['request']
  ): Promise<IpcChannelMap[C]['response']>

  /** Subscribe to streaming events from the main process. Returns a cleanup function. */
  on<E extends keyof IpcEventMap>(
    channel: E,
    callback: (data: IpcEventMap[E]) => void
  ): () => void

  /** Remove all listeners for a streaming event channel. */
  removeAllListeners<E extends keyof IpcEventMap>(channel: E): void

  /** Minimize the application window. */
  minimizeWindow(): Promise<void>

  /** Maximize or restore the application window. */
  maximizeWindow(): Promise<void>

  /** Close the application window. */
  closeWindow(): Promise<void>

  /** Check if the window is currently maximized. */
  isMaximized(): Promise<boolean>
}

declare global {
  interface Window {
    api: PreloadAPI
  }
}
