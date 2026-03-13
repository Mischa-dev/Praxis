# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Praxis?

Praxis is a **visual CLI workflow automation platform** built on Electron — think
"n8n for the terminal." Users build node-based pipelines that chain CLI commands
with control flow (conditionals, loops, prompts, variables), executable from both
the GUI and a headless CLI.

All domain knowledge — entity schemas, tool definitions, action rules, workflows,
and branding — is injected via a swappable **profile** directory. To build a new
app: swap `profile/`, run `pnpm build`, done. No engine code changes.

Extracted from [Aeth0n](https://github.com/Mischa-dev/Aeth0n) (pentesting command
center). Praxis = engine, Aeth0n = pentesting profile.

## Build, Lint & Launch

```bash
pnpm install          # Install deps (first time or after package changes)
pnpm build            # Compile everything (main + preload + renderer)
pnpm build:cli        # Bundle CLI separately (esbuild → out/cli-bundle.js)
./praxis.sh           # Launch the GUI app (runs out/main/index.js via electron)
pnpm dev              # Development mode with hot reload

pnpm typecheck        # Run both TypeScript checks (node + web)
pnpm typecheck:node   # Typecheck main process + preload (tsconfig.node.json)
pnpm typecheck:web    # Typecheck renderer (tsconfig.web.json)
pnpm lint             # ESLint (flat config, warns on unused vars and explicit any)
pnpm format           # Prettier (default config, no .prettierrc)
```

**ALWAYS run `pnpm build` after making code changes.** The launch script runs
compiled output from `out/`. If you don't rebuild, stale code runs.

**No test framework is configured.** There are no tests in this repo.

### CLI

```bash
node out/cli-bundle.js list                              # List saved pipelines
node out/cli-bundle.js run "pipeline-name"               # Execute a pipeline
node out/cli-bundle.js run "pipeline-name" --dry-run     # Show plan without executing
node out/cli-bundle.js run "pipeline-name" --var key=val # Pre-set variables
node out/cli-bundle.js --data-dir ~/.config/praxis list  # Use specific data dir
```

The CLI is bundled with **esbuild** (not tsc) because TypeScript path aliases
(`@shared/*`, `@main/*`) aren't resolved by Node.js at runtime. The bundle
externalizes `better-sqlite3` (native addon) and `electron`.

**Native module ABI mismatch**: `better-sqlite3` must be compiled for the right
Node.js version. After `pnpm install`, it's built for Electron. To test the CLI
with system Node.js, run `pnpm rebuild better-sqlite3`. To restore for Electron:
`npx @electron/rebuild -v $(node -e "console.log(require('electron/package.json').version)") -w better-sqlite3`.

## Critical Rule: Engine vs Profile

- **Engine** (`src/`): Generic CLI orchestration. `grep -r "nmap\|hydra\|pentest" src/`
  must return **zero results**. Never hardcode tool names or domain concepts.
- **Profile** (`profile/`): All domain content — entity schemas, tool YAMLs, actions,
  workflows, glossary, scope data, themes, branding, and optional custom React views
  in `profile/src/`.

This separation is non-negotiable.

## Architecture

### Dual Execution Modes

Praxis runs in two modes sharing the same engine code:

1. **GUI mode** (Electron) — visual pipeline builder, interactive forms, terminal
2. **CLI mode** (headless Node.js) — `src/cli/index.ts` entry point, readline prompts

The abstraction boundary is:
- `src/main/app-paths.ts` — `getUserDataPath()` tries Electron's `app.getPath()`,
  falls back to `~/.praxis`. CLI calls `setUserDataPath()` to override.
- `src/main/profile-loader.ts` — `setProfileRoot()` for CLI; lazy `require('electron')`
  in `getProfileRoot()` so it doesn't crash without Electron.
- `src/main/pipeline-engine.ts` — `PromptResolver` type injected at init. GUI uses
  IPC-based resolver (sends event → waits for response). CLI injects readline-based
  `cliPromptResolver`. Pipeline engine doesn't know which mode it's in.

### Entity System (Optional)

The entity system (profile-defined data model via `profile/schema.yaml`) is entirely
optional. Pipelines can execute without any target entity — `targetId` is optional
throughout the pipeline and workflow engines. When no entity schema is loaded, the
sidebar hides the entity nav item, and the Start node shows "Pipeline Start" instead
of a target selector.

### Process Model (3 Electron layers + CLI)

