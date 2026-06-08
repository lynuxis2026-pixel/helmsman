#!/usr/bin/env pwsh
# ECC x NEXUS — unified installer (Windows / PowerShell)
# Builds the NEXUS binary, wires it into ECC, and (best-effort) links
# `ecc-nexus` onto your PATH. Re-runnable / idempotent.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Have($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }

Write-Host "== ECC x NEXUS installer =="

# ── prerequisites ──────────────────────────────────────────────────────
if (-not (Have node)) { Write-Host "x Node.js >= 18 required - https://nodejs.org"; exit 1 }
if (-not (Have go))   { Write-Host "x Go >= 1.22 required - https://go.dev/dl/";    exit 1 }
Write-Host "+ $(node --version) | $(go version)"

# ── build NEXUS ────────────────────────────────────────────────────────
Write-Host "-> building NEXUS (go build)..."
Push-Location "$Root\nexus"
try { go build -o "bin\nexus.exe" ".\cmd\nexus" } finally { Pop-Location }
Write-Host "+ built nexus\bin\nexus.exe"

# ── wire NEXUS's MCP server into ECC ───────────────────────────────────
node "$Root\integration\bin\ecc-nexus.js" wire-mcp

# ── best-effort: link ecc-nexus onto PATH ──────────────────────────────
try {
  Push-Location $Root
  npm link | Out-Null
  Pop-Location
  Write-Host "+ linked ecc-nexus onto PATH (npm link)"
} catch {
  Write-Host ". 'npm link' skipped - run it in this folder for a global ecc-nexus"
}

# ── done ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Done. Next steps:"
Write-Host "  ecc-nexus add anthropic sk-ant-...   # + any providers you use"
Write-Host "  ecc-nexus code                       # Claude Code, routed through NEXUS"
Write-Host ""
node "$Root\integration\bin\ecc-nexus.js" env
