---
description: Transfer control between agents
argument-hint: <from-agent> <to-agent> ["context"]
---

Type this orchestrator command directly in the terminal:
```
handoff $ARGUMENTS
```

Examples:
- Basic handoff: `handoff frontend-agent backend-agent`
- With context: `handoff agent-1 agent-2 "API integration needed"`
- Team transition: `handoff dev-agent devops-agent "Ready for deployment"`