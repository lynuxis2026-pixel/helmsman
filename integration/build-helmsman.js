#!/usr/bin/env node
'use strict';

/*
 * build-helmsman.js — build the single, self-contained `helmsman` binary.
 *
 * The operator core (operator/) is copied into nexus/internal/operatorfs/data,
 * baked into the Go binary via go:embed, then the staging copy is cleaned away.
 * The result is ONE executable that contains NEXUS natively + the whole operator
 * core embedded (extracted to ~/.helmsman on first use).
 *
 * Requires: Go >= 1.22.  (Node/Python are needed at RUNTIME for the operator
 * half, because that code is Node/Python — they are not needed to build.)
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OPERATOR = path.join(ROOT, 'operator');
const NEXUS = path.join(ROOT, 'nexus');
const DATA = path.join(NEXUS, 'internal', 'operatorfs', 'data');
const IS_WIN = process.platform === 'win32';
const OUT = path.join(NEXUS, 'bin', 'helmsman' + (IS_WIN ? '.exe' : ''));

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) n += copyDir(s, d);
    else if (e.isFile()) { fs.copyFileSync(s, d); n++; }
  }
  return n;
}

function resetData() {
  rmrf(DATA);
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(
    path.join(DATA, '.gitkeep'),
    '# Placeholder so `go:embed all:data` compiles on a fresh checkout.\n' +
      '# The real operator core is copied in here at build time by\n' +
      '# integration/build-helmsman.js, embedded, then cleaned away again.\n'
  );
}

if (!fs.existsSync(path.join(OPERATOR, 'scripts', 'ecc.js'))) {
  console.error('x operator/ not found (expected the operator core at ./operator).');
  process.exit(1);
}

console.error('-> staging the operator core into the embed dir…');
resetData();
const n = copyDir(OPERATOR, DATA);
console.error('   embedded ' + n + ' files');

console.error('-> go build (this bakes the operator core into the binary)…');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const r = spawnSync('go', ['build', '-o', OUT, './cmd/nexus'], {
  cwd: NEXUS,
  stdio: 'inherit',
});

console.error('-> cleaning the staging dir…');
resetData();

if (r.status !== 0) {
  console.error('x build failed.');
  process.exit(1);
}
console.error('+ built ' + path.relative(ROOT, OUT));
console.error('  try it:  ' + (IS_WIN ? OUT : './' + path.relative(ROOT, OUT)) + ' --help');
