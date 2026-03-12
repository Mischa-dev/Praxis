/**
 * Tool execution IPC handlers — handles tool:execute and tool:cancel.
 *
 * Converts module definitions + form values into CLI arg arrays,
 * creates scan records, and delegates to the process manager.
 */

import type { IpcMain } from 'electron'
import { getModule } from '../module-loader'
import { getDatabase } from '../workspace-manager'
import { execute, cancel } from '../process-manager'
import type { ToolExecuteRequest, ToolCancelRequest } from '@shared/types/ipc'
import type { Module, FlagSeparator } from '@shared/types/module'

export function registerToolHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'tool:execute',
    async (_, req: ToolExecuteRequest): Promise<{ scanId: number }> => {
      const { toolId, args, targetId } = req

      // Look up the module
      const mod = await getModule(toolId)
      if (!mod) {
        throw new Error(`Module not found: ${toolId}`)
      }

      if (mod.executionMode === 'reference') {
        throw new Error(
          `Module "${toolId}" is reference-mode and cannot be executed locally`
        )
      }

      // Build CLI args from form values + module definition
      const cliArgs = buildCommandArgs(mod, args)
      const command = [mod.binary, ...cliArgs].join(' ')

      // Create scan record in database
      const db = getDatabase()
      const scan = db.addScan({
        tool_id: toolId,
        command,
        target_id: targetId,
        args: JSON.stringify(args),
        status: 'queued'
      })

      // Add to command history
      db.addCommandHistory({
        scan_id: scan.id,
        command,
        tool_id: toolId,
        target_id: targetId
      })

      // Queue for execution
      execute({
        scanId: scan.id,
        binary: mod.binary,
        args: cliArgs,
        cwd: mod.workingDirectory,
        env: mod.environment,
        timeout: mod.timeout,
        sudo: mod.requiresRoot && !mod.rootOptional,
        shell: mod.shell
      })

      return { scanId: scan.id }
    }
  )

  ipcMain.handle('tool:cancel', async (_, req: ToolCancelRequest): Promise<void> => {
    cancel(req.scanId)
  })
}

// ---------------------------------------------------------------------------
// Command argument builder
// ---------------------------------------------------------------------------

/**
 * Build a CLI args array from a module definition and form values.
 *
 * Handles: flags, flag separators (space/equals/none), positional args,
 * toggles, multiselect, raw args, and depends_on visibility.
 */
export function buildCommandArgs(
  mod: Module,
  formValues: Record<string, unknown>
): string[] {
  const positionalFirst: { pos: number; value: string }[] = []
  const positionalLast: string[] = []
  const flagged: string[] = []

  for (const arg of mod.arguments) {
    const val = formValues[arg.id]

    // Skip empty/undefined/null values
    if (val === undefined || val === null || val === '') continue
    if (arg.type === 'toggle' && val !== true) continue

    // Check dependency visibility — skip if the dependency condition is not met
    if (arg.depends_on) {
      const depVal = formValues[arg.depends_on.field]
      if (arg.depends_on.value !== undefined && depVal !== arg.depends_on.value) continue
      if (arg.depends_on.values && !arg.depends_on.values.includes(depVal)) continue
      if (arg.depends_on.not_value !== undefined && depVal === arg.depends_on.not_value) continue
    }

    // Handle positional args (no flag, placed by position)
    if (arg.position !== undefined) {
      const posStr = String(arg.position)
      if (posStr === 'last') {
        positionalLast.push(String(val))
      } else {
        positionalFirst.push({ pos: parseInt(posStr, 10) || 0, value: String(val) })
      }
      continue
    }

    // Handle toggle (flag only, no value)
    if (arg.type === 'toggle') {
      if (arg.flag) flagged.push(arg.flag)
      continue
    }

    // Handle multiselect (array of values)
    if (arg.type === 'multiselect' && Array.isArray(val)) {
      if (val.length === 0) continue

      if (arg.separator) {
        // Join all values with separator into a single arg
        const joined = (val as string[]).join(arg.separator)
        if (arg.flag) {
          appendFlagged(flagged, arg.flag, joined, arg.flag_separator)
        } else {
          flagged.push(joined)
        }
      } else {
        // Add each value with its own flag
        for (const v of val as string[]) {
          if (arg.flag) {
            appendFlagged(flagged, arg.flag, String(v), arg.flag_separator)
          } else {
            flagged.push(String(v))
          }
        }
      }
      continue
    }

    // Handle raw args (value appended directly, no flag)
    if (arg.raw) {
      flagged.push(String(val))
      continue
    }

    // Standard flagged argument
    if (arg.flag) {
      appendFlagged(flagged, arg.flag, String(val), arg.flag_separator)
    } else {
      // No flag and no position — append value directly
      flagged.push(String(val))
    }
  }

  // Sort positional-first args by position index
  positionalFirst.sort((a, b) => a.pos - b.pos)

  return [
    ...positionalFirst.map((p) => p.value),
    ...flagged,
    ...positionalLast
  ]
}

/** Append a flag + value pair to the args array using the appropriate separator. */
function appendFlagged(
  result: string[],
  flag: string,
  value: string,
  separator?: FlagSeparator
): void {
  switch (separator) {
    case 'equals':
      result.push(`${flag}=${value}`)
      break
    case 'none':
      result.push(`${flag}${value}`)
      break
    case 'space':
    default:
      result.push(flag, value)
      break
  }
}
