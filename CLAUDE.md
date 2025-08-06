# CLAUDE.md - AI Assistant Context

This file provides context for Claude or other AI assistants helping with this project.

## 🎯 Project Purpose

This is a **Standalone XTerm Orchestrator** - a web-based terminal emulator with multi-agent orchestration capabilities. It provides:
- Real PTY (pseudo-terminal) support for full bash shell functionality
- Web interface using xterm.js for terminal emulation
- WebSocket communication between frontend and backend
- Support for running Claude Code CLI directly in the browser
- Multi-terminal orchestration for managing multiple agent sessions
- **Automatic command interception** for orchestrator commands
- **Custom slash commands** for Claude Code integration

## 🏗️ Architecture Overview

```
Frontend (Port 8088)          Backend (Port 8126)
┌──────────────────┐         ┌────────────────────┐
│  React + xterm.js│ <-----> │ Node.js + node-pty │
│                  │   WS     │                    │
│  - Terminal UI   │         │  - PTY Management  │
│  - Chat Display  │         │  - Process Spawn   │
│  - Agent Panels  │         │  - Command Router  │
└──────────────────┘         └────────────────────┘
```

## 📁 Project Structure

```
standalone-xterm-orchestrator/
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── pages/         # Main components
│   │   │   └── OrchestratorTerminal.tsx  # Core terminal component
│   │   ├── components/    # Reusable components
│   │   └── App.tsx       # Main app entry
│   └── package.json
│
├── backend/               # Node.js backend server
│   ├── services/
│   │   ├── TerminalManager.js      # PTY lifecycle management
│   │   ├── OrchestratorCommands.js # Command processing
│   │   └── MessageRouter.js        # WebSocket routing
│   ├── utils/
│   │   └── WebSocketUtils.js       # Messaging utilities
│   ├── server.js         # Main server entry
│   └── package.json
│
├── docker/               # Docker configurations
├── docker-compose.yml    # Container orchestration
└── start.sh             # Startup script
```

## 🔧 Key Technologies

- **Frontend**: React, TypeScript, xterm.js, xterm-addon-fit, xterm-addon-web-links
- **Backend**: Node.js, node-pty, ws (WebSocket), uuid
- **Containerization**: Docker, docker-compose
- **Terminal**: Bash shell, Claude Code CLI integration

## 💡 How It Works

1. **Terminal Creation**: When a user connects, the backend creates a PTY process
2. **WebSocket Communication**: All terminal I/O flows through WebSocket messages
3. **Command Processing**: Special orchestrator commands are intercepted and processed
4. **PTY Pass-through**: Regular terminal input is passed directly to the PTY process
5. **Output Streaming**: PTY output is streamed back to the frontend via WebSocket

## 🚀 Current Features

- ✅ Full terminal emulation with real PTY
- ✅ Claude Code CLI v1.0.69 integration
- ✅ Multi-terminal spawning and management
- ✅ Directory-specific agent spawning
- ✅ WebSocket-based real-time communication
- ✅ Docker containerization
- ✅ Persistent workspaces

## 🔨 Common Development Tasks

### Adding a New Command
1. Edit `backend/services/OrchestratorCommands.js`
2. Add command handler in the switch statement
3. Implement the handler method

### Modifying Terminal Behavior
1. Edit `backend/services/TerminalManager.js`
2. Adjust PTY spawn options or lifecycle management

### Updating Frontend UI
1. Edit `frontend/src/pages/OrchestratorTerminal.tsx`
2. Modify xterm configuration or add UI elements

### Adding WebSocket Messages
1. Define new message type in `backend/utils/WebSocketUtils.js`
2. Handle in frontend's `handleBackendMessage` function

## 🐛 Known Issues & Solutions

### Issue: Terminal input not working
**Solution**: The terminal input handler must be set up immediately after xterm initialization, not in a separate useEffect

### Issue: Directory paths in container
**Solution**: Container paths map as follows:
- `/app` → Backend code
- `/projects` → Mounted project directories
- `/workspaces` → Agent workspaces

### Issue: Claude authentication
**Solution**: Claude generates OAuth token automatically on first run - no manual token needed

## 🔮 Future Enhancements

- [ ] Terminal replay/recording
- [ ] Multi-user support
- [ ] Terminal sharing/collaboration
- [ ] Custom theme support
- [ ] Plugin system for extending commands
- [ ] Better error handling and recovery
- [ ] Session persistence across restarts

## 📝 Important Notes

1. **No VS Code Dependencies**: This project is completely standalone
2. **Port Configuration**: Frontend on 8088, Backend on 8126
3. **Docker Required**: The system runs in Docker containers
4. **Claude Integration**: Uses local installation in container

## 🤝 Contributing Guidelines

When making changes:
1. Maintain the separation between frontend and backend
2. Keep WebSocket messages well-documented
3. Test both in development and Docker environments
4. Update this CLAUDE.md if architecture changes

## 🆘 Getting Help

If you're an AI assistant working on this project:
1. Read this entire file first
2. Check DEVELOPMENT.md for technical details
3. Review ARCHITECTURE.md for system design
4. Look at TODO.md for planned features
5. The main complexity is in WebSocket message flow and PTY management