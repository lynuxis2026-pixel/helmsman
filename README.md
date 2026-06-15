<p align="center">
  <img src="assets/helmsman-banner.svg" alt="Helmsman — the harness-native operator system with a built-in routing, privacy &amp; cost layer" width="880">
</p>

<h1 align="center">Helmsman</h1>

<p align="center"><strong>The harness-native agent operator system — with a built-in local routing, privacy &amp; cost layer.</strong></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

Helmsman is a complete operator system for agentic coding, in one repo with two layers:

| Layer | What it is | Stack |
|-------|------------|-------|
| **Operator** — *what the agent does* | 416 skills, 64 agents, 84 commands, 104 rules, hooks, MCP configs and ~35 CLI tools. Works across Claude Code, Codex, Cursor, Gemini, OpenCode, Zed, Copilot. | Node.js · Python · Rust · Markdown |
| **Router** — *how the LLM calls happen* | Local-first proxy: routes Claude Code to the cheapest capable model, **redacts secrets & PII before they leave your machine**, benchmarks every provider on *your* traffic and learns routing. 30+ providers, one Go binary. | Go · Svelte · SQLite |

The operator layer decides *what* work the agent does. The router layer decides *how* every model call is made — cheaply, privately, and measurably. Together: a complete operator system whose every LLM call is local-first, redacted, cost-optimized and self-learning.

