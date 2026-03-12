# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Praxis?

Praxis is a **universal CLI workflow orchestration platform** built on Electron.
It provides a domain-agnostic engine for building guided CLI tool workflow apps.
All domain knowledge — entity schemas, tool definitions, action rules, workflows,
and branding — is injected via a swappable **profile** directory.

To build a new app: swap `profile/`, run `pnpm build`, done. No engine code changes.

Extracted from [Aeth0n](https://github.com/Mischa-dev/Aeth0n) (pentesting command
center). Praxis = engine, Aeth0n = pentesting profile.

## Build, Lint & Launch

```bash
pnpm install          # Install deps (first time or after package changes)
pnpm build            # Compile everything (main + preload + renderer)
./praxis.sh           # Launch the app (runs out/main/index.js via electron)
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

## Critical Rule: Engine vs Profile

- **Engine** (`src/`): Generic CLI orchestration. `grep -r "nmap\|hydra\|pentest" src/`
  must return **zero results**. Never hardcode tool names or domain concepts.
- **Profile** (`profile/`): All domain content — entity schemas, tool YAMLs, actions,
  workflows, glossary, scope data, themes, branding, and optional custom React views
  in `profile/src/`.

This separation is non-negotiable.

## Architecture

### Profile-Defined Data Model (Entity System)

The profile controls the entire data model via `profile/schema.yaml`:

```yaml
schema_version: 1
primary_entity: host          # The root entity type

entities:
  host:
    label: "Host"
    label_plural: "Hosts"
    icon: "monitor"
    fields:
      value: { kind: text, required: true, unique: true, role: display }
      type:  { kind: enum, values: [local, remote], role: category }
      status: { kind: enum, values: [online, offline], role: status }
    # ...
  service:
    parent: host              # Creates host_id FK with CASCADE
    # ...
```

**Field kinds**: `text`, `integer`, `real`, `boolean`, `enum`, `json`
**Field roles**: `display` (card title), `status` (badge), `category` (grouping/icon)
**Relationships**: `parent` (FK with CASCADE), `references` (FK to other entities)

The engine reads this schema and provides:
- **Schema-driven database** — tables created dynamically from YAML, no hardcoded SQL
- **Generic CRUD** — `entity:create`, `entity:list`, `entity:update`, `entity:delete`
- **Generic UI** — `EntityBoard`, `EntityDetail`, `EntityCard`, `SchemaForm` render any entity
- **Generic IPC** — single `entity-handlers.ts` serves all entity types

### Process Model (3 Electron layers)

```
src/main/           → Electron main process (Node.js)
  index.ts            App entry: loads profile, inits DB, registers IPC, creates window
  ipc/                IPC handlers (entity, tool, scan, workflow, pipeline, etc.)
  schema-loader.ts    Loads + validates profile/schema.yaml → ResolvedSchema
  schema-ddl.ts       Generates CREATE TABLE SQL from schema
  database.ts         SQLite CRUD (generic entity methods + engine tables)
  profile-loader.ts   Loads manifest.yaml + glossary
  module-loader.ts    Loads YAML tool definitions (hot-reloads on file change)
  process-manager.ts  Spawns CLI tools, manages queue, streams output
  action-engine.ts    Evaluates action rules against entity state
  workflow-engine.ts  Executes multi-step automated workflows
  pipeline-engine.ts  Executes visual pipeline graphs
  output-parser.ts    Parses tool output (regex, JSON, XML)
  report-engine.ts    Schema-driven report generation

src/preload/         → Bridge (whitelists IPC channels, exposes window.api)
  index.ts            Exposes invoke() for request-response, on() for streaming

src/renderer/src/    → React frontend
  App.tsx             Root: loads profile + entity schema on mount
  lib/view-registry.ts  Auto-discovers views via import.meta.glob
  lib/schema-utils.ts   Field role accessors (getDisplayValue, getStatusValue, etc.)
  lib/icon-map.ts       String → Lucide icon component mapping
  stores/entity-store.ts  Single Zustand store for all entity types
  stores/              Other stores (ui, profile, module, scan, terminal, etc.)
  components/entities/ Generic entity UI (EntityBoard, EntityCard, EntityTabs, etc.)
  components/views/    View components (auto-discovered for routing)
  components/layout/   3-column layout: Sidebar | MainContent | ContextPanel
  components/context/  Context panel sections (entity summary, stats, actions)
```

### Main Process Startup Sequence

1. Load manifest + glossary from profile
2. Load entity schema (optional — app can run without schema)
3. Load cloud provider ranges for scope checking
4. Initialize default workspace database (creates tables from schema DDL)
5. Load module definitions (async, non-blocking)
6. Watch `profile/modules/` for YAML hot-reload
7. Initialize process manager, workflow engine, pipeline engine
8. Register all IPC handlers
9. Create frameless BrowserWindow (1400x900, min 1024x700)

### IPC Channels & Preload Whitelist

The preload layer explicitly allowlists every IPC channel in two arrays:
- **INVOKE_CHANNELS** (~45 channels): request-response (entity CRUD, tool execution,
  workflow/pipeline ops, workspace, settings, reports, window controls)
- **EVENT_CHANNELS** (4 channels): streaming events (`tool:output`, `tool:status`,
  `workflow:step-status`, `pipeline:node-status`)

**Adding a new IPC channel requires updating the whitelist in `src/preload/index.ts`.**
The renderer can only call channels listed in these arrays. The preload exposes
`window.api.invoke()` for request-response and `window.api.on()` for event listeners.

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

- **electron-vite** with 3 configs (main/preload/renderer)
- `marked` is explicitly inlined (excluded from externalizeDepsPlugin) for main process
- Renderer uses `@vitejs/plugin-react` + `@tailwindcss/vite` (Tailwind v4)
- TypeScript: composite project with `tsconfig.node.json` (main+preload) and
  `tsconfig.web.json` (renderer), `jsx: "react-jsx"` (no React import needed)

## Creating a New App (Profile)

To build a new domain-specific app, create a profile with:

```
profile/
  manifest.yaml     → App name, themes, categories, layout, effects
  schema.yaml       → Entity data model (types, fields, relationships)
  modules/          → YAML tool definitions (one per CLI tool)
  actions/          → Contextual action rules (when X, suggest Y)
  workflows/        → Multi-step automated flows
  glossary/         → Educational tooltips for domain concepts
  scope/            → (optional) Scope checking data
  src/              → (optional) Custom React views, stores, components
```

The engine gives you for free: schema-driven database, entity CRUD, generic UI,
tool execution with terminal, pipeline builder, workflow engine, action engine,
template resolution, settings, history, notifications, reports.

## Conventions

### File Naming
- Engine code: kebab-case (`profile-loader.ts`)
- Components: PascalCase (`EntityBoard.tsx`)
- Profile YAML: kebab-case (`tool-name.yaml`)

### Path Aliases
`@main` → `src/main/`, `@renderer` → `src/renderer/src/`, `@shared` → `src/shared/`,
`@profile` → `profile/`, `@profile-src` → `profile/src/`

### Template Variables
Always `${variable}` — never bare `{variable}`. Available in workflows, actions,
and module suggestions (e.g., `${host.value}`, `${service.port}`).

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

## Authorship

When committing code or pushing to GitHub, always configure git to show the
user as the author. Do not use Claude or AI as the commit author. Use the
system's git user.name and user.email configuration.
