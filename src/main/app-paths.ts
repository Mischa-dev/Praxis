/**
 * Centralized path abstraction — provides user data path that works in both
 * Electron (app.getPath('userData')) and CLI (env var or ~/.praxis) contexts.
 */

import { join } from 'path'
import { homedir } from 'os'

let userDataPath: string | null = null

/** Override the user data path (for CLI mode) */
export function setUserDataPath(p: string): void {
  userDataPath = p
}

/** Get the user data path, with Electron fallback */
export function getUserDataPath(): string {
  if (userDataPath) return userDataPath
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron')
    return app.getPath('userData')
  } catch {
    return join(homedir(), '.praxis')
  }
}
