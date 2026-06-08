#!/usr/bin/env pwsh
# Helmsman — unified installer (Windows / PowerShell)
# Builds the NEXUS binary, wires it into the operator core, and (best-effort) links
# `helmsman` onto your PATH. Re-runnable / idempotent.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Have($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }

Write-Host "== Helmsman installer =="

# ── prerequisites ──────────────────────────────────────────────────────
if (-not (Have node)) { Write-Host "x Node.js >= 18 required - https://nodejs.org"; exit 1 }
if (-not (Have go))   { Write-Host "x Go >= 1.22 required - https://go.dev/dl/";    exit 1 }
Write-Host "+ $(node --version) | $(go version)"

# ── build NEXUS ────────────────────────────────────────────────────────
Write-Host "-> building NEXUS (go build)..."
Push-Location "$Root\nexus"
try { go build -o "bin\nexus.exe" ".\cmd\nexus" } finally { Pop-Location }
Write-Host "+ built nexus\bin\nexus.exe"

# ── wire NEXUS's MCP server into the operator core ───────────────────────────────────
node "$Root\integration\bin\helmsman.js" wire-mcp

# ── best-effort: link helmsman onto PATH ──────────────────────────────
try {
  Push-Location $Root
  npm link | Out-Null
  Pop-Location
  Write-Host "+ linked helmsman onto PATH (npm link)"
} catch {
  Write-Host ". 'npm link' skipped - run it in this folder for a global helmsman"
}

# ── done ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Done. Next steps:"
Write-Host "  helmsman add anthropic sk-ant-...   # + any providers you use"
Write-Host "  helmsman code                       # Claude Code, routed through NEXUS"
Write-Host ""
node "$Root\integration\bin\helmsman.js" env
