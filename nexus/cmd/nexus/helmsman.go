// SPDX-License-Identifier: Apache-2.0
//
// Helmsman single-binary glue: the operator core (Node/Python) is baked into
// this binary via internal/operatorfs and extracted to ~/.helmsman/operator on
// first use. These subcommands run it and wire it to the NEXUS half.

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/fatih/color"
	"github.com/spf13/cobra"

	"github.com/lynuxis2026-pixel/nexus-proxy/internal/operatorfs"
)

// operatorDir is where the embedded operator core is extracted.
func operatorDir() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return filepath.Join(".helmsman", "operator")
	}
	return filepath.Join(home, ".helmsman", "operator")
}

// ensureOperator extracts the embedded operator core on first use.
func ensureOperator() (string, error) {
	dir := operatorDir()
	if _, err := os.Stat(filepath.Join(dir, "scripts", "ecc.js")); err == nil {
		return dir, nil
	}
	if !operatorfs.HasOperator() {
		return "", fmt.Errorf("this binary has no operator core embedded — rebuild the single binary with:\n  node integration/build-helmsman.js")
	}
	color.Yellow("→ extracting the operator core to %s (first run)…", dir)
	if err := operatorfs.Extract(dir); err != nil {
		return "", fmt.Errorf("failed to extract operator core: %w", err)
	}
	return dir, nil
}

func mustNode() (string, error) {
	p, err := exec.LookPath("node")
	if err != nil {
		return "", fmt.Errorf("`node` not found on PATH — the operator core needs Node.js >= 18 (https://nodejs.org)")
	}
	return p, nil
}

// runNode runs a Node script inside the extracted operator core.
func runNode(dir, script string, args ...string) error {
	node, err := mustNode()
	if err != nil {
		return err
	}
	c := exec.Command(node, append([]string{filepath.Join(dir, "scripts", script)}, args...)...)
	c.Dir = dir
	c.Stdin, c.Stdout, c.Stderr = os.Stdin, os.Stdout, os.Stderr
	return c.Run()
}

var operatorCmd = &cobra.Command{
	Use:                "operator [args...]",
	Short:              "Run the embedded operator core (skills, agents, install, …)",
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, err := ensureOperator()
		if err != nil {
			return err
		}
		return runNode(dir, "ecc.js", args...)
	},
}

var setupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Extract the embedded operator core and wire the NEXUS MCP server",
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, err := ensureOperator()
		if err != nil {
			return err
		}
		color.Green("✓ Operator core ready at %s", dir)
		return wireMCP(dir)
	},
}

var wireMcpCmd = &cobra.Command{
	Use:   "wire-mcp",
	Short: "Add the NEXUS savings MCP server to the operator core's .mcp.json",
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, err := ensureOperator()
		if err != nil {
			return err
		}
		return wireMCP(dir)
	},
}

func wireMCP(dir string) error {
	p := filepath.Join(dir, ".mcp.json")
	raw, err := os.ReadFile(p)
	if err != nil {
		return err
	}
	var doc map[string]interface{}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return err
	}
	servers, _ := doc["mcpServers"].(map[string]interface{})
	if servers == nil {
		servers = map[string]interface{}{}
		doc["mcpServers"] = servers
	}
	servers["nexus"] = map[string]interface{}{"command": "helmsman", "args": []string{"mcp"}}
	out, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(p, append(out, '\n'), 0o644); err != nil {
		return err
	}
	color.Green("✓ Wired NEXUS savings MCP server into %s (server \"nexus\")", p)
	return nil
}

var envCmd = &cobra.Command{
	Use:   "env [port]",
	Short: "Print env lines that route Claude Code through Helmsman",
	RunE: func(cmd *cobra.Command, args []string) error {
		port := "3000"
		if len(args) > 0 && args[0] != "" {
			port = args[0]
		}
		fmt.Println("# Route Claude Code (and every operator-driven agent) through Helmsman/NEXUS.")
		fmt.Println("# bash / zsh:")
		fmt.Printf("  export ANTHROPIC_BASE_URL=http://localhost:%s\n", port)
		fmt.Println("  export ANTHROPIC_API_KEY=nexus-local")
		fmt.Println("# PowerShell:")
		fmt.Printf("  $env:ANTHROPIC_BASE_URL = \"http://localhost:%s\"\n", port)
		fmt.Println("  $env:ANTHROPIC_API_KEY  = \"nexus-local\"")
		return nil
	},
}

// maxCmd runs Claude Code on the user's Max/Pro subscription (no API key, no
// NEXUS proxy) with Helmsman's operator core available for orchestration.
//
// A Max/Pro subscription authenticates via OAuth and only covers Anthropic
// models — so NEXUS cost-routing does not apply here. This command forces
// subscription auth by stripping ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL, then
// launches Claude Code; the operator core (installed into ~/.claude) supplies
// the skills, agents and control-plane you orchestrate from.
var maxCmd = &cobra.Command{
	Use:                "max [-- claude args...]",
	Short:              "Run Claude Code on your Max plan + operator core (NEXUS routing OFF)",
	DisableFlagParsing: true,
	RunE:               runMax,
}

func runMax(cmd *cobra.Command, args []string) error {
	claude, err := exec.LookPath("claude")
	if err != nil {
		return fmt.Errorf("`claude` (Claude Code) not found on PATH — install it:\n  npm i -g @anthropic-ai/claude-code")
	}

	// Force subscription auth: drop the API key + proxy base URL so Claude Code
	// uses your Max/Pro login, not an API key or the NEXUS proxy.
	var env []string
	for _, e := range os.Environ() {
		if strings.HasPrefix(e, "ANTHROPIC_BASE_URL=") || strings.HasPrefix(e, "ANTHROPIC_API_KEY=") {
			continue
		}
		env = append(env, e)
	}

	color.Cyan("Helmsman — Max mode")
	color.White("  Claude Code will use your Max/Pro subscription. NEXUS routing is OFF.")
	color.HiBlack("  - Not logged in?            run `claude`, then `/login` -> choose your subscription")
	color.HiBlack("  - Install operator skills:  helmsman operator install        (into ~/.claude)")
	color.HiBlack("  - Orchestrate many agents:  helmsman operator control-pane    (the ecc2 control plane)")
	fmt.Println()

	c := exec.Command(claude, args...)
	c.Env = env
	c.Stdin, c.Stdout, c.Stderr = os.Stdin, os.Stdout, os.Stderr
	return c.Run()
}

// runHelmsmanDoctor runs the NEXUS doctor and then the operator-core doctor.
func runHelmsmanDoctor(cmd *cobra.Command, args []string) error {
	_ = runDoctor(cmd, args)
	color.Cyan("\n🩺 Operator doctor\n")
	dir, err := ensureOperator()
	if err != nil {
		color.Yellow("  skipped: %v", err)
		return nil
	}
	if _, err := mustNode(); err != nil {
		color.Yellow("  skipped: %v", err)
		return nil
	}
	if _, err := os.Stat(filepath.Join(dir, "scripts", "doctor.js")); err == nil {
		return runNode(dir, "doctor.js")
	}
	return runNode(dir, "ecc.js", "doctor")
}

func init() {
	rootCmd.AddCommand(operatorCmd)
	rootCmd.AddCommand(setupCmd)
	rootCmd.AddCommand(wireMcpCmd)
	rootCmd.AddCommand(envCmd)
	rootCmd.AddCommand(maxCmd)
}
