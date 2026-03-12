# Praxis

**Universal CLI workflow orchestration platform.**

Praxis (Greek: *praxis* — action, practice) is a desktop application framework for building guided CLI tool workflows. It provides the engine — target management, tool execution, dynamic forms, workflow orchestration, pipeline building, and educational overlays — while all domain knowledge lives in a swappable **profile**.

```
    ____                  _
   / __ \_________ __  __(_)____
  / /_/ / ___/ __ `/ |/_/ / ___/
 / ____/ /  / /_/ />  </ (__  )
/_/   /_/   \__,_/_/|_/_/____/
```

## What is a Profile?

A profile is a `profile/` directory that turns Praxis into a domain-specific app. It contains:

- **`manifest.yaml`** — App identity, themes, categories, layout config, target types
- **`modules/`** — YAML definitions for CLI tools (args, parsers, suggestions)
- **`actions/`** — Context-aware action rules (condition → suggested actions)
- **`workflows/`** — Multi-step automated tool chains
- **`glossary/`** — Domain term definitions for educational overlays
- **`scope/`** — Safety-check data (e.g., cloud provider IP ranges)
- **`src/`** — Profile-specific React views, stores, and components

Swap the `profile/` directory and you have a completely different app.

### Example Profiles

| Profile | Domain | What it does |
|---------|--------|-------------|
| [Aeth0n](https://github.com/Mischa-dev/Aeth0n) | Penetration Testing | 72+ security tools, attack path viz, credential store |
| *(yours here)* | OSINT / Forensics / DevOps / ... | Whatever CLI tools your domain needs |

## Architecture

```
src/
  main/           # Electron main process (IPC, database, process manager)
  renderer/       # React frontend (views, stores, components, layout)
  shared/         # Types and schemas shared between main/renderer
  preload/        # Electron preload bridge

profile/          # Domain-specific content (YAML + optional React code)
  manifest.yaml   # App identity and configuration
  modules/        # Tool definitions
  actions/        # Contextual action rules
  workflows/      # Automated multi-tool flows
  src/            # Profile-specific React views and stores
```

### Engine vs Profile — The Core Rule

The engine (`src/`) is **completely domain-agnostic**. It knows how to load YAML modules, generate forms, execute processes, parse output, manage targets, and run workflows. It knows *nothing* about what tools exist or what domain it serves.

All domain knowledge lives in `profile/`. This separation is enforced:

```bash
# This must always return zero results:
grep -r "nmap\|hydra\|pentest\|gobuster" src/
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Electron |
| Frontend | React 18 + TypeScript |
| Build | electron-vite |
| Styling | Tailwind CSS v4 + CSS custom properties |
| State | Zustand |
| Terminal | xterm.js |
| Database | SQLite (better-sqlite3) |
| Modules | YAML (js-yaml) |
| Pipeline Builder | @xyflow/react |
| Graphs | D3.js |
| Package Manager | pnpm |

## Quick Start

```bash
# Clone the repo
git clone https://github.com/Mischa-dev/Praxis.git
cd Praxis

# Install dependencies
pnpm install

# Development mode
pnpm dev

# Production build
pnpm build
```

To use a specific profile (e.g., Aeth0n for pentesting):

```bash
# Remove the default profile
rm -rf profile/

# Clone the profile into the profile/ directory
git clone https://github.com/Mischa-dev/Aeth0n.git profile/
```

## Creating a Profile

See [`docs/PROFILE-AUTHORING.md`](docs/PROFILE-AUTHORING.md) for a complete guide to creating your own profile.

At minimum, you need:

1. A `manifest.yaml` with app identity, themes, and target types
2. At least one module YAML in `modules/` defining a CLI tool
3. Categories in the manifest matching your module categories

## Key Features

- **Target-centric workflow** — Everything revolves around targets (IPs, domains, URLs)
- **Dynamic tool forms** — Auto-generated from YAML module definitions
- **Command preview** — See exactly what will run before executing
- **Output parsing** — Structured extraction from tool output (regex, JSON, XML)
- **Action engine** — Context-aware suggestions based on discovered data
- **Workflow orchestration** — Multi-step automated tool chains
- **Pipeline builder** — Visual drag-and-drop tool chaining
- **Educational overlays** — Explain what tools do and what findings mean
- **Scope protection** — Warn before targeting cloud providers or out-of-scope hosts
- **Profile-driven everything** — Views, navigation, layout, effects, themes, branding

## Design System

Praxis uses a 3-tier typography system:

| Tier | Font | Use |
|------|------|-----|
| Display | Outfit | App name, page titles |
| Interface | Geist Sans | Nav labels, buttons, descriptions |
| Data/Code | Geist Mono | IPs, ports, commands, terminal output |

4 theme slots configured per-profile via CSS custom properties. Switching themes changes accent colors without recompiling.

## License

MIT
