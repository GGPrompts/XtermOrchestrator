# CLAUDE_ORCHESTRATOR_TERMINAL.md

## 🎯 IMPORTANT: You Are Inside the Orchestrator Terminal

You are currently running INSIDE the orchestrator terminal, not in a regular bash shell. This means:

1. **Orchestrator commands are intercepted automatically** - Just type them normally
2. **The terminal accepts orchestrator commands directly** - Type them as regular text
3. **You are the orchestrator** - You control other AI agents from here

## ✅ How to Use Orchestrator Commands

### CORRECT Way (Direct Input):
```
spawn test-agent
status
send test-agent "echo hello"
logs test-agent 10
```

### Or Use Slash Commands:
```
/spawn test-agent
/status
/send test-agent "echo hello"
/logs test-agent 10
```

## 📋 Available Commands

Type these directly in the terminal OR use slash commands:

### Basic Commands
- `ohelp` or `/ohelp` - Show orchestrator help
- `status` or `/ostatus` - Show all active agents
- `spawn <name>` or `/spawn <name>` - Create a new agent terminal
- `spawn-claude <name>` or `/spawn-claude <name>` - Create a Claude AI agent
- `send <agent> "<command>"` or `/send <agent> "<command>"` - Send command to specific agent
- `broadcast "<command>"` or `/broadcast "<command>"` - Send to all agents
- `logs <agent> [lines]` or `/logs <agent> [lines]` - View agent logs
- `destroy <agent>` - Terminate an agent

### Advanced Spawn Options
- `spawn frontend --dir /projects/my-app` - Spawn in specific directory
- `spawn backend --project family-planner` - Spawn in GG project
- `spawn-claude agent --mcp-servers github-official,obsidian` - Claude with MCP

### Gordon Integration (Docker AI)
- `gordon "How should I configure containers?"` or `/gordon "..."` - Ask Gordon for Docker help

## 🧪 Test Sequence

Try these commands in order (type them directly):

1. **Check system status:**
   ```
   status
   ```

2. **Show help:**
   ```
   ohelp
   ```

3. **Spawn a test agent:**
   ```
   spawn test-agent
   ```

4. **Check agent status:**
   ```
   status
   ```

5. **Send command to agent:**
   ```
   send test-agent "pwd"
   ```

6. **View agent logs:**
   ```
   logs test-agent 10
   ```

7. **Spawn Claude agent with MCP:**
   ```
   spawn-claude helper --mcp-servers github-official
   ```

8. **Clean up:**
   ```
   destroy test-agent
   ```

## 🔧 Troubleshooting

If commands aren't working:
1. Check WebSocket connection: The terminal should show "Connected to backend"
2. Look for the prompt: Should show `[Orchestrator]$` or similar
3. Commands are automatically intercepted - just type them normally

## 🎮 Current Environment

- **You are at:** `/` (root of container)
- **Accessible paths:**
  - `/app` - Orchestrator backend code
  - `/projects` - GG projects
  - `/workspaces` - Agent working directories
  - `/shared` - Shared resources

## 💡 Command Interception

The orchestrator terminal now automatically intercepts orchestrator commands:
- When you type `status`, it's recognized as an orchestrator command
- When you type `ls`, it's passed to bash as normal
- Both orchestrator commands AND regular bash commands work seamlessly

## 📚 Slash Commands

This project includes custom slash commands in `.claude/commands/`:
- `/spawn` - Spawn new agent
- `/spawn-claude` - Spawn Claude agent
- `/ostatus` - Show status
- `/send` - Send to agent
- `/broadcast` - Send to all
- `/logs` - View logs
- `/ohelp` - Show help
- `/gordon` - Ask Gordon
- `/handoff` - Transfer control

These slash commands guide you to type the actual orchestrator command in the terminal.