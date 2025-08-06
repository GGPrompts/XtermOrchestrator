# System Architecture

## 🏛️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│                    http://localhost:8088                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/WebSocket
┌──────────────────────────┴──────────────────────────────────┐
│                     Frontend Container                       │
│                   (xterm-orchestrator-frontend)              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  React Application                                      │ │
│  │  - OrchestratorTerminal.tsx (Main Component)          │ │
│  │  - xterm.js (Terminal Emulator)                       │ │
│  │  - WebSocket Client                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │ WebSocket (ws://localhost:8126)
┌──────────────────────────┴──────────────────────────────────┐
│                     Backend Container                        │
│                  (xterm-orchestrator-backend)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Node.js Server                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  TerminalManager                                  │ │ │
│  │  │  - PTY Process Creation                          │ │ │
│  │  │  - Terminal Lifecycle                            │ │ │
│  │  │  - Process Monitoring                            │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  OrchestratorCommands                            │ │ │
│  │  │  - Command Parsing                               │ │ │
│  │  │  - Agent Spawning                                │ │ │
│  │  │  - Inter-Agent Communication                     │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  MessageRouter                                    │ │ │
│  │  │  - WebSocket Message Handling                    │ │ │
│  │  │  - Client Connection Management                  │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  PTY Processes (node-pty)                              │ │
│  │  - Bash Shell                                          │ │
│  │  - Claude CLI                                          │ │
│  │  - Agent Processes                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

### 1. Terminal Input Flow
```
User Keyboard Input
    ↓
xterm.js onData event
    ↓
WebSocket Message: {type: 'orchestrator-command', subtype: 'terminal-input', data: 'x'}
    ↓
Backend WebSocket Handler
    ↓
OrchestratorCommands._handleTerminalInput()
    ↓
PTY Process write(data)
    ↓
Bash/Claude Process
```

### 2. Terminal Output Flow
```
Bash/Claude Process Output
    ↓
PTY Process onData event
    ↓
TerminalManager Output Handler
    ↓
WebSocket Message: {type: 'terminal-output', data: 'output'}
    ↓
Frontend WebSocket Handler
    ↓
xterm.js write(data)
    ↓
User Display
```

### 3. Command Processing Flow
```
User Types Command + Enter
    ↓
Is it an Orchestrator Command?
    ├─ Yes → OrchestratorCommands processes
    │        (spawn, status, send, etc.)
    └─ No → Pass to PTY Process
            → Bash executes command
```

## 🗂️ Component Responsibilities

### Frontend Components

#### OrchestratorTerminal.tsx
- **Purpose**: Main terminal UI component
- **Responsibilities**:
  - Initialize xterm.js terminal
  - Manage WebSocket connection
  - Handle user input/output
  - Render terminal display
  - Process orchestrator responses

#### App.tsx
- **Purpose**: Application root
- **Responsibilities**:
  - Route management
  - Global state (if needed)
  - Component composition

### Backend Services

#### TerminalManager.js
- **Purpose**: Manage PTY processes
- **Responsibilities**:
  - Create/destroy PTY processes
  - Handle process I/O
  - Monitor process health
  - Manage terminal metadata
  - Handle process cleanup

#### OrchestratorCommands.js
- **Purpose**: Process orchestrator commands
- **Responsibilities**:
  - Parse commands
  - Execute orchestrator functions
  - Manage agent spawning
  - Handle inter-agent communication
  - Maintain orchestrator state

#### MessageRouter.js
- **Purpose**: WebSocket message routing
- **Responsibilities**:
  - Accept client connections
  - Route messages to handlers
  - Manage client sessions
  - Handle disconnections

#### WebSocketUtils.js
- **Purpose**: Message utilities
- **Responsibilities**:
  - Standardize message formats
  - Provide send helpers
  - Handle message serialization

## 📦 State Management

### Frontend State
```javascript
// Terminal State
- xtermRef: Terminal instance reference
- wsRef: WebSocket connection reference
- isConnected: Connection status
- agents: Active agent list
- currentDirectory: Current working directory

// UI State  
- activeTab: Current visible terminal
- chatMessages: Chat history
- isLoading: Loading states
```

### Backend State
```javascript
// Terminal Manager State
- terminals: Map<terminalId, terminalInfo>
- terminalTimeouts: Cleanup timers
- maxTerminals: Limit configuration

// Orchestrator State
- orchestratorTerminal: Main terminal reference
- orchestratorTerminalId: Main terminal ID
- agentConnections: Agent WebSocket map
- promptQueue: Command queue
```

## 🔌 Integration Points

### Directory Mounting
```yaml
Host System          →  Container
/home/matt/projects  →  /projects
./workspaces        →  /workspaces  
./backend           →  /app
```

### Port Mapping
```yaml
Host    → Container
8088    → 3000  (Frontend HTTP)
8126    → 8126  (Backend WebSocket)
```

### Environment Variables
```yaml
Frontend:
- VITE_WS_URL: WebSocket endpoint

Backend:
- TERMINAL_PORT: WebSocket port
- CLAUDE_CODE_OAUTH_TOKEN: Claude auth
- NODE_ENV: Environment mode
```

## 🔐 Security Considerations

### Input Sanitization
- Commands are passed through to PTY
- Special orchestrator commands are parsed
- No arbitrary code execution

### Process Isolation
- Each terminal runs in separate PTY
- Docker container isolation
- Limited file system access

### WebSocket Security
- Origin checking (if implemented)
- Connection rate limiting (recommended)
- Message size limits

## 🚦 System Flows

### Terminal Initialization
1. User opens browser to http://localhost:8088
2. React app loads and renders OrchestratorTerminal
3. Component creates xterm.js instance
4. Component establishes WebSocket connection
5. Sends `orchestrator-init` message
6. Backend creates PTY process
7. Backend sends confirmation
8. Terminal ready for input

### Agent Spawning
1. User types `spawn agent-1 --dir /projects/myapp`
2. Command identified as orchestrator command
3. OrchestratorCommands parses arguments
4. TerminalManager creates new PTY
5. PTY starts in specified directory
6. Agent added to tracking
7. Success message sent to user

### Claude Integration
1. User types `claude` in terminal
2. Command passed to PTY
3. Claude CLI starts in PTY
4. User sees authentication prompt
5. OAuth flow completes
6. Claude interactive session begins

## 🔮 Extension Points

### Adding New Commands
- Extend switch statement in OrchestratorCommands
- Add handler method
- Update help text

### Custom Terminal Types
- Extend TerminalManager
- Add new spawn options
- Implement specialized PTY configs

### UI Enhancements
- Modify OrchestratorTerminal.tsx
- Add new React components
- Extend xterm addons

### Message Protocol Extensions
- Add new message types to WebSocketUtils
- Implement handlers in both frontend and backend
- Maintain backward compatibility