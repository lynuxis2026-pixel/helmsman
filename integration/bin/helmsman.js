#!/usr/bin/env node
'use strict';

/*
 * helmsman — the unified bridge CLI for the Helmsman monorepo.
 *
 *   operator/ = the harness-native agent operator system (skills, agents,
 *               rules, commands, hooks, MCP configs).  Node.js / Python / Rust.
 *   nexus/    = NEXUS, a local proxy that routes Claude Code to the cheapest
 *               capable model, redacts secrets & PII before they leave the
 *               machine, benchmarks every provider on your own traffic and
 *               learns routing.  Go.
 *
 * This bridge makes NEXUS the routing / privacy / cost layer underneath the
 * operator core: one entry point to run NEXUS, a combined `doctor`, MCP wiring
 * and the env wiring that points Claude Code (and every operator-driven agent)
 * through NEXUS.
 *
 * CommonJS, Node >= 18, zero runtime dependencies.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..'); // monorepo root
const OPERATOR_DIR = path.join(ROOT, 'operator');
const NEXUS_DIR = path.join(ROOT, 'nexus');
const IS_WIN = process.platform === 'win32';
const EXE = IS_WIN ? '.exe' : '';

function onPath(bin) {
  const r = spawnSync(IS_WIN ? 'where' : 'which', [bin], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const first = (r.stdout || '').split(/\r?\n/).filter(Boolean)[0];
  return first && fs.existsSync(first) ? first : (first || null);
}

// ---- locate / build the nexus binary ------------------------------------
function nexusBinaryPath() {
  const local = path.join(NEXUS_DIR, 'bin', 'nexus' + EXE);
  if (fs.existsSync(local)) return local;
  return onPath('nexus');
}

function buildNexus() {
  if (!onPath('go')) {
    console.error('x Go toolchain not found. Install Go >= 1.22: https://go.dev/dl/');
    return false;
  }
  const out = path.join(NEXUS_DIR, 'bin', 'nexus' + EXE);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  console.error('-> Building NEXUS from ./nexus (go build)...');
  const r = spawnSync('go', ['build', '-o', out, './cmd/nexus'], {
    cwd: NEXUS_DIR,
    stdio: 'inherit',
  });
  if (r.status === 0) {
    console.error('+ Built ' + path.relative(ROOT, out));
    return true;
  }
  console.error('x NEXUS build failed.');
  return false;
}

function ensureNexus() {
  let bin = nexusBinaryPath();
  if (bin) return bin;
  console.error('. NEXUS binary not found — building it now.');
  if (!buildNexus()) return null;
  return nexusBinaryPath();
}

// ---- runners ------------------------------------------------------------
function runNexus(args) {
  const bin = ensureNexus();
  if (!bin) return 1;
  return spawnSync(bin, args, { stdio: 'inherit' }).status ?? 1;
}

function runOperatorCli(args) {
  const cli = path.join(OPERATOR_DIR, 'scripts', 'ecc.js');
  if (!fs.existsSync(cli)) {
    console.error('x operator CLI not found at ' + path.relative(ROOT, cli));
    return 1;
  }
  return spawnSync(process.execPath, [cli, ...args], {
    stdio: 'inherit',
    cwd: OPERATOR_DIR,
  }).status ?? 1;
}

function runOperatorScript(script, args) {
  const p = path.join(OPERATOR_DIR, 'scripts', script);
  if (!fs.existsSync(p)) {
    console.error('x operator script not found: ' + path.relative(ROOT, p));
    return 1;
  }
  return spawnSync(process.execPath, [p, ...(args || [])], {
    stdio: 'inherit',
    cwd: OPERATOR_DIR,
  }).status ?? 1;
}

// ---- MCP wiring ---------------------------------------------------------
// Adds NEXUS's stdio savings/usage MCP server to the operator core's .mcp.json
// so any operator-driven harness can ask "how much have I saved today?".
function wireMcp() {
  const mcpFile = path.join(OPERATOR_DIR, '.mcp.json');
  let json;
  try {
    json = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
  } catch (e) {
    console.error('x cannot read operator/.mcp.json: ' + e.message);
    return 1;
  }
  json.mcpServers = json.mcpServers || {};
  json.mcpServers.nexus = { command: 'nexus', args: ['mcp'] };
  fs.writeFileSync(mcpFile, JSON.stringify(json, null, 2) + '\n');
  console.error('+ Wired NEXUS savings MCP server into operator/.mcp.json (server "nexus").');
  return 0;
}

// ---- env wiring ---------------------------------------------------------
function printEnv(portArg) {
  const port = Number(portArg) || 3000;
  console.log('# Route Claude Code (and every operator-driven agent) through NEXUS.');
  console.log('# bash / zsh:');
  console.log('  export ANTHROPIC_BASE_URL=http://localhost:' + port);
  console.log('  export ANTHROPIC_API_KEY=nexus-local');
  console.log('# PowerShell:');
  console.log('  $env:ANTHROPIC_BASE_URL = "http://localhost:' + port + '"');
  console.log('  $env:ANTHROPIC_API_KEY  = "nexus-local"');
}

// ---- combined doctor ----------------------------------------------------
function doctor() {
  let ok = 0;
  console.log('\n=== NEXUS doctor =======================================');
  ok |= runNexus(['doctor']);
  console.log('\n=== Operator doctor ====================================');
  // The operator core ships scripts/doctor.js; fall back to its CLI doctor.
  if (fs.existsSync(path.join(OPERATOR_DIR, 'scripts', 'doctor.js'))) {
    ok |= runOperatorScript('doctor.js', []);
  } else {
    ok |= runOperatorCli(['doctor']);
  }
  return ok ? 1 : 0;
}

function help() {
  console.log(`Helmsman — unified bridge

  operator = agent operator system (skills, agents, rules, commands, MCP)
  NEXUS    = local proxy: routes Claude Code to the cheapest capable model,
             redacts secrets/PII before they leave your machine, benchmarks &
             learns routing. NEXUS is the operator's routing / privacy / cost layer.

USAGE
  helmsman <command> [args]

EVERYDAY
  code [-- claude args]    Start NEXUS (if needed) + launch Claude Code through it
  start [-p 3000 -u 2222]  Start the NEXUS proxy + dashboard (foreground)
  status                   Provider health
  cost                     Cost / savings breakdown
  top                      Live terminal dashboard
  doctor                   Run BOTH the NEXUS doctor and the operator doctor

SETUP / WIRING
  build                    Build the NEXUS binary from ./nexus (go build)
  add <provider> <key>     Add an LLM provider to NEXUS
  wire-mcp                 Add NEXUS's savings MCP server to operator/.mcp.json
  env [port]               Print env lines to route Claude Code through NEXUS
  install <stack...>       Run the operator installer for a stack/harness, then wire MCP

PASS-THROUGH
  nexus    <args...>       Run the NEXUS binary directly (any nexus subcommand)
  operator <args...>       Run the operator CLI directly (any operator subcommand)

DOCS
  ./README.md  ·  Operator: ./operator/README.md  ·  NEXUS: ./nexus/README.md`);
}

// ---- dispatch -----------------------------------------------------------
function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case undefined:
    case 'help':
    case '-h':
    case '--help':
      help();
      return 0;

    // everyday — forwarded to NEXUS
    case 'code':
    case 'start':
    case 'status':
    case 'cost':
    case 'top':
    case 'add':
    case 'bench':
    case 'logs':
    case 'models':
      return runNexus([cmd, ...rest]);

    // setup / wiring
    case 'build':
      return buildNexus() ? 0 : 1;
    case 'wire-mcp':
      return wireMcp();
    case 'env':
      printEnv(rest[0]);
      return 0;
    case 'doctor':
      return doctor();
    case 'install': {
      const s = runOperatorCli(rest);
      wireMcp();
      return s;
    }

    // pass-through
    case 'nexus':
      return runNexus(rest);
    case 'operator':
      return runOperatorCli(rest);

    default:
      console.error('Unknown command: ' + cmd + '\n');
      help();
      return 2;
  }
}

process.exit(main());
