# Praxis — Project Guide for AI Agents

## What is this project?

Praxis is a **universal CLI workflow orchestration platform** built on Electron. It
provides a generic, domain-agnostic engine for building guided CLI tool workflow apps.
All domain knowledge is injected via a swappable **profile** directory.

## Project Lineage

Praxis was extracted from [Aeth0n](https://github.com/Mischa-dev/Aeth0n), a guided
penetration testing command center. The relationship:

- **Praxis** (this repo) = the **engine** — generic CLI tool orchestration shell
- **Aeth0n** (separate repo) = a **profile** — pentesting-specific content that
  plugs into Praxis's `profile/` directory

Other profiles can turn Praxis into OSINT tools, forensics platforms, DevOps
dashboards, or anything that orchestrates CLI tools around targets.

## Critical Architecture: Engine vs Profile

- **Engine** (`src/`): Loads YAML tool modules, generates forms, builds commands,
  executes processes, parses output, manages targets, runs workflows, provides
  educational overlays. **It knows NOTHING about any specific domain.**
  `grep -r "nmap\|hydra\|pentest\|gobuster" src/` must return **zero results**.

- **Profile** (`profile/`): All domain-specific content — tool module YAMLs, action
  rules, workflows, glossary, scope checker data, themes, branding, and optional
  custom React views in `profile/src/`.

**This separation is non-negotiable.** Never hardcode tool names, domain concepts,
or domain-specific logic in `src/`.

## Tech Stack

| Component            | Technology                        |
|----------------------|-----------------------------------|
| Framework            | Electron (latest stable)          |
| Frontend             | React 18+ with TypeScript         |
| Build tooling        | electron-vite                     |
| Styling              | Tailwind CSS v4 + CSS custom properties |
| State management     | Zustand                           |
| Terminal emulator    | xterm.js                          |
| Database             | SQLite3 (via better-sqlite3)      |
| Module definitions   | YAML (via js-yaml)                |
| Package manager      | pnpm                              |
| Pipeline builder     | @xyflow/react (React Flow)        |
| Graph visualization  | D3.js                             |
| Testing              | Vitest + Playwright               |

## Key Conventions

### File Naming
- Engine code: kebab-case (`profile-loader.ts`, `target-store.ts`)
- React components: PascalCase (`TargetBoard.tsx`, `ToolForm.tsx`)
- Profile YAML: kebab-case (`tool-name.yaml`, `workflow-name.yaml`)

### Path Aliases
- `@main` → `src/main/`
- `@renderer` → `src/renderer/`
- `@shared` → `src/shared/`
- `@profile` → `profile/`
- `@profile-src` → `profile/src/`

### Template Variable Syntax
Use `${variable}` everywhere — in module suggestions, action rules, and workflows.
Never use bare `{variable}` (without $).

### Typography System (3-tier)
- **Display** (Outfit): App name, page titles, hero text
- **Interface** (Geist Sans): Nav labels, buttons, form labels, descriptions
- **Data/Code** (Geist Mono): IPs, ports, commands, terminal, hashes

Rule: `font-mono` = data display only. `font-sans` = UI chrome. `font-display` = headings.

### Theme System
Themes defined in `profile/manifest.yaml`. All share the same near-black backgrounds.
Only accent CSS custom properties change. Switching themes = updating CSS variables.

### IPC Pattern
- Request-response: `ipcMain.handle` / `ipcRenderer.invoke`
- Streaming (tool output): `webContents.send` / `ipcRenderer.on`
- All types defined in `src/shared/types/ipc.ts`

### Database
- One SQLite database per workspace/project
- 10 tables: targets, services, scans, vulnerabilities, credentials, web_paths,
  findings, command_history, pipelines, notes

### Routing
- Zustand-based view routing (NOT react-router-dom)
- Engine views: home, targets, target-detail, tool-form, workflow-view, workflow-run,
  pipeline-builder, history, settings
- Profile can register additional views via `manifest.yaml` `views:` section
- Navigation via `ui-store.navigate(viewId, params)`

### View Registry
- Views are auto-discovered via `import.meta.glob` from both engine and profile
- Engine views: `src/renderer/src/components/views/`
- Profile views: `profile/src/views/`
- Profile views can override engine views of the same ID
- Manifest `views:` section controls nav metadata and ordering

### Profile-Configurable Layout
Everything is configurable via `manifest.yaml`:
- Sidebar position, width, collapsibility
- Context panel position, width, sections
- Terminal position
- Status bar, title bar
- Visual effects (scanlines, glow, glitch)

## Common Mistakes to Avoid

- **Don't hardcode tool names in engine code.** The engine is generic.
- **Don't use react-router-dom.** Use the Zustand ui-store for routing.
- **Don't create separate CSS files per component.** Use Tailwind utilities.
- **Don't use `{variable}` template syntax.** Always use `${variable}`.
- **Don't use font-mono for UI chrome.** Mono = data only.
- **Don't use spinners for loading states.** Use shimmer/skeleton placeholders.
- **Don't forget error states.** Every view needs loading, empty, and error states.

## Testing

- Unit tests in `__tests__/` directories (Vitest)
- E2E tests in `e2e/` directory (Playwright)
- Test files: `<module>.test.ts`
- Focus: database CRUD, module loader, command builder, output parser, scope checker
