---
description: Send a command to all active agents
argument-hint: "<command>"
---

Type this orchestrator command directly in the terminal:
```
broadcast $ARGUMENTS
```

Examples:
- Update all agents: `broadcast "git pull"`
- Install deps everywhere: `broadcast "npm install"`
- Check status: `broadcast "pwd"`