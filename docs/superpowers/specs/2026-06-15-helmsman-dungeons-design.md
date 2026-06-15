# Helmsman Dungeons — design spec

**Date:** 2026-06-15
**Status:** Approved design → ready for implementation planning
**Component:** New Helmsman feature (`dungeons/`)

## 1. Summary

Helmsman Dungeons is a platform for spinning up **autonomous, guardrailed agent
pipelines — "dungeons" — toward any goal**, with **making money** as the primary
goal class. A dungeon is a named pipeline of role-agents (e.g. Scout → Analyst →
Buyer → Lister → Closer) that run autonomously within hard guardrails (budget cap,
minimum margin, kill-switch) and an audit log. It runs **paper-first** (simulated
execution on real data → real P&L, no real money) and can be flipped to **live**
per dungeon — only on connectors whose terms permit automation.

It is generic: not Etsy-only. Etsy reselling is the first starter template; the
same engine runs dropshipping, content/affiliate, freelance-services, arbitrage,
print-on-demand, or any other strategy expressed as a pipeline.

**Two product principles (added):**
- **Helmsman *is* the dashboard.** Opening Helmsman opens this dungeon dashboard —
  it is the primary UI where the user creates and runs dungeons. The dungeon
  dashboard is Helmsman's front door, not a side feature.
- **NEXUS runs embedded in the background, zero-config, for ~free.** Helmsman
  auto-starts NEXUS and routes every agent call to free/local providers (Groq free
  tier, Ollama) or the user's Max plan, so running dungeons costs ~€0 beyond what
  the user already has. NEXUS is invisible infrastructure — never configured by hand.

## 2. Goals / non-goals

**Goals**
- Create a dungeon by describing a goal in natural language; an architect agent
  drafts the pipeline; the user refines it in a visual builder.
- Run a dungeon autonomously: stage→stage, with guardrails enforced engine-side.
- A live dashboard: list/create dungeons, watch a dungeon work (pipeline, agents,
  live P&L, activity feed, guardrails, kill-switch), and edit its pipeline.
- Paper-trading by default; full audit log; one-click kill.

**Non-goals (honest boundaries)**
- Not a "magic money printer." The platform *orchestrates* money-making agents;
  whether a dungeon profits depends on the strategy, the connectors, and real-world
  market reality. Paper-first exists precisely to validate before risking money.
- No connector that performs actions a platform forbids. In particular: **no
  automated buying on Etsy** (Etsy prohibits bot purchasing). Etsy's official
  *seller* API (listing/selling in your own shop) is permitted and may be used.