```
src/main/           → Electron main process (Node.js)
  index.ts            App entry: loads profile, inits DB, registers IPC, creates window
  app-paths.ts        Electron/CLI path abstraction (getUserDataPath, setUserDataPath)
  ipc/                IPC handlers (entity, tool, scan, workflow, pipeline, etc.)
  pipeline-engine.ts  Executes visual pipeline graphs (shell, prompt, set-variable, tool nodes)
  template-resolver.ts  Template expressions, pipe functions, compound conditions
  workflow-engine.ts  Executes multi-step automated workflows
  process-manager.ts  Spawns CLI tools, manages queue, streams output
  profile-loader.ts   Loads manifest.yaml + glossary (setProfileRoot for CLI)
  module-loader.ts    Loads YAML tool definitions (hot-reloads on file change)

src/preload/         → Bridge (whitelists IPC channels, exposes window.api)

src/renderer/src/    → React frontend
  components/pipeline/  Pipeline builder + node components (ShellNode, PromptNode, etc.)

src/cli/             → Headless CLI entry point
  index.ts             Arg parsing, profile/workspace init, pipeline execution with polling
  cli-prompt-resolver.ts  readline-based prompt handler (confirm/text/select)
  cli-output.ts        ANSI-colored status output
```

### Pipeline Node Types

| Type | Config Interface | Executor | Description |
|------|-----------------|----------|-------------|
| `start` | `StartNodeConfig` | Sets target context (optional) | Entry point |
| `tool` | `ToolNodeConfig` | Runs a module via process-manager | CLI tool execution |
| `shell` | `ShellNodeConfig` | `child_process.exec()` directly | Arbitrary shell command |
| `prompt` | `PromptNodeConfig` | IPC dialog (GUI) or readline (CLI) | User input |
| `set-variable` | `SetVariableNodeConfig` | Resolves template, stores in vars | Variable assignment |
| `condition` | `ConditionNodeConfig` | `evaluateCondition()` → routes branches | Boolean branching |
| `for-each` | `ForEachNodeConfig` | Iterates array, executes body nodes | Loop |
| `delay` | `DelayNodeConfig` | `setTimeout` | Pause |
| `note` | `NoteNodeConfig` | No-op | Canvas annotation |

Shell and tool nodes support **output capture**: `captureOutput: { variable, mode, pattern }`.
Modes: `full`, `last_line`, `regex` (first capture group), `json` (with optional path).

### Template Expression Language

Used in pipeline configs, workflow steps, and action rules. Syntax: `${expression}`.

**Namespaces**: `target.*` (entity fields), `steps.<id>.*` / `nodes.<id>.*` (prior
results, `.output` for raw stdout, `.results.*` for parsed), `vars.*` (pipeline
variables), `item` / `item.*` (for-each iteration).

**Pipe functions** (chained with `|`):
- Array: `join('sep')`, `where('field','val')`, `count`, `first`, `pluck('field')`, `unique`
- String: `trim`, `upper`, `lower`, `split('delim')`, `replace('old','new')`
- Predicates: `startsWith('p')`, `endsWith('s')`, `contains('s')`, `matches('regex')`, `exists`
- Type: `toNumber`, `toString`, `toBool`, `length`
- Fallback: `default('value')`
- Comparison: `== 'str'`, `!= 'str'`, `> N`, `>= N`, `< N`, `<= N`, `== N`, `!= N`

**Compound conditions**: `&&`, `||`, `!` negation, `(...)` grouping. Operator
precedence: `!` > `||` > `&&`.

### IPC Channels & Preload Whitelist

The preload layer explicitly allowlists every IPC channel in two arrays:
- **INVOKE_CHANNELS** (~46 channels): request-response (entity CRUD, tool execution,
  workflow/pipeline ops, workspace, settings, reports, window controls,
  `pipeline:prompt-response`)
- **EVENT_CHANNELS** (5 channels): streaming events (`tool:output`, `tool:status`,
  `workflow:step-status`, `pipeline:node-status`, `pipeline:prompt`)

**Adding a new IPC channel requires updating the whitelist in `src/preload/index.ts`.**

### View System

Views auto-discovered via `import.meta.glob` from two locations:
- Engine views: `src/renderer/src/components/views/*.tsx`
- Profile views: `profile/src/views/*.tsx` (override engine views of same ID)

File name → view ID: `TargetDetail.tsx` → `target-detail`. Navigation:
```typescript
useUiStore.navigate('target-detail', { entityId: 5 })
```

### Zustand Stores

| Store | Manages |
|-------|---------|
| `entity-store` | Schema, entity CRUD for all types, active entity, detail view |
| `ui-store` | View routing, sidebar/panel state, navigation history |
| `profile-store` | Manifest, themes, categories from profile |
| `module-store` | Tool definitions, search, favorites, recents |
| `scan-store` | Active scan, parsed results, scan module |
| `action-store` | Evaluated contextual actions for active entity |
| `workflow-store` | Workflow execution state, run history |
| `pipeline-store` | Visual pipeline definitions |
| `terminal-store` | Terminal sessions, active session |
| `workspace-store` | Project/workspace management |
| `settings-store` | User preferences, theme application |
| `notification-store` | Toast messages |

