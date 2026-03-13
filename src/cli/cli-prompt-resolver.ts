/**
 * CLI prompt resolver — readline-based user input for headless pipeline execution.
 */

import { createInterface } from 'readline'
import type { PromptNodeConfig } from '@shared/types/pipeline'

export async function cliPromptResolver(
  config: PromptNodeConfig,
  _runId: string,
  _nodeId: string
): Promise<string | boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, (answer) => {
      resolve(answer)
    }))

  try {
    switch (config.type) {
      case 'confirm': {
        const defaultLabel = config.default === 'true' ? ' [Y/n]' : config.default === 'false' ? ' [y/N]' : ' [y/n]'
        const answer = await ask(`\x1b[36m?\x1b[0m ${config.message}${defaultLabel}: `)
        const trimmed = answer.trim().toLowerCase()
        if (trimmed === '') {
          return config.default === 'true'
        }
        return trimmed === 'y' || trimmed === 'yes'
      }

      case 'select': {
        if (!config.options?.length) {
          return config.default ?? ''
        }
        console.log(`\x1b[36m?\x1b[0m ${config.message}`)
        for (let i = 0; i < config.options.length; i++) {
          const marker = config.options[i] === config.default ? '\x1b[32m>\x1b[0m' : ' '
          console.log(`  ${marker} ${i + 1}. ${config.options[i]}`)
        }
        const answer = await ask('  Enter number: ')
        const idx = parseInt(answer.trim(), 10) - 1
        if (idx >= 0 && idx < config.options.length) {
          return config.options[idx]
        }
        return config.default ?? config.options[0]
      }

      case 'text':
      default: {
        const defaultLabel = config.default ? ` (${config.default})` : ''
        const answer = await ask(`\x1b[36m?\x1b[0m ${config.message}${defaultLabel}: `)
        return answer.trim() || config.default || ''
      }
    }
  } finally {
    rl.close()
  }
}
