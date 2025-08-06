# Standalone XTerm Orchestrator Terminal

A fully functional, standalone web-based terminal orchestrator with xterm.js frontend and PTY backend. **Zero VS Code dependencies!**

## Features

✅ **Real PTY Terminal**: Full bash shell with proper TTY support
✅ **Claude Code CLI Integration**: Run Claude 1.0.69 directly in the terminal
✅ **Multi-Agent Orchestration**: Spawn and manage multiple terminal sessions
✅ **Docker Containerized**: Clean, isolated environment
✅ **Web-Based UI**: React + xterm.js frontend accessible via browser
✅ **Project Directory Support**: Spawn agents in specific project directories
✅ **WebSocket Communication**: Real-time terminal I/O

## Quick Start

```bash
# 1. Clone this repository
cd standalone-xterm-orchestrator

# 2. Start the containers
docker-compose up -d

# 3. Open your browser
open http://localhost:8088

# 4. Start using the terminal!
# Type 'claude' to launch Claude Code CLI
# Type 'help' for orchestrator commands
```

## Architecture

```
┌─────────────────────────────────────┐
│     Browser (http://localhost:8088)  │
│          React + xterm.js            │
└────────────────┬────────────────────┘
                 │ WebSocket
                 ↓
┌─────────────────────────────────────┐
│    Backend (ws://localhost:8126)     │
│         Node.js + node-pty           │
├─────────────────────────────────────┤
│  • TerminalManager - PTY lifecycle   │
│  • OrchestratorCommands - Commands   │
│  • WebSocketUtils - Messaging        │
└─────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────┐
│         Bash Shell / Claude CLI      │
│      Real PTY with full TTY support  │
└─────────────────────────────────────┘
```

## Core Components

### Frontend
- **OrchestratorTerminal.tsx**: Main React component with xterm.js
- **Dependencies**: React, xterm, xterm-addon-fit, xterm-addon-web-links

### Backend  
- **TerminalManager.js**: Manages PTY processes and terminal lifecycle
- **OrchestratorCommands.js**: Handles orchestrator-specific commands
- **WebSocketUtils.js**: Centralized WebSocket messaging
- **Dependencies**: node-pty, ws (WebSocket), uuid

### Docker
- **Frontend Container**: Vite dev server for React app
- **Backend Container**: Node.js with PTY support
- **Volumes**: Persistent workspaces and configuration

## Commands

### Orchestrator Commands
```bash
# Agent Management
spawn <name>                      # Create new terminal agent
spawn <name> --dir /path          # Spawn in specific directory  
spawn <name> --project myproject  # Spawn in project directory
status                           # View all active terminals
send <agent-id> "command"        # Send command to specific agent

# Terminal Control
claude                           # Start Claude Code CLI
exit                            # Exit current session
help                            # Show available commands
```

### Directory Structure
```
/                               # Orchestrator starts here (container root)
├── /app                        # Application code
├── /projects                   # Your projects (mounted)
├── /shared                     # Shared resources
└── /workspaces                 # Agent workspaces
```

## No VS Code Required!

This terminal orchestrator is **completely standalone**:
- ✅ No VS Code extensions
- ✅ No VS Code API dependencies  
- ✅ No .vscode configuration needed
- ✅ Pure web-based terminal interface

## Configuration

### Environment Variables
```yaml
# .env file (optional)
CLAUDE_CODE_OAUTH_TOKEN=your-token-here  # For Claude CLI
TERMINAL_PORT=8126                       # Backend WebSocket port
FRONTEND_PORT=8088                       # Frontend web port
```

### Volume Mounts
Edit `docker-compose.yml` to mount your local directories:
```yaml
volumes:
  - ./your-projects:/projects
  - ./your-shared:/shared
```

## Development

```bash
# Backend development
cd backend
npm install
npm run dev

# Frontend development  
cd frontend
npm install
npm run dev

# Build for production
docker-compose build
docker-compose up -d
```

## License

MIT - Use freely for any purpose!

## Credits

Built with:
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [node-pty](https://github.com/microsoft/node-pty) - PTY bindings
- [React](https://reactjs.org/) - UI framework
- [Docker](https://docker.com/) - Containerization