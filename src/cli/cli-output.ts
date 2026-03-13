/**
 * CLI output formatting — terminal output with ANSI colors for pipeline execution.
 */

import type { PipelineRun, PipelineNodeRun } from '@shared/types/pipeline'

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
} as const

const STATUS_SYMBOLS: Record<string, string> = {
  pending: `${COLORS.gray}○${COLORS.reset}`,
  running: `${COLORS.cyan}◉${COLORS.reset}`,
  completed: `${COLORS.green}✓${COLORS.reset}`,
  failed: `${COLORS.red}✗${COLORS.reset}`,
  skipped: `${COLORS.dim}⊘${COLORS.reset}`,
}

export function printPipelineStart(name: string, runId: string): void {
  console.log(`\n${COLORS.bold}${COLORS.cyan}▶ Pipeline:${COLORS.reset} ${name}`)
  console.log(`${COLORS.gray}  Run ID: ${runId}${COLORS.reset}\n`)
}

export function printNodeStatus(node: PipelineNodeRun): void {
  const symbol = STATUS_SYMBOLS[node.status] ?? '?'
  const errorSuffix = node.error ? ` ${COLORS.red}(${node.error})${COLORS.reset}` : ''
  console.log(`  ${symbol} ${COLORS.white}${node.nodeId}${COLORS.reset}${errorSuffix}`)
}

export function printPipelineResult(run: PipelineRun): void {
  const total = run.nodes.length
  const completed = run.nodes.filter((n) => n.status === 'completed').length
  const failed = run.nodes.filter((n) => n.status === 'failed').length
  const skipped = run.nodes.filter((n) => n.status === 'skipped').length

  console.log('')

  if (run.status === 'completed') {
    console.log(`${COLORS.green}${COLORS.bold}✓ Pipeline completed${COLORS.reset}`)
  } else if (run.status === 'failed') {
    console.log(`${COLORS.red}${COLORS.bold}✗ Pipeline failed${COLORS.reset}`)
  } else if (run.status === 'cancelled') {
    console.log(`${COLORS.yellow}${COLORS.bold}⊘ Pipeline cancelled${COLORS.reset}`)
  }

  console.log(`${COLORS.gray}  ${completed}/${total} completed, ${failed} failed, ${skipped} skipped${COLORS.reset}`)

  if (run.variables && Object.keys(run.variables).length > 0) {
    console.log(`\n${COLORS.cyan}Variables:${COLORS.reset}`)
    for (const [key, value] of Object.entries(run.variables)) {
      const displayValue = typeof value === 'string' ? value : JSON.stringify(value)
      const truncated = displayValue.length > 80 ? displayValue.slice(0, 80) + '...' : displayValue
      console.log(`  ${COLORS.white}${key}${COLORS.reset} = ${truncated}`)
    }
  }

  console.log('')
}

export function printError(message: string): void {
  console.error(`${COLORS.red}${COLORS.bold}Error:${COLORS.reset} ${message}`)
}

export function printInfo(message: string): void {
  console.log(`${COLORS.cyan}ℹ${COLORS.reset} ${message}`)
}

export function printPipelineList(pipelines: Array<{ id: number; name: string; description: string | null }>): void {
  if (pipelines.length === 0) {
    console.log(`${COLORS.dim}No saved pipelines found.${COLORS.reset}`)
    return
  }
  console.log(`\n${COLORS.bold}Saved Pipelines:${COLORS.reset}\n`)
  for (const p of pipelines) {
    console.log(`  ${COLORS.cyan}${p.id}${COLORS.reset}  ${p.name}${p.description ? ` ${COLORS.gray}— ${p.description}${COLORS.reset}` : ''}`)
  }
  console.log('')
}
