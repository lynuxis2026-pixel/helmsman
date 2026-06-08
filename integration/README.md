# Integration layer

This directory is the **only net-new code** in the monorepo. Everything else
under `operator/` and `nexus/` is the upstream projects, vendored in full.

## What's here

| Path | Purpose |
|------|---------|
| `bin/helmsman.js` | The unified bridge CLI. CommonJS, Node ≥ 18, zero deps (matches the operator core's conventions). Locates/builds the NEXUS binary, forwards everyday commands to it, runs a combined `doctor`, and performs MCP + env wiring. |

The bridge is intentionally thin: it **orchestrates** the two projects rather
than reimplementing either, which is what keeps "every function of both" intact.

## The three wiring points

1. **Routing (env).** NEXUS is an Anthropic-compatible proxy on `:3000`. Setting
   `ANTHROPIC_BASE_URL=http://localhost:3000` + `ANTHROPIC_API_KEY=nexus-local`
   makes Claude Code — the engine the operator core drives — send every request through NEXUS.
   `helmsman env` prints the exact bash/PowerShell lines.

2. **MCP.** NEXUS exposes a stdio JSON-RPC MCP server via `nexus mcp` that answers
   usage/savings queries. `helmsman wire-mcp` (also run by `npm run setup`) adds it
   to `operator/.mcp.json` as the `nexus` server. It ships pre-wired in this repo.

3. **Unified ops.** `helmsman doctor` runs `nexus doctor` **and** the operator
   core's `scripts/doctor.js`; `install.sh` / `install.ps1` build NEXUS and wire the
   operator core in one pass; the root `.env.example` carries both projects' variables.

## Binary resolution

`helmsman` finds the NEXUS binary in this order:

1. `nexus/bin/nexus` (the vendored build produced by `helmsman build`)
2. `nexus` on your `PATH` (e.g. after the unified installer)

If neither exists it builds from `./nexus` with `go build` automatically.

## Why a bridge instead of a rewrite

The operator core is a Node/Python/Rust system; NEXUS is a Go networking daemon.
Rewriting either into the other's stack would inevitably drop functions — the one
thing this combination must not do. A thin orchestration layer preserves 100% of
both feature sets while still making them act as one product.

## Credits

- **Operator core** — based on https://github.com/affaan-m/ECC @ `90dfd9505dc860714cf3cc8216ad7bbb96d93365` (v2.0.0-rc.1, MIT) — © 2026 Affaan Mustafa
- **NEXUS** — https://github.com/lynuxis2026-pixel/nexus-proxy @ `e5332ff71eb6670409301817eba13c26b8d1259a` (Apache-2.0)

Nested `.git` directories were removed during vendoring. The only upstream file
changed is `operator/.mcp.json` (one added server entry).
