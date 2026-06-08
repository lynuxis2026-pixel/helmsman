#!/usr/bin/env sh
# ECC x NEXUS — unified installer (macOS / Linux)
# Builds the NEXUS binary, wires it into ECC, and (best-effort) puts both
# `nexus` and `ecc-nexus` on your PATH. Re-runnable / idempotent.
set -eu

ROOT="$(cd "$(dirname "$0")" && pwd)"
say()  { printf '%s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

say "== ECC x NEXUS installer =="

# ── prerequisites ──────────────────────────────────────────────────────
have node || { say "x Node.js >= 18 required — https://nodejs.org"; exit 1; }
have go   || { say "x Go >= 1.22 required — https://go.dev/dl/"; exit 1; }
say "+ $(node --version) | $(go version)"

# ── build NEXUS ────────────────────────────────────────────────────────
say "-> building NEXUS (go build)..."
( cd "$ROOT/nexus" && go build -o bin/nexus ./cmd/nexus )
say "+ built nexus/bin/nexus"

# ── wire NEXUS's MCP server into ECC ───────────────────────────────────
node "$ROOT/integration/bin/ecc-nexus.js" wire-mcp

# ── best-effort: put binaries on PATH ──────────────────────────────────
BIN_DIR="${HOME}/.local/bin"
mkdir -p "$BIN_DIR"
cp "$ROOT/nexus/bin/nexus" "$BIN_DIR/nexus" && say "+ installed nexus -> $BIN_DIR/nexus"
if ( cd "$ROOT" && npm link >/dev/null 2>&1 ); then
  say "+ linked ecc-nexus onto PATH (npm link)"
else
  say ". 'npm link' skipped — run it in this folder for a global ecc-nexus"
fi

# ── done ───────────────────────────────────────────────────────────────
say ""
say "Done. Next steps:"
say "  ecc-nexus add anthropic sk-ant-...   # + any providers you use"
say "  ecc-nexus code                       # Claude Code, routed through NEXUS"
say ""
node "$ROOT/integration/bin/ecc-nexus.js" env
case ":${PATH}:" in
  *":${BIN_DIR}:"*) ;;
  *) say ""; say "Note: add ${BIN_DIR} to your PATH to use 'nexus' directly." ;;
esac