- v1 is single-user, local (runs on the user's machine via Helmsman). No hosted
  multi-tenant service, no auth system.

## 3. Core concepts

- **Dungeon** — `{ id, name, goal, runMode: paper|live, guardrails, pipeline[],
  connectors[], status: idle|running|paused|killed }`. Generic and goal-agnostic.
- **Stage (role-agent)** — one pipeline step: `{ id, order, name, role, agent:
  { displayName, systemPrompt, model? }, tools[] }`. The agent is an LLM call (via
  Helmsman) with a role prompt and an allow-listed set of tools/connectors.
- **Connector** — a pluggable capability exposed to stages as tools. Each connector
  provides one or more tools `{ name, inputSchema, handler }`. MVP connectors:
  `web.research` (read-only search/fetch), `market.data` (price/market data;
  sandbox/mock in MVP), `ledger.paper` (the paper broker: records buys/sells,
  computes P&L). Real money/marketplace connectors are added later, behind live mode.
- **Architect** — an agent that turns a goal description (+ available connectors and
  templates) into a validated Dungeon spec (pipeline JSON). Its output is editable.
- **Paper ledger** — records simulated positions/trades on real market data and
  computes realised + unrealised P&L. The "execution" connector in paper mode.
- **Guardrails** — engine-enforced limits: `budgetCapUSD`, `minMarginPct`,
  `maxSpendPerItemUSD`, plus the kill-switch. Enforced in code before any money
  action — never prompt-only.

## 4. Architecture (built on Helmsman)

```
Dashboard (Svelte + SSE)                 ── 3 views: list · dungeon · builder
        │  HTTP + SSE
Dungeon engine (Node/TypeScript)         ── runner · guardrails · paper ledger · audit
        │  spawns stage agents
Helmsman agent execution                 ── LLM via NEXUS routing OR the Max plan
        │
SQLite (dungeons, runs, audit, ledger)   ── reuses ecc2 control-plane patterns
```

- **Engine** — a new Node/TypeScript component in the Helmsman repo (`dungeons/`).
  Owns the dungeon lifecycle: load spec → run the pipeline loop → enforce guardrails
  → record to the paper ledger + audit log → emit live events. Persists to SQLite.
  Reuses the *patterns* of the ecc2 control-plane (sessions, state, daemon loop),
  not its Rust code.
- **Agent execution** — each stage is an Anthropic Messages tool-use loop: the
  stage's system prompt + the prior stage's output + the dungeon context, with the
  stage's allow-listed connector tools. Routed through Helmsman (NEXUS, or the
  user's Max plan via the operator path).
- **Dashboard** — Svelte + Vite (same stack as the NEXUS dashboard), live updates
  over SSE, talking to the engine's HTTP API.
- **Persistence** — SQLite: `dungeons`, `runs`, `stage_events`, `audit_log`,
  `ledger_entries`.

## 5. The three dashboard views

1. **My dungeons** — grid of dungeons with status + P&L; "new dungeon" (describe a
   goal, or start from a template).
2. **Dungeon view** — the pipeline as a vertical assembly line of stage cards (icon,
   stage name, agent, current activity, status), metric cards (paper P&L, budget
   used, items sold, win rate), a live activity feed, the guardrails line, and a
   prominent **kill** button. (See the approved mockup.)
3. **Pipeline builder** — visual editor for a dungeon's pipeline: reorder/add/remove
   stages, edit each stage's role/prompt/tools, set guardrails. Pre-filled by the
   architect; the user refines.

## 6. How a dungeon runs

1. Engine loads the dungeon spec; status → running.
2. For each stage in order: invoke the stage agent with the prior output + context +
   its tools. The agent may call connector tools (research, market data).
3. **Money actions** go through a broker abstraction. In **paper** mode the broker
   records to the paper ledger (no real money) and returns a simulated fill on real
   data. In **live** mode it calls the real connector — only ToS-permitted ones.
4. Before any money action the engine checks **guardrails** (budget cap, min margin,
   max per item); over-limit actions are rejected and logged.
5. Every step (stage start/end, tool call, money-action proposal + result, guardrail
   decisions) is appended to the **audit log** and streamed to the dashboard (SSE).
6. The dungeon loops autonomously (daemon) — re-running the pipeline on a cadence or
   continuously — bounded by guardrails.
7. **Kill-switch** sets status → killed and halts the loop immediately.

## 7. Creation flow (describe → AI builds → visual refine)

1. User types a goal: "flip vintage items", "affiliate blog about gadgets", …
2. The **architect** agent drafts a Dungeon spec: stages, agent roles + prompts,
   the connectors each stage needs, and default guardrails. Output validated against
   the Dungeon schema.
3. The draft opens in the **pipeline builder**; the user tweaks and saves.
4. Run (paper). Templates (e.g. Etsy reseller) are pre-built specs that skip step 2.

## 8. MVP scope (v1)

**In**
- Dungeon CRUD + SQLite persistence.
- Architect: goal → validated dungeon spec.
- Pipeline builder: edit the spec via the UI.
- Engine: autonomous pipeline loop, **paper mode only**, guardrails, kill-switch,
  audit log, live SSE events.
- Dashboard: the three views, live.
- Connectors: `web.research`, `market.data` (sandbox/mock), `ledger.paper`.
- One end-to-end starter template: **Etsy reseller** (research → decide → source →
  list → sell), fully in paper mode on mock market data.

**Out (later)**
- Real live execution + real connectors (marketplace/payment/sourcing APIs).
- Etsy seller API live listing; dropship/wholesale sourcing APIs.
- Manager and blackboard collaboration models (pipeline only for v1).
- Multi-user / hosted / auth. Parallel dungeons at scale. Advanced analytics.

## 9. Safety & legal

- **Paper-first** is the default and the only mode in v1.
- Live mode (post-v1) is opt-in per dungeon and only wires connectors whose terms
  permit automation. No automated buying on platforms that forbid it (Etsy buying).
- Guardrails are enforced in engine code, not prompts. Kill-switch + full audit log
  are always on. Live money actions may optionally require human approval.

## 10. Success criteria

A user can: describe a money idea → receive an AI-drafted dungeon → refine it in the
builder → run it autonomously in paper mode → watch the agents move through the
pipeline with live P&L, activity, and guardrails → press kill to stop — with
everything persisted and auditable. The Etsy reseller template works end-to-end in
paper mode.

## 11. Resolved defaults (refine details during planning)

- **Stage agents run for ~free via an embedded, background NEXUS.** Helmsman
  auto-starts NEXUS (zero-config) and routes every agent call to free/local providers
  (Groq free tier, Ollama) or the user's Max plan — so dungeons run at ~€0 marginal
  cost and need no hand-configured API keys. NEXUS is invisible to the user.
- **MVP paper ledger uses deterministic mock market data** (no external feed), so the
  whole loop runs offline and reproducibly. Real data feeds arrive with live mode.
- **The engine launches as `helmsman dungeons`** — a new subcommand that starts the
  engine and serves the dashboard, mirroring `helmsman start`.

Details still to settle in the implementation plan: the exact stage-agent tool-use
loop, the SQLite schema specifics, and the dashboard component breakdown.
