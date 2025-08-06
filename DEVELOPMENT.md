# Development Guide

## 🚀 Quick Start Development

```bash
# 1. Install dependencies
cd frontend && npm install
cd ../backend && npm install

# 2. Start in development mode
docker-compose up --build

# 3. Access the application
open http://localhost:8088
```

## 🔧 Development Setup

### Frontend Development

```bash
cd frontend
npm install
npm run dev  # Starts Vite dev server with HMR
```

Key files:
- `src/pages/OrchestratorTerminal.tsx` - Main terminal component
- `src/App.tsx` - Application root
- `vite.config.js` - Vite configuration

### Backend Development

```bash
cd backend
npm install
npm run dev  # Starts with nodemon for auto-reload
```

Key files:
- `server.js` - WebSocket server entry point
- `services/TerminalManager.js` - PTY process management
- `services/OrchestratorCommands.js` - Command processing
- `utils/WebSocketUtils.js` - Message utilities

## 📨 WebSocket Message Protocol

### Client → Server Messages

```javascript
// Initialize orchestrator
{
  type: 'orchestrator-init',
  terminalId: 'orchestrator-main'
}

// Send terminal input
{
  type: 'orchestrator-command',
  subtype: 'terminal-input',
  data: 'ls\r'  // Include \r for enter
}

// Execute orchestrator command
{
  type: 'orchestrator-command',
  command: 'spawn agent-1'
}
```

### Server → Client Messages

```javascript
// Terminal output
{
  type: 'terminal-output',
  terminalId: 'xxx',
  data: 'output text...'
}

// Agent output (for orchestrator terminal)
{
  type: 'agent-output',
  agentId: 'orchestrator-xxx',
  data: 'terminal output...'
}

// Orchestrator response
{
  type: 'orchestrator-response',
  data: 'Command executed',
  success: true
}
```

## 🎮 Orchestrator Commands

Commands processed by the orchestrator (not passed to PTY):

- `spawn <name>` - Create new agent terminal
- `spawn <name> --dir /path` - Spawn in specific directory
- `spawn <name> --project name` - Spawn in project directory
- `status` - Show all active terminals
- `send <agent> "command"` - Send to specific agent
- `broadcast "command"` - Send to all agents
- `logs <agent> [lines]` - View agent logs
- `help` - Show command help

## 🔍 Debugging

### Frontend Debugging

1. Open browser DevTools
2. Check Console for errors
3. Network tab → WS → Check WebSocket messages
4. React DevTools for component state

### Backend Debugging

```bash
# View container logs
docker logs -f xterm-orchestrator-backend

# Enter container shell
docker exec -it xterm-orchestrator-backend bash

# Check PTY processes
ps aux | grep bash

# Test WebSocket connection
wscat -c ws://localhost:8126
```

### Common Issues

**Terminal not accepting input:**
- Check WebSocket connection in browser
- Verify `onData` handler is attached to xterm
- Check backend is receiving `terminal-input` messages

**PTY not starting:**
- Check node-pty installation in container
- Verify bash is available in container
- Check permissions on workspace directories

**WebSocket disconnecting:**
- Check CORS settings
- Verify ports are correctly mapped
- Check Docker network configuration

## 🏗️ Building for Production

```bash
# Build optimized containers
docker-compose build --no-cache

# Start in production mode
docker-compose up -d

# Check health
docker-compose ps
docker-compose logs
```

## 📦 Dependencies

### Frontend Dependencies
```json
{
  "react": "^18.x",
  "xterm": "^5.x",
  "@xterm/addon-fit": "^0.8.x",
  "@xterm/addon-web-links": "^0.9.x",
  "vite": "^5.x"
}
```

### Backend Dependencies
```json
{
  "node-pty": "^1.0.x",
  "ws": "^8.x",
  "uuid": "^9.x",
  "@anthropic-ai/claude-code": "^1.0.69"
}
```

## 🧪 Testing

### Manual Testing Checklist
- [ ] Terminal initializes on connection
- [ ] Can type commands and see output
- [ ] Can run `claude` command
- [ ] Can spawn new agents
- [ ] Agents start in correct directories
- [ ] WebSocket reconnects on disconnect
- [ ] Terminal resizes properly
- [ ] Copy/paste works

### Test Commands
```bash
# Test basic terminal
ls
pwd
echo "Hello World"

# Test Claude
claude --version
claude

# Test orchestrator
spawn test-agent
status
send test-agent "pwd"

# Test directory navigation
cd /projects
ls
```

## 🔄 Hot Reload Setup

Frontend: Vite provides HMR out of the box
Backend: Add nodemon for development:

```json
// backend/package.json
{
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

## 🐳 Docker Development

### Rebuild specific service
```bash
docker-compose build backend
docker-compose up -d backend
```

### View real-time logs
```bash
docker-compose logs -f backend
```

### Clean rebuild
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

## 💻 VS Code Setup (Optional)

`.vscode/launch.json` for debugging:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Docker",
      "port": 9229,
      "address": "localhost",
      "localRoot": "${workspaceFolder}/backend",
      "remoteRoot": "/app",
      "protocol": "inspector"
    }
  ]
}
```

Add to backend Dockerfile for debugging:
```dockerfile
CMD ["node", "--inspect=0.0.0.0:9229", "server.js"]
```