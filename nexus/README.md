<p align="center">
  <img src="../assets/helmsman-banner.svg" alt="Helmsman" width="760">
</p>

# Helmsman — Router (NEXUS engine)

This folder is the **router** of **[Helmsman](../README.md)**: a local-first
proxy that routes Claude Code to the **cheapest capable model**, **redacts
secrets & PII before they leave your machine**, benchmarks every provider on
*your* traffic and learns routing. One Go binary, **30+ providers**, pure-Go
SQLite, embedded Svelte dashboard.

It powers Helmsman's *how* — every model call: cheap, private and local-first.

> Part of Helmsman. For install, the single binary, and the full picture, see
> the **[top-level README](../README.md)**.

## Run it

Through Helmsman (recommended):

```bash
helmsman start        # proxy (:3000) + dashboard (:2222)
helmsman code         # start + launch Claude Code through it
helmsman cost | top | bench | add <provider> <key> | mcp
```

Build just this engine from source:

```bash
go build -o bin/nexus ./cmd/nexus
```

## License & credits

The router engine is **NEXUS**, licensed **Apache-2.0** — see [`LICENSE`](LICENSE)
and [`NOTICE`](NOTICE). © 2026 NEXUS contributors. Per the NOTICE trademark
policy, derivative distributions are **not** branded "NEXUS" — which is why this
product is branded **Helmsman**.
