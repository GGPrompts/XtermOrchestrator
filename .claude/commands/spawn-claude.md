---
description: Spawn a Claude AI agent with MCP servers
argument-hint: <agent-name> [--mcp-servers <servers>]
---

Type this orchestrator command directly in the terminal:
```
spawn-claude $ARGUMENTS
```

Examples:
- Basic Claude agent: `spawn-claude helper`
- With GitHub MCP: `spawn-claude dev --mcp-servers github-official`
- Multiple MCPs: `spawn-claude full-stack --mcp-servers github-official,obsidian`