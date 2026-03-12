/**
 * Renderer-side command builder.
 *
 * Converts a module definition + form values into a structured array of
 * CommandSegment objects. Each segment carries its display text, role
 * (binary / flag / value / positional / separator), and optional help
 * text so the UI can syntax-highlight and attach tooltips.
 */

import type { Module, ModuleArgument, FlagSeparator } from '@shared/types/module'

export type SegmentRole = 'binary' | 'flag' | 'value' | 'positional' | 'separator'

export interface CommandSegment {
  /** The text to display (e.g. "nmap", "-sS", "192.168.1.1") */
  text: string
  /** Semantic role for syntax highlighting */
  role: SegmentRole
  /** Optional help text (from the argument definition) */
  help?: string
  /** The argument name this segment belongs to */
  argName?: string
  /** The argument ID this segment belongs to */
  argId?: string
}

/**
 * Build a structured command representation from module + form values.
 *
 * The logic mirrors `buildCommandArgs` in tool-handlers.ts but produces
 * annotated segments instead of a flat string array.
 */
export function buildCommand(
  mod: Module,
  formValues: Record<string, unknown>
): CommandSegment[] {
  const segments: CommandSegment[] = []

  // Binary
  if (mod.requiresRoot) {
    segments.push({ text: 'sudo', role: 'binary' })
  }
  segments.push({ text: mod.binary, role: 'binary' })

  const positionalFirst: { pos: number; seg: CommandSegment }[] = []
  const positionalLast: CommandSegment[] = []
  const flagged: CommandSegment[] = []

  for (const arg of mod.arguments) {
    const val = formValues[arg.id]

    // Skip empty/undefined/null values
    if (val === undefined || val === null || val === '') continue
    if (arg.type === 'toggle' && val !== true) continue

    // Check dependency visibility
    if (arg.depends_on) {
      const depVal = formValues[arg.depends_on.field]
      if (arg.depends_on.value !== undefined && depVal !== arg.depends_on.value) continue
      if (arg.depends_on.values && !arg.depends_on.values.includes(depVal)) continue
      if (arg.depends_on.not_value !== undefined && depVal === arg.depends_on.not_value) continue
    }

    // Positional args
    if (arg.position !== undefined) {
      const posStr = String(arg.position)
      const seg: CommandSegment = {
        text: String(val),
        role: 'positional',
        help: arg.help,
        argName: arg.name,
        argId: arg.id
      }
      if (posStr === 'last') {
        positionalLast.push(seg)
      } else {
        positionalFirst.push({ pos: parseInt(posStr, 10) || 0, seg })
      }
      continue
    }

    // Toggle (flag only, no value)
    if (arg.type === 'toggle') {
      if (arg.flag) {
        flagged.push({
          text: arg.flag,
          role: 'flag',
          help: arg.help,
          argName: arg.name,
          argId: arg.id
        })
      }
      continue
    }

    // Multiselect
    if (arg.type === 'multiselect' && Array.isArray(val)) {
      if ((val as string[]).length === 0) continue

      if (arg.separator) {
        const joined = (val as string[]).join(arg.separator)
        appendFlaggedSegments(flagged, arg, joined, arg.flag_separator)
      } else {
        for (const v of val as string[]) {
          appendFlaggedSegments(flagged, arg, String(v), arg.flag_separator)
        }
      }
      continue
    }

    // Raw args (value appended directly, no flag)
    if (arg.raw) {
      flagged.push({
        text: String(val),
        role: 'value',
        help: arg.help,
        argName: arg.name,
        argId: arg.id
      })
      continue
    }

    // Select with flag_separator "none" — the value IS the flag (e.g. nmap scan types: -sS)
    if (arg.type === 'select' && arg.flag_separator === 'none' && !arg.flag) {
      flagged.push({
        text: String(val),
        role: 'flag',
        help: getOptionHelp(arg, val) ?? arg.help,
        argName: arg.name,
        argId: arg.id
      })
      continue
    }

    // Standard flagged argument
    if (arg.flag) {
      appendFlaggedSegments(flagged, arg, String(val), arg.flag_separator)
    } else {
      flagged.push({
        text: String(val),
        role: 'value',
        help: arg.help,
        argName: arg.name,
        argId: arg.id
      })
    }
  }

  // Sort positional-first by position index
  positionalFirst.sort((a, b) => a.pos - b.pos)

  // Assemble: positional-first → flagged → positional-last
  segments.push(...positionalFirst.map((p) => p.seg))
  segments.push(...flagged)
  segments.push(...positionalLast)

  return segments
}

/** Get the help text for a specific selected option value. */
function getOptionHelp(arg: ModuleArgument, val: unknown): string | undefined {
  if (!arg.options) return undefined
  const opt = arg.options.find((o) => o.value === val)
  return opt?.help
}

/** Append flag+value segment(s) using the appropriate separator style. */
function appendFlaggedSegments(
  result: CommandSegment[],
  arg: ModuleArgument,
  value: string,
  separator?: FlagSeparator
): void {
  const flag = arg.flag
  if (!flag) {
    result.push({
      text: value,
      role: 'value',
      help: arg.help,
      argName: arg.name,
      argId: arg.id
    })
    return
  }

  switch (separator) {
    case 'equals':
      // Show as a single segment "flag=value" but role is flag
      result.push({
        text: `${flag}=${value}`,
        role: 'flag',
        help: arg.help,
        argName: arg.name,
        argId: arg.id
      })
      break
    case 'none':
      // Flag and value merged: "-sS"
      result.push({
        text: `${flag}${value}`,
        role: 'flag',
        help: arg.help,
        argName: arg.name,
        argId: arg.id
      })
      break
    case 'space':
    default:
      // Flag and value as separate segments
      result.push({
        text: flag,
        role: 'flag',
        help: arg.help,
        argName: arg.name,
        argId: arg.id
      })
      result.push({
        text: value,
        role: 'value',
        help: arg.help,
        argName: arg.name,
        argId: arg.id
      })
      break
  }
}

/** Convert segments to a plain command string. */
export function segmentsToString(segments: CommandSegment[]): string {
  return segments.map((s) => (s.text.includes(' ') ? `"${s.text}"` : s.text)).join(' ')
}
