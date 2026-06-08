# Licenses

This monorepo combines two independently-licensed projects. Each retains its
original license, kept in its own subdirectory. Both are permissive and
compatible.

| Component | License | File |
|-----------|---------|------|
| **ECC** (`ecc/`) | MIT | [`ecc/LICENSE`](ecc/LICENSE) |
| **NEXUS** (`nexus/`) | Apache-2.0 | [`nexus/LICENSE`](nexus/LICENSE), [`nexus/NOTICE`](nexus/NOTICE) |
| **Integration layer** (`integration/`, root files) | MIT | this repository |

## Notes

- The **Apache-2.0** `NOTICE` file for NEXUS is preserved at
  [`nexus/NOTICE`](nexus/NOTICE) and its terms continue to apply to everything
  under `nexus/`.
- The **MIT** terms in [`ecc/LICENSE`](ecc/LICENSE) continue to apply to
  everything under `ecc/`.
- The integration layer added by this combination (the `ecc-nexus` bridge CLI,
  the unified installers, the combined docs and the MCP/env wiring) is offered
  under the **MIT** license, chosen for compatibility with both.
- MIT and Apache-2.0 are compatible: you may use, modify and redistribute the
  combined work provided you keep each component's license and notices intact.

When redistributing, retain `ecc/LICENSE`, `nexus/LICENSE` and `nexus/NOTICE`.
