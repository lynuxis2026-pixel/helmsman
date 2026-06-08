# Helmsman

**The harness-native agent operator system — with a built-in local routing, privacy & cost layer.**

**Helmsman** is a **monorepo that combines two projects in full**, wired together — **ECC** (the operator system) and **NEXUS** (the local routing/privacy/cost proxy):

| Layer | Project | What it is | Stack |
|-------|---------|------------|-------|
| **Operator** — *what the agent does* | [**ECC**](ecc/README.md) (`affaan-m/ECC`) | Harness-native operator system: 416 skills, 64 agents, 84 commands, 104 rules, hooks, MCP configs and ~35 CLI tools. Works across Claude Code, Codex, Cursor, Gemini, OpenCode, Zed, Copilot. | Node.js · Python · Rust · Markdown |
| **Transport** — *how the LLM calls happen* | [**NEXUS**](nexus/README.md) (`lynuxis2026-pixel/nexus-proxy`) | Local-first proxy: routes Claude Code to the cheapest capable model, **redacts secrets & PII before they leave your machine**, benchmarks every provider on *your* traffic and learns routing. 30+ providers, one Go binary. | Go · Svelte · SQLite |

ECC decides *what* work the agent does. NEXUS decides *how* every model call is routed — cheaply, privately, and measurably. Together: a complete operator system whose every LLM call is local-first, redacted, cost-optimized and self-learning.

> **Nothing was dropped.** Both upstream codebases are vendored here in their entirety — every skill, agent, rule, command, provider and function. The only additions are the integration layer (this README, the `helmsman` bridge CLI, the unified installer and the MCP/env wiring). See [Provenance](#provenance).

---

## Quickstart

```bash
# 1) Build NEXUS and wire it into ECC's MCP config
npm run setup            # = helmsman build  +  helmsman wire-mcp
                         #   (requires Go >= 1.22 and Node >= 18)

# 2) Launch Claude Code routed through NEXUS, in one command
node integration/bin/helmsman.js code
#   ↑ starts the NEXUS proxy (:3000) + dashboard (:2222) if needed,
#     then launches Claude Code wired through it.

# 3) Add the providers you want NEXUS to route to
node integration/bin/helmsman.js add groq      gsk_...
node integration/bin/helmsman.js add deepseek  sk-...
node integration/bin/helmsman.js add anthropic sk-ant-...   # for premium calls
```

Install globally so `helmsman` is on your PATH:

```bash
npm link          # then just:  helmsman code
# or run the unified installer:
./install.sh      # macOS/Linux
./install.ps1     # Windows (PowerShell)
```

---

## The `helmsman` bridge

One entry point spanning both projects. Run `helmsman help` for the full list.

| Command | Does |
|---------|------|
| `helmsman code [-- claude args]` | Start NEXUS (if needed) + launch Claude Code through it |
| `helmsman start` | Start the NEXUS proxy + dashboard |
| `helmsman doctor` | Run **both** the NEXUS doctor and the ECC doctor |
| `helmsman cost` / `status` / `top` | NEXUS savings, provider health, live dashboard |
| `helmsman add <provider> <key>` | Register an LLM provider with NEXUS |
| `helmsman wire-mcp` | Add NEXUS's savings MCP server to `ecc/.mcp.json` |
| `helmsman env [port]` | Print the env lines to route Claude Code through NEXUS |
| `helmsman install <stack...>` | Run the ECC installer for a stack/harness, then wire MCP |
| `helmsman nexus <args...>` | Pass-through to the raw NEXUS binary |
| `helmsman ecc <args...>` | Pass-through to the raw ECC CLI |

Every original command of **both** tools remains available — directly (`ecc`, `nexus`) and via the pass-throughs above.

---

## How they're wired together

1. **Routing** — `ANTHROPIC_BASE_URL=http://localhost:3000` points Claude Code (the engine ECC drives) at NEXUS. Run `helmsman env` to print the exact lines. NEXUS then routes, caches, redacts and cost-optimizes every call ECC's agents make.
2. **MCP** — NEXUS ships a stdio MCP server (`nexus mcp`) exposing live usage/savings. It is registered in [`ecc/.mcp.json`](ecc/.mcp.json) as the **`nexus`** server, so any ECC-driven harness can ask *"how much have I saved today?"*.
3. **Unified ops** — `helmsman doctor` runs both diagnostic suites; the unified installer sets up both stacks; `.env.example` carries both projects' variables.

```
        ┌─────────────────────────────────────────────┐
        │  ECC  — skills · agents · rules · commands    │   what the agent does
        │        hooks · MCP configs · CLI tooling      │
        └───────────────────────┬─────────────────────┘
                                │  ANTHROPIC_BASE_URL → :3000
                                ▼
        ┌─────────────────────────────────────────────┐
        │  NEXUS — firewall (redact) · router · cache   │   how calls are made
        │          cascade · benchmark · 30+ providers  │   (cheap · private · learned)
        └─────────────────────────────────────────────┘
```

---

## Repository layout

```
.
├── ecc/            ← full ECC project (affaan-m/ECC), unchanged in function
├── nexus/          ← full NEXUS project (lynuxis2026-pixel/nexus-proxy), unchanged in function
├── integration/    ← the glue: bridge CLI + integration docs
│   └── bin/helmsman.js
├── package.json    ← root manifest, exposes the `helmsman` bin + npm scripts
├── install.sh / install.ps1   ← unified installers (build NEXUS, wire ECC)
├── .env.example    ← combined environment template
├── CHANGELOG.md    ← combined changelog
└── LICENSES.md     ← ECC = MIT · NEXUS = Apache-2.0 · glue = MIT
```

For each project's own deep docs, see [`ecc/README.md`](ecc/README.md) and [`nexus/README.md`](nexus/README.md).

---

## Requirements

- **Node.js ≥ 18** (ECC + the bridge)
- **Go ≥ 1.22** (to build the NEXUS binary)
- Optional: **Python 3** (ECC dashboard), **Rust/Cargo** (ECC's `ecc2` subproject)

---

## Provenance

This monorepo vendors both upstream repositories at these commits:

| Project | Source | Commit | Version | License |
|---------|--------|--------|---------|---------|
| ECC | https://github.com/affaan-m/ECC | `90dfd9505dc860714cf3cc8216ad7bbb96d93365` | 2.0.0-rc.1 | MIT |
| NEXUS | https://github.com/lynuxis2026-pixel/nexus-proxy | `e5332ff71eb6670409301817eba13c26b8d1259a` | — | Apache-2.0 |

The nested `.git` directories were removed so this is one coherent repository. No source files of either project were modified except `ecc/.mcp.json` (one added MCP server entry, documented above). See [LICENSES.md](LICENSES.md) and [integration/README.md](integration/README.md) for details.
