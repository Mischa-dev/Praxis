# Praxis

**Visual CLI workflow automation platform — n8n for the terminal.**

Praxis is a desktop + CLI application for building visual node-based pipelines that chain CLI commands with control flow, interactive prompts, variables, and output capture. Build workflows in a drag-and-drop GUI, then run them headlessly from the terminal.

All domain knowledge — entity schemas, tool definitions, action rules, workflows, and branding — lives in a swappable **profile** directory. Swap `profile/`, rebuild, and you have a completely different app.

```
    ____                  _
   / __ \_________ __  __(_)____
  / /_/ / ___/ __ `/ |/_/ / ___/
 / ____/ /  / /_/ />  </ (__  )
/_/   /_/   \__,_/_/|_/_/____/
```

## Quick Start

```bash
git clone https://github.com/Mischa-dev/Praxis.git
cd Praxis
pnpm install

# GUI (Electron app with visual pipeline builder)
pnpm dev

# CLI (headless pipeline execution)
pnpm build:cli
node out/cli-bundle.js --help
```

## Pipeline Node Types

Pipelines are directed acyclic graphs of nodes executed in topological order:

| Node | What it does |
|------|-------------|
| **Start** | Entry point — optionally selects a target entity |
| **Shell Command** | Runs any shell command (`child_process.exec`) |
| **Tool** | Executes a profile-defined CLI tool module |
| **User Prompt** | Pauses for user input (GUI dialog or CLI readline) |
| **Set Variable** | Assigns a value to a pipeline variable |
| **Condition** | Evaluates an expression, routes to true/false branches |
| **For Each** | Iterates over an array, executing body nodes per item |
| **Delay** | Pauses execution for N seconds |
| **Note** | Canvas annotation (no-op) |

Shell and tool nodes support **output capture** into variables with modes: `full`, `last_line`, `regex`, `json`.

### Template Expressions

Node configs support `${...}` template expressions:

```
${vars.greeting}                    # Pipeline variable
${target.value}                     # Entity field
${nodes.shell-1.output}             # Prior node's stdout
${nodes.scan.results.services}      # Parsed results

${vars.name | upper}                # Pipe functions
${vars.list | join(',')}            # Array → string
${vars.count | > 5}                 # Comparison → boolean

${expr1 && expr2 || !expr3}         # Compound conditions
```

Pipe functions: `trim`, `upper`, `lower`, `split`, `replace`, `join`, `count`, `first`, `pluck`, `unique`, `where`, `length`, `toNumber`, `toString`, `toBool`, `exists`, `default`, `startsWith`, `endsWith`, `contains`, `matches`.

## CLI

```bash
node out/cli-bundle.js list                              # List saved pipelines
node out/cli-bundle.js run "My Pipeline"                 # Execute a pipeline
node out/cli-bundle.js run "My Pipeline" --dry-run       # Preview without executing
node out/cli-bundle.js run "My Pipeline" --var key=val   # Pre-set variables
node out/cli-bundle.js --data-dir <path> list            # Custom data directory
```

The CLI shares the same engine code as the GUI. User prompts render as readline questions instead of modal dialogs. Pipeline output shows ANSI-colored node status updates.

## What is a Profile?

A profile is a `profile/` directory that turns Praxis into a domain-specific app:

- **`manifest.yaml`** — App identity, themes, categories, layout, effects
- **`schema.yaml`** — Entity data model (optional — pipelines work without it)
- **`modules/`** — YAML definitions for CLI tools (args, parsers, suggestions)
- **`actions/`** — Context-aware action rules (condition → suggested actions)
- **`workflows/`** — Multi-step automated tool chains
- **`glossary/`** — Domain term definitions for educational overlays
- **`scope/`** — Safety-check data (e.g., cloud provider IP ranges)
- **`src/`** — Profile-specific React views, stores, and components

### Example Profiles

| Profile | Domain | What it does |
|---------|--------|-------------|
| [Aeth0n](https://github.com/Mischa-dev/Aeth0n) | Penetration Testing | 72+ security tools, attack path viz, credential store |
| *(yours here)* | OSINT / Forensics / DevOps / ... | Whatever CLI tools your domain needs |

## Architecture

```
src/
  main/           # Electron main process (engines, IPC, database)
  renderer/       # React frontend (pipeline builder, views, stores)
  shared/         # Types and schemas shared between main/renderer
  preload/        # Electron preload bridge (IPC channel whitelist)
  cli/            # Headless CLI entry point

profile/          # Domain-specific content (YAML + optional React code)
```

### Engine vs Profile — The Core Rule

The engine (`src/`) is **completely domain-agnostic**. It knows how to load YAML modules, generate forms, execute processes, parse output, manage entities, and run pipelines. It knows *nothing* about what tools exist or what domain it serves.

```bash
# This must always return zero results:
grep -r "nmap\|hydra\|pentest\|gobuster" src/
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Electron + headless Node.js CLI |
| Frontend | React 18 + TypeScript |
| Build | electron-vite (GUI), esbuild (CLI) |
| Styling | Tailwind CSS v4 + CSS custom properties |
| State | Zustand |
| Terminal | xterm.js |
| Database | SQLite (better-sqlite3) |
| Modules | YAML (js-yaml) |
| Pipeline Builder | @xyflow/react |
| Graphs | D3.js |
| Package Manager | pnpm |

## Key Features

- **Visual pipeline builder** — Drag-and-drop node-based workflow design
- **Headless CLI execution** — Run pipelines from the terminal without the GUI
- **Shell command nodes** — Run arbitrary commands with output capture
- **Interactive prompts** — Pause for user input (GUI dialog or CLI readline)
- **Variable system** — Pass data between nodes via `${vars.*}` expressions
- **Output capture** — Extract values from stdout (full, last line, regex, JSON)
- **Expression language** — 20+ pipe functions, compound conditions, type coercion
- **Dynamic tool forms** — Auto-generated from YAML module definitions
- **Output parsing** — Structured extraction from tool output (regex, JSON, XML)
- **Action engine** — Context-aware suggestions based on discovered data
- **Entity system** — Optional profile-defined data model (schema-driven database, CRUD, UI)
- **Educational overlays** — Explain what tools do and what findings mean
- **Profile-driven everything** — Views, navigation, layout, effects, themes, branding

## Design System

| Tier | Font | Use |
|------|------|-----|
| Display | Outfit | App name, page titles |
| Interface | Geist Sans | Nav labels, buttons, descriptions |
| Data/Code | Geist Mono | IPs, ports, commands, terminal output |

4 theme slots configured per-profile via CSS custom properties. Switching themes changes accent colors without recompiling.

## License

MIT
