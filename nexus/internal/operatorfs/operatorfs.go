// SPDX-License-Identifier: Apache-2.0
//
// Package operatorfs carries the Helmsman operator core (skills, agents, rules,
// commands, hooks, MCP configs and the Node/Python tooling) baked into the
// single binary via go:embed. At runtime it is extracted to ~/.helmsman/operator
// so the Node/Python tooling can run from disk.
//
// The `data` directory is populated at build time by integration/build-helmsman.js
// (it copies the repo's operator/ tree in, builds, then cleans up). A plain
// `go build` with only the committed .gitkeep produces a "hollow" binary —
// HasOperator() reports false and the CLI tells the user to rebuild with the
// build script.
package operatorfs

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"
)

//go:embed all:data
var embedded embed.FS

// root returns the embedded tree with the "data/" prefix stripped.
func root() (fs.FS, error) {
	return fs.Sub(embedded, "data")
}

// HasOperator reports whether a real operator core was baked in (vs a hollow
// dev build that only contains the .gitkeep placeholder).
func HasOperator() bool {
	r, err := root()
	if err != nil {
		return false
	}
	_, err = fs.Stat(r, "scripts/ecc.js")
	return err == nil
}

// Extract writes the embedded operator tree to dst, creating directories.
func Extract(dst string) error {
	r, err := root()
	if err != nil {
		return err
	}
	return fs.WalkDir(r, ".", func(p string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		target := filepath.Join(dst, filepath.FromSlash(p))
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		b, err := fs.ReadFile(r, p)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		// go:embed reports every file as 0444, so the original exec bit is lost.
		// Give shell scripts the exec bit back; everything else stays 0644.
		mode := os.FileMode(0o644)
		if filepath.Ext(p) == ".sh" {
			mode = 0o755
		}
		return os.WriteFile(target, b, mode)
	})
}
