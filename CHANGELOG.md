# Changelog — Helmsman

This is the changelog for the **combined monorepo**. Each project keeps its own
detailed history: [`operator/CHANGELOG.md`](operator/CHANGELOG.md) and
[`nexus/CHANGELOG.md`](nexus/CHANGELOG.md).

## [1.0.0] — Initial combination

Combined two upstream projects into one wired monorepo, preserving 100% of both
feature sets.

**Vendored (unchanged in function):**
- **Operator core** — based on `affaan-m/ECC` @ `90dfd9505dc860714cf3cc8216ad7bbb96d93365` (v2.0.0-rc.1, MIT).
  All 416 skills, 64 agents, 84 commands, 104 rules, hooks, MCP configs, the
  Node CLI tooling, the Python dashboard and the bundled Rust subproject.
- **NEXUS** — `lynuxis2026-pixel/nexus-proxy` @ `e5332ff71eb6670409301817eba13c26b8d1259a` (Apache-2.0).
  The Go proxy with firewall/redaction, router/classifier, cache, cascade,
  semantic matching, benchmarking, SQLite storage, embedded Svelte dashboard and
  all 30+ providers.

**Added (integration layer):**
- `integration/bin/helmsman.js` — unified bridge CLI spanning both projects
  (everyday NEXUS commands, combined `doctor`, MCP + env wiring, pass-throughs).
- Root `package.json` exposing the `helmsman` bin and `npm run setup` / `doctor`
  / `start` / `code` scripts.
- `install.sh` + `install.ps1` — unified installers (build NEXUS, wire the operator core).
- `README.md`, `integration/README.md`, `LICENSES.md`, `.env.example`,
  `.gitignore` — combined docs and config.

**Changed (upstream):**
- `operator/.mcp.json` — added one MCP server entry (`nexus` → `nexus mcp`) so
  operator-driven harnesses can query live NEXUS savings/usage. No other upstream
  source files were modified.

**Removed:**
- The nested `.git` directories of both clones (vendored into one repository).
