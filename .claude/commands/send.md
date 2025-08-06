---
description: Send a command to a specific agent
argument-hint: <agent-name> "<command>"
---

Type this orchestrator command directly in the terminal:
```
send $ARGUMENTS
```

Examples:
- Send to one agent: `send test-agent "pwd"`
- Run npm install: `send frontend "npm install"`
- Start dev server: `send backend "npm run dev"`