> Helmsman is built on two open-source projects; nothing was dropped — see [Credits &amp; licenses](#credits--licenses).

---

## Download

Grab a prebuilt, self-contained binary from the
[**Releases**](https://github.com/lynuxis2026-pixel/helmsman/releases) page — one
file, no build step:

| Platform | File |
|----------|------|
| Linux · x86-64 | `helmsman-linux-amd64` |
| Linux · arm64 | `helmsman-linux-arm64` |
| macOS · Intel | `helmsman-darwin-amd64` |
| macOS · Apple Silicon | `helmsman-darwin-arm64` |
| Windows · x86-64 | `helmsman-windows-amd64.exe` |

```bash
# macOS / Linux
chmod +x ./helmsman-*        # make it executable
./helmsman-* setup           # extract the operator core + wire MCP
./helmsman-* code            # Claude Code, routed through Helmsman
```

> Self-contained, but the operator half still needs **Node.js ≥ 18** (and
> **Python 3** for the dashboard) at runtime — see the note below.

---

## Single binary (self-contained)

Build **one executable** that contains everything — NEXUS natively **and** the
entire operator core baked in (extracted to `~/.helmsman` on first use):

```bash
npm run build:binary          # = node integration/build-helmsman.js   (needs Go ≥ 1.22)
# → nexus/bin/helmsman(.exe)  — a single ~60 MB file you can ship on its own
```

Then run it directly:

```bash
helmsman setup                # extract the operator core + wire the NEXUS MCP server
helmsman code                 # start NEXUS + launch Claude Code through it
helmsman operator <args...>   # run the embedded operator core (skills / agents / install)
helmsman doctor               # diagnose NEXUS + operator core
helmsman start | cost | top | bench | add <provider> <key> | mcp | env
```

> **One file — but not zero-dependency.** The **NEXUS half is fully native** (no
> runtime deps). The **operator half is Node/Python code** baked into the binary,
> so `helmsman operator` / `doctor` still need **Node.js ≥ 18** (and **Python 3**
> for the dashboard) on the machine. Making those native too would mean rewriting
> them — which would drop functionality — so they're embedded and run as-is.

---

## Quickstart (from source)

```bash
# 1) Build NEXUS and wire it into the operator core's MCP config
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

## Use it with a Claude Max plan

Prefer your **Claude Max/Pro subscription** over pay-per-token? Run Claude Code on
your subscription and use Helmsman's **operator core** to orchestrate from there.
NEXUS cost-routing is **off** in this mode — a subscription only covers Anthropic
models, so its calls can't be routed to cheaper providers.

```bash
helmsman operator install     # install the operator skills/agents into ~/.claude
claude                        # then run /login  → choose your Max/Pro subscription
helmsman max                  # launch Claude Code on the subscription, operator core loaded
```

`helmsman max` forces subscription auth by clearing `ANTHROPIC_API_KEY` and
`ANTHROPIC_BASE_URL` for the launched Claude Code — so it uses your Max login,
not an API key or the proxy.

Orchestrate many agents from there with the operator control-plane:

```bash
helmsman operator control-pane   # ecc2 control plane: many Claude sessions,
                                 # start / stop / resume, worktrees, risk view
```

> **Max vs NEXUS is either/or per session.** Max = subscription, Anthropic-only,
> flat cost (`helmsman max`). NEXUS = API key, routed to the cheapest capable
> provider (`helmsman code`). Pick per workflow.

---

## The `helmsman` bridge

One entry point spanning both projects. Run `helmsman help` for the full list.

| Command | Does |
|---------|------|
| `helmsman code [-- claude args]` | Start NEXUS (if needed) + launch Claude Code through it |
| `helmsman start` | Start the NEXUS proxy + dashboard |
| `helmsman doctor` | Run **both** the NEXUS doctor and the operator doctor |
| `helmsman cost` / `status` / `top` | NEXUS savings, provider health, live dashboard |
| `helmsman add <provider> <key>` | Register an LLM provider with NEXUS |
| `helmsman wire-mcp` | Add NEXUS's savings MCP server to `operator/.mcp.json` |
| `helmsman env [port]` | Print the env lines to route Claude Code through NEXUS |
| `helmsman install <stack...>` | Run the operator installer for a stack/harness, then wire MCP |
| `helmsman nexus <args...>` | Pass-through to the raw NEXUS binary |
| `helmsman operator <args...>` | Pass-through to the raw operator CLI |

Every original command of **both** tools remains available — directly (`operator`, `nexus`) and via the pass-throughs above.

---

## How they're wired together

1. **Routing** — `ANTHROPIC_BASE_URL=http://localhost:3000` points Claude Code (the engine the operator core drives) at NEXUS. Run `helmsman env` to print the exact lines. NEXUS then routes, caches, redacts and cost-optimizes every call the operator's agents make.
2. **MCP** — NEXUS ships a stdio MCP server (`nexus mcp`) exposing live usage/savings. It is registered in [`operator/.mcp.json`](operator/.mcp.json) as the **`nexus`** server, so any operator-driven harness can ask *"how much have I saved today?"*.
3. **Unified ops** — `helmsman doctor` runs both diagnostic suites; the unified installer sets up both stacks; `.env.example` carries both projects' variables.

```
        ┌─────────────────────────────────────────────┐
        │  Operator — skills · agents · rules · commands│   what the agent does
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
├── operator/       ← the operator core (based on affaan-m/ECC, MIT), unchanged in function
├── nexus/          ← NEXUS, the local router (Apache-2.0), unchanged in function
├── integration/    ← the glue: bridge CLI + integration docs
│   └── bin/helmsman.js
├── package.json    ← root manifest, exposes the `helmsman` bin + npm scripts
├── install.sh / install.ps1   ← unified installers (build NEXUS, wire the operator core)
├── .env.example    ← combined environment template
├── CHANGELOG.md    ← combined changelog
└── LICENSES.md     ← operator core = MIT · NEXUS = Apache-2.0 · glue = MIT
```

For each project's own deep docs, see [`operator/README.md`](operator/README.md) and [`nexus/README.md`](nexus/README.md).

---

## Requirements

- **Node.js ≥ 18** (operator core + the bridge)
- **Go ≥ 1.22** (to build the NEXUS binary)
- Optional: **Python 3** (operator dashboard), **Rust/Cargo** (the bundled Rust subproject)

---

## Credits & licenses

**Helmsman is released under the [MIT License](LICENSE).** It builds on two open-source projects, kept here in full with their own licenses and copyright notices intact (operator core = MIT; NEXUS = Apache-2.0):

| Project | Source | Commit | Version | License |
|---------|--------|--------|---------|---------|
| Operator core | https://github.com/affaan-m/ECC | `90dfd9505dc860714cf3cc8216ad7bbb96d93365` | 2.0.0-rc.1 | MIT |
| NEXUS | https://github.com/lynuxis2026-pixel/nexus-proxy | `e5332ff71eb6670409301817eba13c26b8d1259a` | — | Apache-2.0 |

The nested `.git` directories were removed so this is one coherent repository. No source files of either project were modified except `operator/.mcp.json` (one added MCP server entry, documented above). See [LICENSES.md](LICENSES.md) and [integration/README.md](integration/README.md) for details.
