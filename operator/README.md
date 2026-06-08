<p align="center">
  <img src="../assets/helmsman-banner.svg" alt="Helmsman" width="760">
</p>

# Helmsman — Operator core

This folder is the **operator core** of **[Helmsman](../README.md)**: the
harness-native agent operator system — **416 skills, 64 agents, 84 commands,
104 rules**, hooks, MCP configs and the Node/Python CLI tooling. It decides
*what* the agent does, across **Claude Code, Codex, Cursor, Gemini, OpenCode,
Zed and Copilot**.

> Part of Helmsman. For install, the single binary, and the full picture, see
> the **[top-level README](../README.md)**.

## Run it

Through Helmsman (recommended — the single binary has this baked in):

```bash
helmsman operator <args...>      # e.g.  helmsman operator typescript
helmsman doctor                  # diagnose the operator core (+ the router)
```

From source:

```bash
node scripts/ecc.js <args...>
python3 ecc_dashboard.py         # the dashboard
```

## Layout

| Path | What |
|------|------|
| `skills/` · `agents/` · `commands/` · `rules/` · `hooks/` | the operator content |
| `scripts/` | the Node CLI + tooling |
| `ecc_dashboard.py` | the Python dashboard |
| `docs/` | guides and translations |

## License & credits

Operator core: **MIT**, © 2026 Affaan Mustafa — see [`LICENSE`](LICENSE).
Based on the open-source project at <https://github.com/affaan-m/ECC>.