### Module System (YAML → Form → CLI)

```
profile/modules/*.yaml → module-loader.ts → Module[] in memory
  → module-store.ts → ToolForm renders dynamic form
  → command-builder.ts → CommandSegment[] (annotated tokens)
  → process-manager.ts → spawns CLI process
  → output-parser.ts → structured results → database
```

Module YAML files are hot-reloaded during development — editing a YAML in
`profile/modules/` triggers an automatic reload without restarting the app.

### Database

- One SQLite database per workspace (in `~/.praxis/workspaces/{id}/`)
- Electron app uses `~/.config/praxis/` by default; CLI defaults to `~/.praxis/`
- Uses `better-sqlite3` (synchronous), WAL mode, foreign keys enforced
- DB files are `chmod 0600` — may contain sensitive data
- **Entity tables**: created dynamically from `profile/schema.yaml` by `schema-ddl.ts`
- **Engine tables**: `scans`, `command_history`, `pipelines`, `schema_version`
- Generic CRUD methods: `create(type, data)`, `get(type, id)`, `list(type)`, etc.
- No ORM — hand-written SQL with parameterized queries

### Validation

Schema validation uses a custom lightweight validator (`src/shared/schemas/validate.ts`)
with helpers like `requireString()`, `optionalEnum()`, etc. No external validation
library (no Zod, Ajv, etc.). All YAML schemas (module, action, schema, workflow,
manifest) use this system. Returns `{ valid: boolean; errors: ValidationError[] }`.

### CSS Architecture (3 files only)

- `globals.css` — Tailwind v4 `@theme` tokens, CSS custom properties, font imports
- `effects.css` — Scanlines, glow, glitch, skeleton loading, panel animations
- `terminal.css` — xterm.js styling

### Build Configuration

- **electron-vite** with 3 configs (main/preload/renderer) — handles Electron app
- **esbuild** for CLI bundle — resolves path aliases, externalizes native addons
- `marked` is explicitly inlined (excluded from externalizeDepsPlugin) for main process
- Renderer uses `@vitejs/plugin-react` + `@tailwindcss/vite` (Tailwind v4)
- TypeScript: composite project with `tsconfig.node.json` (main+preload) and
  `tsconfig.web.json` (renderer), `jsx: "react-jsx"` (no React import needed)
- `tsconfig.cli.json` exists for type-checking CLI code but is NOT used for the
  actual build (esbuild is used instead)

## Conventions

### File Naming
- Engine code: kebab-case (`profile-loader.ts`)
- Components: PascalCase (`EntityBoard.tsx`)
- Profile YAML: kebab-case (`tool-name.yaml`)

### Path Aliases
`@main` → `src/main/`, `@renderer` → `src/renderer/src/`, `@shared` → `src/shared/`,
`@profile` → `profile/`, `@profile-src` → `profile/src/`

**These aliases only work in electron-vite builds.** The CLI uses esbuild which
resolves them at bundle time. Never use path aliases in `src/cli/` — use relative
imports to `../main/` and `../shared/`.

### Template Variables
Always `${variable}` — never bare `{variable}`. Available in workflows, actions,
pipeline configs, and module suggestions (e.g., `${vars.greeting}`, `${target.value}`).

### Electron Abstraction Pattern
Main-process modules that need `app` from Electron must use lazy `require('electron')`
in a try/catch (not top-level `import`), so CLI mode works. See `profile-loader.ts`
and `app-paths.ts` for the pattern. `import type { ... } from 'electron'` is fine
(stripped at compile time).

### Theme Switching
Themes in `manifest.yaml` define accent colors. Switching = updating CSS custom
properties (`--accent-primary`, `--accent-secondary`). No Tailwind recompile.

## Common Mistakes

- Hardcoding tool names in `src/` — engine must be domain-agnostic
- Using react-router-dom — use `ui-store.navigate()`
- Using spinners — use `.skeleton` shimmer placeholders
- Creating per-component CSS files — use Tailwind utilities
- Not rebuilding after changes — launch script runs `out/`
- Using `selectEntities(type)` inline in components — creates new function each
  render, causes infinite re-render. Use `(s) => s.caches[type]?.entities ?? STABLE_REF`
- Adding IPC channels without updating the preload whitelist in `src/preload/index.ts`
- Forgetting to add new view types to `ViewId` union in `src/shared/types/ui.ts`
- Top-level `import { app } from 'electron'` in main-process modules — breaks CLI
  mode. Use lazy `require('electron')` in a try/catch instead.
- Using `tsc` to build the CLI — path aliases won't resolve at runtime. Use
  `pnpm build:cli` (esbuild) instead.

## Authorship

When committing code or pushing to GitHub, always configure git to show the
user as the author. Do not use Claude or AI as the commit author. Use the
system's git user.name and user.email configuration.
