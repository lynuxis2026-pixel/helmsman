# Licenses

**Helmsman** is released under the **MIT License** — see [`LICENSE`](LICENSE).

It bundles two open-source components that keep their own (MIT-compatible)
licenses and copyright. All are permissive: you may rebrand, modify,
redistribute and even sell the combined work — provided the notices below stay
intact.

| Component | Copyright | License | Files |
|-----------|-----------|---------|-------|
| **Helmsman** (project · `integration/` · root files) | © 2026 lynuxis2026-pixel | MIT | [`LICENSE`](LICENSE) |
| **Operator core** (`operator/`) | © 2026 Affaan Mustafa | MIT | [`operator/LICENSE`](operator/LICENSE) |
| **NEXUS** (`nexus/`) | © 2026 NEXUS contributors | Apache-2.0 | [`nexus/LICENSE`](nexus/LICENSE), [`nexus/NOTICE`](nexus/NOTICE) |

## Notes

- **Helmsman itself is MIT.** It covers the project's own original work — the
  `helmsman` bridge/binary glue, the installers, the combined docs and build.
- **Operator core** — MIT requires keeping the copyright notice
  (© 2026 Affaan Mustafa) and permission notice in [`operator/LICENSE`](operator/LICENSE).
- **NEXUS** — Apache-2.0 code **cannot** be relicensed as MIT; it stays
  Apache-2.0. That is fine — an MIT project may bundle an Apache-2.0 component.
  Keep [`nexus/LICENSE`](nexus/LICENSE) and [`nexus/NOTICE`](nexus/NOTICE) (the
  NOTICE also forbids distributing derivatives under the "NEXUS" name — which is
  why this product is branded **Helmsman**).
- MIT and Apache-2.0 are compatible: use, modify and redistribute the combined
  work provided each component's license and notices stay intact.

When redistributing, retain `LICENSE`, `operator/LICENSE`, `nexus/LICENSE` and
`nexus/NOTICE`.
