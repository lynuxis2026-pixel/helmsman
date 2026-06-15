#!/usr/bin/env node
'use strict';

/*
 * Helmsman Dungeons — engine + dashboard server.
 *
 * Zero-dependency Node. Serves the command-center dashboard, stores dungeons,
 * and runs them: each pipeline stage is a crew agent that thinks on the user's
 * Max plan (via `claude -p`, no API keys, no per-call cost). Paper-first.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const ROOT = __dirname;
const WEB = path.join(ROOT, 'web');
const DATA = path.join(ROOT, 'data');
const DB = path.join(DATA, 'dungeons.json');
const LIB = path.join(ROOT, 'agents', 'library.json');
const PORT = Number(process.env.DUNGEONS_PORT) || 4444;

fs.mkdirSync(DATA, { recursive: true });
if (!fs.existsSync(DB)) fs.writeFileSync(DB, '[]');

const library = JSON.parse(fs.readFileSync(LIB, 'utf8'));
const agentById = Object.fromEntries(library.agents.map(a => [a.id, a]));

const loadDungeons = () => JSON.parse(fs.readFileSync(DB, 'utf8'));
const saveDungeons = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
const getDungeon = (id) => loadDungeons().find(d => d.id === id);
const upsertDungeon = (dn) => {
  const all = loadDungeons();
  const i = all.findIndex(d => d.id === dn.id);
  if (i >= 0) all[i] = dn; else all.push(dn);
  saveDungeons(all);
  return dn;
};

// ── live events (SSE) ────────────────────────────────────────────────────
const sseClients = new Set();
function broadcast(type, payload) {
  const line = `data: ${JSON.stringify({ type, ...payload, at: new Date().toISOString() })}\n\n`;
  for (const res of sseClients) { try { res.write(line); } catch {} }
}

// ── agent intelligence: think on the Max plan via `claude -p` ─────────────
function claudeAgent(prompt) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;   // force the Max/Pro subscription, not an API key
    delete env.ANTHROPIC_BASE_URL;  // and not the proxy
    let out = '', err = '';
    let cp;
    try {
      cp = spawn('claude', ['-p'], { shell: true, env });
    } catch (e) {
      return resolve({ ok: false, text: '', error: 'cannot launch claude: ' + e.message });
    }
    cp.stdout.on('data', d => (out += d));
    cp.stderr.on('data', d => (err += d));
    cp.on('error', e => resolve({ ok: false, text: '', error: '`claude` not found — install Claude Code (npm i -g @anthropic-ai/claude-code): ' + e.message }));
    cp.on('close', code => resolve({ ok: code === 0, text: out.trim(), error: code === 0 ? '' : (err.trim() || ('claude exited ' + code)) }));
    cp.stdin.write(prompt);
    cp.stdin.end();
  });
}

function extractJson(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < 0) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

// ── Skipper (command core): turn a vision into a dungeon spec ─────────────
async function skipperPlan(instruction) {
  const roster = library.agents.map(a => `- ${a.id}: ${a.name} (${a.role}) — ${a.tagline}`).join('\n');
  const prompt = `${library.commandCore.systemPrompt}

Available crew agents (use their ids):
${roster}

Founder's instruction: "${instruction}"

Design a dungeon for this. Return ONLY a JSON object, no prose, in exactly this shape:
{
  "name": "short dungeon name",
  "goal": "one sentence goal",
  "guardrails": { "budgetCapUSD": 500, "minMarginPct": 30, "maxPerItemUSD": 50 },
  "pipeline": [ { "agentId": "scout", "instruction": "what this stage should do" } ]
}
Pick 3-6 stages from the crew that fit the goal, in execution order.`;
  const r = await claudeAgent(prompt);
  if (!r.ok) return { ok: false, error: r.error, reply: '' };
  const spec = extractJson(r.text);
  return { ok: true, spec, reply: r.text };
}

// ── run a dungeon (autonomous, paper-first) ──────────────────────────────
const running = new Map(); // id -> { killed: bool }

// After a run, the Mentor reflects and saves lessons so the next run earns more, faster.
async function reflect(id, transcript) {
  const dn = getDungeon(id);
  if (!dn) return;
  const mem = dn.memory || { lessons: [], runs: [] };
  const profit = (dn.earned || 0) - (dn.invested || 0);
  const body = transcript.map(s => `## ${s.agent}\n${s.output}`).join('\n\n').slice(0, 8000);
  const prompt = `You are the Mentor for the "${dn.name}" dungeon (goal: ${dn.goal}). The crew just finished a paper run.
Result: invested $${dn.invested || 0}, earned $${dn.earned || 0}, profit $${profit}.

Run transcript:
${body}

Reflect so the NEXT run makes MORE money, FASTER. Return ONLY JSON:
{ "summary": "one line on how this run went", "lessons": ["specific reusable lesson — what to do, avoid, or do faster", "..."] }
3-6 lessons, concrete and tied to what actually made or lost money. No generic advice.`;
  const r = await claudeAgent(prompt);
  const j = extractJson(r.text) || {};
  const fresh = (j.lessons || []).filter(x => typeof x === 'string' && x.trim());
  mem.lessons = [...fresh, ...(mem.lessons || [])].filter((v, i, a) => a.indexOf(v) === i).slice(0, 12);
  mem.runs = [...(mem.runs || []), { at: new Date().toISOString(), invested: dn.invested || 0, earned: dn.earned || 0, profit, summary: j.summary || '' }].slice(-24);
  dn.memory = mem;
  upsertDungeon(dn);
  broadcast('learned', { id, lessons: mem.lessons, runs: mem.runs, summary: j.summary || '' });
}

async function runDungeon(id) {
  let dn = getDungeon(id);
  if (!dn) return;
  if (running.has(id)) return; // already running
  const ctrl = { killed: false };
  running.set(id, ctrl);
  dn.status = 'running';
  upsertDungeon(dn);
  broadcast('dungeon-status', { id, status: 'running' });

  const mem = dn.memory || { lessons: [], runs: [] };
  const lessonsBlock = (mem.lessons && mem.lessons.length)
    ? `\nWhat the crew has LEARNED from past runs — apply these to be more profitable AND faster:\n- ${mem.lessons.join('\n- ')}\n`
    : '';
  const transcript = [];
  let prev = '';
  for (let i = 0; i < (dn.pipeline || []).length; i++) {
    if (ctrl.killed) break;
    const stage = dn.pipeline[i];
    const agent = agentById[stage.agentId] || { name: stage.agentId, systemPrompt: 'You are a helpful operator.' };
    broadcast('stage', { id, index: i, agentId: stage.agentId, agent: agent.name, status: 'running', activity: stage.instruction });

    const prompt = `${agent.systemPrompt}

You are working inside the "${dn.name}" dungeon. Overall goal: ${dn.goal}
Guardrails: budget cap $${dn.guardrails?.budgetCapUSD ?? 500}, min margin ${dn.guardrails?.minMarginPct ?? 30}%, max $${dn.guardrails?.maxPerItemUSD ?? 50}/item. PAPER MODE — never spend real money; propose simulated actions only.${lessonsBlock}
${prev ? `\nResult from the previous stage:\n${prev}\n` : ''}
Your task: ${stage.instruction}
Be concrete and brief.
If this step involves any paper money — buying (spend) or selling (revenue) — end with ONE machine-readable line exactly like: LEDGER: spend=<usd> revenue=<usd>  (use 0 where not applicable; numbers only).
Then end with a one-line "HANDOFF:" summarising what you pass to the next agent.`;

    const r = await claudeAgent(prompt);
    if (ctrl.killed) break;
    if (!r.ok) {
      broadcast('stage', { id, index: i, agentId: stage.agentId, agent: agent.name, status: 'error', activity: r.error });
      dn = getDungeon(id); dn.status = 'error'; upsertDungeon(dn);
      broadcast('dungeon-status', { id, status: 'error', error: r.error });
      running.delete(id);
      return;
    }
    prev = r.text;
    transcript.push({ agent: agent.name, output: r.text });
    const lm = r.text.match(/LEDGER:\s*spend\s*=\s*\$?\s*([0-9]+(?:\.[0-9]+)?)\D+revenue\s*=\s*\$?\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (lm) {
      const cur = getDungeon(id);
      cur.invested = (cur.invested || 0) + parseFloat(lm[1]);
      cur.earned = (cur.earned || 0) + parseFloat(lm[2]);
      upsertDungeon(cur);
      broadcast('ledger', { id, invested: cur.invested, earned: cur.earned });
    }
    broadcast('stage', { id, index: i, agentId: stage.agentId, agent: agent.name, status: 'done', output: r.text });
  }

  if (!ctrl.killed) await reflect(id, transcript);

  dn = getDungeon(id);
  dn.status = ctrl.killed ? 'killed' : 'idle';
  dn.lastRunAt = new Date().toISOString();
  upsertDungeon(dn);
  broadcast('dungeon-status', { id, status: dn.status });
  running.delete(id);
}

// ── HTTP ─────────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise(resolve => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } }); });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  try {
    if (p === '/api/library') return send(res, 200, library);

    if (p === '/api/dungeons' && req.method === 'GET') return send(res, 200, loadDungeons());
    if (p === '/api/dungeons' && req.method === 'POST') {
      const b = await readBody(req);
      const dn = {
        id: crypto.randomUUID(), name: b.name || 'New dungeon', goal: b.goal || '',
        guardrails: b.guardrails || { budgetCapUSD: 500, minMarginPct: 30, maxPerItemUSD: 50 },
        pipeline: b.pipeline || [], runMode: 'paper', status: 'idle',
        invested: 0, earned: 0, memory: { lessons: [], runs: [] },
        createdAt: new Date().toISOString(),
      };
      upsertDungeon(dn); broadcast('dungeon-new', { dungeon: dn });
      return send(res, 200, dn);
    }
    const m = p.match(/^\/api\/dungeons\/([^/]+)(\/(run|kill))?$/);
    if (m) {
      const id = m[1], action = m[3];
      if (req.method === 'GET') { const dn = getDungeon(id); return dn ? send(res, 200, dn) : send(res, 404, { error: 'not found' }); }
      if (req.method === 'PUT') { const b = await readBody(req); const dn = getDungeon(id); if (!dn) return send(res, 404, { error: 'not found' }); Object.assign(dn, b, { id }); upsertDungeon(dn); return send(res, 200, dn); }
      if (req.method === 'DELETE') { saveDungeons(loadDungeons().filter(d => d.id !== id)); return send(res, 200, { ok: true }); }
      if (action === 'run' && req.method === 'POST') { runDungeon(id); return send(res, 200, { ok: true }); }
      if (action === 'kill' && req.method === 'POST') { const c = running.get(id); if (c) c.killed = true; return send(res, 200, { ok: true }); }
    }

    if (p === '/api/skipper' && req.method === 'POST') {
      const b = await readBody(req);
      const r = await skipperPlan(b.instruction || '');
      return send(res, 200, r);
    }

    if (p === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // static
    let file = p === '/' ? '/index.html' : p;
    const fp = path.join(WEB, path.normalize(file).replace(/^([/\\])+/, ''));
    if (fp.startsWith(WEB) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      return send(res, 200, fs.readFileSync(fp), MIME[path.extname(fp)] || 'application/octet-stream');
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 500, { error: String(e && e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(`\n  ⚓ Helmsman Dungeons running`);
  console.log(`     Dashboard: http://localhost:${PORT}`);
  console.log(`     Agents think on your Max plan (claude -p) — no API keys.\n`);
});
