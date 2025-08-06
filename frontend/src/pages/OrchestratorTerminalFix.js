// Frontend Fix for Orchestrator Terminal
// This fixes the terminal input issue in OrchestratorTerminal.tsx

export const OrchestratorTerminalFix = {
    // Fix for terminal initialization
    initializeOrchestrator: (ws) => {
        // Send orchestrator-init message to create the orchestrator terminal
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'orchestrator-init',
                terminalId: 'orchestrator-main'
            }));
            console.log('[Orchestrator] Initialized orchestrator terminal');
        }
    },

    // Fix for terminal input handling
    handleTerminalInput: (ws, data) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Send input as orchestrator-command with terminal-input subtype
            ws.send(JSON.stringify({
                type: 'orchestrator-command',
                subtype: 'terminal-input',
                data: data
            }));
        }
    },

    // Fix for command execution
    executeCommand: (ws, command) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Send as orchestrator-command
            ws.send(JSON.stringify({
                type: 'orchestrator-command',
                command: command
            }));
        }
    },

    // Fix for spawn-claude command
    spawnClaude: (ws, agentName, options = {}) => {
        let command = `spawn-claude ${agentName}`;
        
        if (options.systemPrompt) {
            command += ` --system-prompt "${options.systemPrompt}"`;
        }
        
        if (options.dir) {
            command += ` --dir ${options.dir}`;
        }
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'orchestrator-command',
                command: command
            }));
        }
    },

    // Fix for starting Claude CLI in the orchestrator terminal
    startClaude: (ws) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Send 'claude' command to start CLI
            ws.send(JSON.stringify({
                type: 'orchestrator-command',
                subtype: 'terminal-input',
                data: 'claude\r'
            }));
        }
    }
};

// Apply fixes to the existing OrchestratorTerminal component
export const applyFixes = (xtermRef, wsRef) => {
    // Override the onData handler to properly send input
    if (xtermRef.current) {
        const originalOnData = xtermRef.current.onData;
        
        xtermRef.current.onData((data) => {
            // Send to backend properly
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'orchestrator-command',
                    subtype: 'terminal-input',
                    data: data
                }));
            }
        });
    }
    
    // Ensure orchestrator is initialized when connection opens
    if (wsRef.current) {
        const originalOnOpen = wsRef.current.onopen;
        
        wsRef.current.onopen = (event) => {
            // Call original handler if exists
            if (originalOnOpen) {
                originalOnOpen.call(wsRef.current, event);
            }
            
            // Initialize orchestrator
            OrchestratorTerminalFix.initializeOrchestrator(wsRef.current);
        };
    }
};
