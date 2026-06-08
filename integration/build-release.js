#!/usr/bin/env node
'use strict';

/*
 * build-release.js — cross-compile the single, self-contained `helmsman` binary
 * (operator core embedded) for every supported platform, into ./dist.
 *
 *   node integration/build-release.js [version]
 *
 * Pure-Go (CGO disabled, modernc SQLite) so every target cross-compiles from any
 * host with just the Go toolchain — no C compiler, no per-OS runner needed.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const OPERATOR = path.join(ROOT, 'operator');
const NEXUS = path.join(ROOT, 'nexus');
const DATA = path.join(NEXUS, 'internal', 'operatorfs', 'data');
const DIST = path.join(ROOT, 'dist');

const VERSION = process.argv[2] || process.env.HELMSMAN_VERSION || 'dev';
const BUILD_TIME = new Date().toISOString();

const TARGETS = [
  ['linux', 'amd64', ''],
  ['linux', 'arm64', ''],
  ['darwin', 'amd64', ''],
  ['darwin', 'arm64', ''],
  ['windows', 'amd64', '.exe'],
];

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) n += copyDir(s, d);
    else if (e.isFile()) { fs.copyFileSync(s, d); n++; }
  }
  return n;
}
function resetData() {
  rmrf(DATA);
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, '.gitkeep'), '# placeholder; operator core is staged here at build time\n');
}

if (!fs.existsSync(path.join(OPERATOR, 'scripts', 'ecc.js'))) {
  console.error('x operator/ not found (expected the operator core at ./operator).');
  process.exit(1);
}

console.error(`Helmsman release build — version ${VERSION}`);
console.error('-> staging the operator core into the embed dir…');
resetData();
console.error('   embedded ' + copyDir(OPERATOR, DATA) + ' files');

rmrf(DIST);
fs.mkdirSync(DIST, { recursive: true });
const ldflags = `-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME}`;
const sums = [];
let ok = true;

for (const [goos, goarch, ext] of TARGETS) {
  const name = `helmsman-${goos}-${goarch}${ext}`;
  const out = path.join(DIST, name);
  console.error(`-> building ${goos}/${goarch}…`);
  const r = spawnSync('go', ['build', '-trimpath', '-ldflags', ldflags, '-o', out, './cmd/nexus'], {
    cwd: NEXUS,
    stdio: 'inherit',
    env: { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: '0' },
  });
  if (r.status !== 0) { ok = false; console.error(`x ${goos}/${goarch} failed`); continue; }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex');
  sums.push(`${sha}  ${name}`);
}

fs.writeFileSync(path.join(DIST, 'SHA256SUMS.txt'), sums.join('\n') + '\n');

console.error('-> cleaning the staging dir…');
resetData();

if (!ok) { console.error('x one or more builds failed.'); process.exit(1); }
console.error('+ artifacts in dist/:');
for (const f of fs.readdirSync(DIST)) {
  const sz = (fs.statSync(path.join(DIST, f)).size / 1048576).toFixed(1);
  console.error(`   ${f}  (${sz} MB)`);
}
