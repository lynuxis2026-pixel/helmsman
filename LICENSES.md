# Licenses

Helmsman bundles two independently-licensed open-source projects. Each retains
its original license and copyright, kept in its own subdirectory. Both are
permissive and compatible. You may rebrand, modify, redistribute and even sell
the combined work — provided the notices below stay intact.

| Component | Copyright | License | Files |
|-----------|-----------|---------|-------|
| **Operator core** (`operator/`) | © 2026 Affaan Mustafa | MIT | [`operator/LICENSE`](operator/LICENSE) |
| **NEXUS** (`nexus/`) | © 2026 NEXUS contributors | Apache-2.0 | [`nexus/LICENSE`](nexus/LICENSE), [`nexus/NOTICE`](nexus/NOTICE) |
| **Integration layer** (`integration/`, root files) | Helmsman | MIT | this repository |

## Notes

- **Operator core** — the MIT license at [`operator/LICENSE`](operator/LICENSE)
  requires the copyright notice (© 2026 Affaan Mustafa) and the permission notice
  to be kept in copies. You may rename the product (Helmsman) freely and drop the
  upstream brand name; only the MIT copyright/permission notice must remain.
  Source: https://github.com/affaan-m/ECC
- **NEXUS** — the Apache-2.0 license requires keeping [`nexus/LICENSE`](nexus/LICENSE)
  and the attribution notices in [`nexus/NOTICE`](nexus/NOTICE). That NOTICE also
  carries a trademark policy: derivative works must **not** be distributed under
  the "NEXUS" name — which is one reason this product is branded **Helmsman**.
- **Integration layer** — the glue added by this combination (the `helmsman`
  bridge CLI, the unified installers, the combined docs and the MCP/env wiring)
  is offered under the **MIT** license, chosen for compatibility with both.
- MIT and Apache-2.0 are compatible: you may use, modify and redistribute the
  combined work provided you keep each component's license and notices intact.

When redistributing, retain `operator/LICENSE`, `nexus/LICENSE` and `nexus/NOTICE`.
