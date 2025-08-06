/**
 * Unified Orchestrator Terminal
 * 
 * Single terminal interface where the user interacts with the orchestrator
 * The orchestrator manages all AI agents, terminals, and tasks
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import ChatInterface from '../components/ChatInterface';
import OrchestratorChatDisplay, { ChatMessage } from '../components/OrchestratorChatDisplay';
import Navigation from '../components/Navigation';
import AgentTerminalPanel, { AgentTerminal } from '../components/AgentTerminalPanel';
import TerminalHistory from '../components/TerminalHistory';
import { TerminalUI, ANSI, CheckboxOption, MenuOption } from '../utils/terminalUI';
import styles from './OrchestratorTerminal.module.css';

interface AgentStatus {
    id: string;
    name: string;
    status: 'idle' | 'working' | 'completed' | 'error';
    currentTask?: string;
    lastUpdate?: string;
    hidden?: boolean;
}

interface QueuedPrompt {
    id: string;
    prompt: string;
    targetAgent?: string;
    priority: 'high' | 'medium' | 'low';
    status: 'queued' | 'processing' | 'completed';
}

interface TabSession {
    id: string;
    name: string;
    terminal: Terminal | null;
    content: string[];
    isActive: boolean;
}

export default function OrchestratorTerminal() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const connectionAttempts = useRef(0);
    
    const [agents, setAgents] = useState<AgentStatus[]>([]);
    const [promptQueue, setPromptQueue] = useState<QueuedPrompt[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [terminals, setTerminals] = useState<any[]>([]);
    const [isInteractiveMode, setIsInteractiveMode] = useState(false);
    const [autoExecute, setAutoExecute] = useState(false); // Toggle for auto-execution
    const [showPasteHelper, setShowPasteHelper] = useState(false);
    const [pasteValue, setPasteValue] = useState('');
    const [showQuickCommands, setShowQuickCommands] = useState(true);
    const [showTerminalHistory, setShowTerminalHistory] = useState(false);
    const [tabs, setTabs] = useState<TabSession[]>([
        {
            id: 'main',
            name: 'Main',
            terminal: null,
            content: [],
            isActive: true
        }
    ]);
    const [activeTabId, setActiveTabId] = useState('main');
    const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [splitLayout, setSplitLayout] = useState<'none' | 'horizontal' | 'vertical'>('none');
    const [visibleAgents, setVisibleAgents] = useState<Set<string>>(new Set());
    const [agentTerminals, setAgentTerminals] = useState<AgentTerminal[]>([]);
    const [mcpServers, setMcpServers] = useState<CheckboxOption[]>([
        { label: 'GitHub Official', value: 'github-official', checked: true, description: '80 tools' },
        { label: 'Docker Hub', value: 'dockerhub', checked: true, description: '13 tools' },
        { label: 'Context7', value: 'context7', checked: true, description: '2 tools' },
        { label: 'Wikipedia', value: 'wikipedia-mcp', checked: true, description: '9 tools' }
    ]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [showChatDisplay, setShowChatDisplay] = useState(false);

    // Create a new tab
    const createTab = (name: string) => {
        const newTab: TabSession = {
            id: `tab-${Date.now()}`,
            name,
            terminal: null,
            content: [],
            isActive: false
        };
        
        setTabs(prev => [...prev, newTab]);
        switchToTab(newTab.id);
    };

    // Switch to a different tab
    const switchToTab = useCallback((tabId: string) => {
        if (tabId === activeTabId) return; // Already on this tab

        // Save current terminal content
        setTabs(prev => {
            const updatedTabs = prev.map(tab => {
                if (tab.id === activeTabId && xtermRef.current) {
                    // Store terminal buffer content for current tab
                    const buffer = xtermRef.current.buffer;
                    const content: string[] = [];
                    for (let i = 0; i < buffer.active.length; i++) {
                        const line = buffer.active.getLine(i);
                        if (line) {
                            content.push(line.translateToString(true));
                        }
                    }
                    return { ...tab, content, isActive: false };
                } else if (tab.id === tabId) {
                    return { ...tab, isActive: true };
                } else {
                    return { ...tab, isActive: false };
                }
            });
            return updatedTabs;
        });

        // Clear and restore terminal content
        setTimeout(() => {
            if (xtermRef.current) {
                xtermRef.current.clear();
                
                const newActiveTab = tabs.find(t => t.id === tabId);
                if (newActiveTab) {
                    // Restore saved content
                    if (newActiveTab.content.length > 0) {
                        newActiveTab.content.forEach(line => {
                            xtermRef.current?.writeln(line);
                        });
                    } else if (isConnected) {
                        // If empty, show prompt
                        xtermRef.current.write('orchestrator> ');
                    }
                }
            }
        }, 0);

        setActiveTabId(tabId);
    }, [activeTabId, tabs, isConnected]);

    // Close a tab
    const closeTab = (tabId: string) => {
        if (tabs.length <= 1) return; // Keep at least one tab
        
        const tabIndex = tabs.findIndex(t => t.id === tabId);
        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);
        
        // If closing active tab, switch to another
        if (tabId === activeTabId) {
            const newActiveIndex = Math.max(0, tabIndex - 1);
            switchToTab(newTabs[newActiveIndex].id);
        }
    };

    // Rename a tab
    const renameTab = (tabId: string, newName: string) => {
        setTabs(prev => prev.map(t => 
            t.id === tabId ? { ...t, name: newName } : t
        ));
    };

    // Resume a Claude session
    const handleResumeSession = async (sessionId: string, agentName: string): Promise<boolean> => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.error('[Orchestrator] Not connected to backend');
            return false;
        }

        try {
            const response = await fetch(`http://localhost:8126/resume-session/${sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    agentName: agentName,
                    mcpServers: [] // Could be enhanced to remember original MCP servers
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`[Orchestrator] Successfully resumed session: ${result.message}`);
                
                // Add to agents list
                const newAgent: AgentStatus = {
                    id: result.terminalId,
                    name: agentName,
                    status: 'idle',
                    lastUpdate: new Date().toISOString(),
                    hidden: false
                };
                setAgents(prev => [...prev, newAgent]);
                
                // Show success message in terminal
                if (xtermRef.current) {
                    xtermRef.current.writeln(`\r\n✅ Resumed Claude session: ${agentName} (${sessionId.substring(0, 8)}...)`);
                    xtermRef.current.write('[Orchestrator]$ ');
                }
                
                return true;
            } else {
                const error = await response.json();
                console.error('[Orchestrator] Failed to resume session:', error);
                
                if (xtermRef.current) {
                    xtermRef.current.writeln(`\r\n❌ Failed to resume session: ${error.error}`);
                    xtermRef.current.write('[Orchestrator]$ ');
                }
                
                return false;
            }
        } catch (error) {
            console.error('[Orchestrator] Error resuming session:', error);
            
            if (xtermRef.current) {
                xtermRef.current.writeln(`\r\n❌ Error resuming session: ${error.message}`);
                xtermRef.current.write('[Orchestrator]$ ');
            }
            
            return false;
        }
    };

    // Show agent terminal in split view
    const showAgentTerminal = (agentId: string) => {
        setVisibleAgents(prev => new Set([...prev, agentId]));
        
        // Auto-select split layout if none selected
        if (splitLayout === 'none') {
            setSplitLayout('horizontal');
        }

        // Create agent terminal entry if not exists
        const agent = agents.find(a => a.id === agentId);
        if (agent && !agentTerminals.find(at => at.id === agentId)) {
            setAgentTerminals(prev => [...prev, {
                id: agentId,
                name: agent.name,
                status: agent.status,
                isHidden: agent.hidden
            }]);
        }
    };

    // Hide agent terminal
    const hideAgentTerminal = (agentId: string) => {
        setVisibleAgents(prev => {
            const newSet = new Set(prev);
            newSet.delete(agentId);
            return newSet;
        });

        // If no more visible agents, hide split
        if (visibleAgents.size <= 1) {
            setSplitLayout('none');
        }
    };

    // Add message to chat display
    const addChatMessage = (
        type: ChatMessage['type'],
        source: string,
        content: string,
        metadata?: ChatMessage['metadata']
    ) => {
        const newMessage: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random()}`,
            type,
            source,
            content,
            timestamp: new Date(),
            metadata
        };
        setChatMessages(prev => [...prev, newMessage]);
    };

    // Pop out agent terminal to new window
    const popOutAgentTerminal = (agentId: string) => {
        // Create a new window with the agent terminal
        const agent = agents.find(a => a.id === agentId);
        if (!agent) return;

        const popoutWindow = window.open(
            '',
            `agent-${agentId}`,
            'width=800,height=600,menubar=no,toolbar=no,location=no,status=no'
        );

        if (popoutWindow) {
            popoutWindow.document.title = `Agent: ${agent.name}`;
            popoutWindow.document.body.innerHTML = `
                <div style="width: 100%; height: 100%; background: #1a1a2e; color: #fff; font-family: monospace;">
                    <div id="terminal-container" style="width: 100%; height: 100%;"></div>
                </div>
            `;
            
            // TODO: Initialize terminal in pop-out window
            // This would require passing the terminal state to the new window
        }

        // Remove from split view
        hideAgentTerminal(agentId);
    };

    // Initialize the orchestrator terminal
    useEffect(() => {
        if (!terminalRef.current || xtermRef.current) return;

        // Create XTerm instance with orchestrator theme
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            theme: {
                background: '#0a0e27',
                foreground: '#00ff41',
                cursor: '#00ff41',
                selection: 'rgba(0, 255, 65, 0.3)',
                black: '#000000',
                red: '#ff0044',
                green: '#00ff41',
                yellow: '#ffff00',
                blue: '#0080ff',
                magenta: '#ff00ff',
                cyan: '#00ffff',
                white: '#ffffff',
                brightBlack: '#808080',
                brightRed: '#ff6666',
                brightGreen: '#66ff66',
                brightYellow: '#ffff66',
                brightBlue: '#6666ff',
                brightMagenta: '#ff66ff',
                brightCyan: '#66ffff',
                brightWhite: '#ffffff'
            }
        });

        // Add addons
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());

        // Open terminal
        term.open(terminalRef.current);
        fitAddon.fit();

        // Store refs
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Set up input handler immediately after terminal is created
        const onDataDisposable = term.onData((data) => {
            // Send all input to backend PTY
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'orchestrator-command',
                    subtype: 'terminal-input',
                    data: data
                }));
            }
        });

        // Reset connection attempts on new mount
        connectionAttempts.current = 0;

        // Connect to backend
        connectToBackend();

        // Handle window resize and container changes
        const handleResize = () => {
            if (fitAddonRef.current && terminalRef.current) {
                // Use a small delay to ensure container has finished resizing
                setTimeout(() => {
                    fitAddonRef.current?.fit();
                }, 100);
            }
        };
        
        window.addEventListener('resize', handleResize);
        
        // Use ResizeObserver to watch for container size changes
        const resizeObserver = new ResizeObserver(() => {
            handleResize();
        });
        
        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            onDataDisposable.dispose();
            term.dispose();
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    // Connect to orchestrator backend
    const connectToBackend = () => {
        const ws = new WebSocket('ws://localhost:8126');
        
        ws.onopen = () => {
            console.log('[Orchestrator] Connected to backend');
            setIsConnected(true);
            
            // Add system message to chat
            addChatMessage(
                'system',
                'System',
                'Connected to orchestrator backend',
                {}
            );
            
            // Clear the terminal on successful connection
            if (xtermRef.current) {
                xtermRef.current.clear();
            }
            
            // Request orchestrator privileges
            ws.send(JSON.stringify({
                type: 'orchestrator-init',
                capabilities: ['spawn', 'control', 'monitor']
            }));
            
            // Terminal is ready - backend will show prompt
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleBackendMessage(message);
        };

        ws.onerror = (error) => {
            console.error('[Orchestrator] WebSocket error:', error);
            if (xtermRef.current && !isConnected) {
                showConnectionInstructions();
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            if (xtermRef.current && connectionAttempts.current === 0) {
                showConnectionInstructions();
            }
            connectionAttempts.current++;
            // Retry connection
            setTimeout(connectToBackend, 3000);
        };

        wsRef.current = ws;
    };

    // Show helpful connection instructions
    const showConnectionInstructions = () => {
        if (!xtermRef.current) return;
        
        const term = xtermRef.current;
        term.clear();
        
        // Title
        term.writeln('\x1b[1;36m╔════════════════════════════════════════════════════════════════╗\x1b[0m');
        term.writeln('\x1b[1;36m║                  \x1b[1;33mAI Agent Launchpad Orchestrator\x1b[1;36m               ║\x1b[0m');
        term.writeln('\x1b[1;36m╚════════════════════════════════════════════════════════════════╝\x1b[0m');
        term.writeln('');
        
        // Connection issue
        term.writeln('\x1b[1;31m⚠ Backend not connected\x1b[0m');
        term.writeln('');
        
        // Instructions
        term.writeln('\x1b[1;32mTo start the orchestrator:\x1b[0m');
        term.writeln('');
        term.writeln('  1. Open a terminal in the project directory:');
        term.writeln('     \x1b[0;33mcd /path/to/ai-agent-launchpad/isolated-logging\x1b[0m');
        term.writeln('');
        term.writeln('  2. Start the Docker containers:');
        term.writeln('     \x1b[0;33mdocker-compose up -d\x1b[0m');
        term.writeln('');
        term.writeln('  3. Check container status:');
        term.writeln('     \x1b[0;33mdocker-compose ps\x1b[0m');
        term.writeln('');
        term.writeln('  4. View logs if needed:');
        term.writeln('     \x1b[0;33mdocker logs -f terminal_backend\x1b[0m');
        term.writeln('');
        term.writeln('\x1b[1;36mExpected containers:\x1b[0m');
        term.writeln('  • \x1b[0;32mterminal_backend\x1b[0m    (orchestrator service)');
        term.writeln('  • \x1b[0;32mmultiterminals_frontend\x1b[0m (this UI)');
        term.writeln('');
        term.writeln('\x1b[1;33mRetrying connection...\x1b[0m');
        term.writeln('');
    };

    // Handle messages from backend
    const handleBackendMessage = (message: any) => {
        switch (message.type) {
            case 'agent-update':
                updateAgentStatus(message.agentId, message.status);
                // Add to chat display
                addChatMessage(
                    'agent-update',
                    message.agentId || 'Unknown Agent',
                    `Status: ${message.status.status}${message.status.currentTask ? ' - ' + message.status.currentTask : ''}`,
                    { agentId: message.agentId, status: message.status.status }
                );
                break;
            case 'terminal-output':
                // For orchestrator terminal output, write directly to xterm
                if (xtermRef.current) {
                    xtermRef.current.write(message.data);
                }
                // Parse for Claude commands (detect claude prompts)
                if (message.data && typeof message.data === 'string') {
                    // Check if this looks like a Claude command
                    if (message.data.includes('claude') || message.data.includes('$')) {
                        const cleanData = message.data.replace(/\r\n|\r|\n/g, ' ').trim();
                        if (cleanData.length > 2 && cleanData !== '[Orchestrator]$') {
                            addChatMessage(
                                'claude-command',
                                'Claude Code',
                                cleanData,
                                {}
                            );
                        }
                    }
                }
                break;
            case 'agent-output':
                // Check if this is the orchestrator terminal output
                // The backend creates terminals with IDs like 'terminal-xxxxx' for the orchestrator
                if (message.agentId && (message.agentId.startsWith('orchestrator-') || message.agentId.startsWith('terminal-'))) {
                    // This is output from the orchestrator terminal itself
                    if (xtermRef.current) {
                        xtermRef.current.write(message.data);
                    }
                } else {
                    // Route agent output to the appropriate terminal
                    const agentTerminal = agentTerminals.find(at => at.id === message.agentId);
                    if (agentTerminal && agentTerminal.terminal) {
                        agentTerminal.terminal.write(message.data);
                    }
                    // Also display in orchestrator if not in split view
                    if (!visibleAgents.has(message.agentId) && xtermRef.current) {
                        xtermRef.current.writeln(`\r\n\x1b[1;34m[${message.agentId}]\x1b[0m ${message.data}`);
                    }
                }
                // Add agent messages to chat display
                if (message.data && typeof message.data === 'string') {
                    const cleanData = message.data.replace(/\r\n|\r|\n/g, ' ').trim();
                    if (cleanData.length > 0) {
                        const agent = agents.find(a => a.id === message.agentId);
                        addChatMessage(
                            'agent-message',
                            agent?.name || message.agentId,
                            cleanData,
                            { agentId: message.agentId }
                        );
                    }
                }
                break;
            case 'orchestrator-response':
                if (xtermRef.current && !isInteractiveMode) {
                    // Handle new format where data might be an object with {data, success}
                    let displayText = '';
                    if (typeof message.data === 'string') {
                        displayText = message.data;
                    } else if (message.data && typeof message.data.data === 'string') {
                        displayText = message.data.data;
                    } else {
                        displayText = String(message.data || '');
                    }
                    
                    const formattedData = displayText.split('\n').map(line => line + '\r\n').join('');
                    xtermRef.current.write(`\r\n${formattedData}`);
                    xtermRef.current.write('[Orchestrator]$ ');
                    
                    // Add to chat display
                    if (displayText.length > 0) {
                        addChatMessage(
                            'claude-response',
                            'Orchestrator',
                            displayText,
                            {}
                        );
                    }
                }
                break;
            case 'queue-update':
                if (message.queue) {
                    // Ensure queue is always an array
                    const queueArray = Array.isArray(message.queue) ? message.queue : [];
                    setPromptQueue(queueArray);
                }
                break;
            case 'orchestrator-ready':
                if (xtermRef.current) {
                    xtermRef.current.writeln(`\r\n\x1b[1;32m${message.message}\x1b[0m\r\n`);
                }
                addChatMessage(
                    'system',
                    'System',
                    message.message || 'Orchestrator ready',
                    {}
                );
                break;
            case 'agent-spawned':
                addChatMessage(
                    'system',
                    'System',
                    `Agent spawned: ${message.agentName || message.agentId}`,
                    { agentId: message.agentId }
                );
                break;
        }
    };

    // Update agent status
    const updateAgentStatus = (agentId: string, status: Partial<AgentStatus>) => {
        setAgents(prev => {
            const existing = prev.find(a => a.id === agentId);
            if (existing) {
                return prev.map(a => a.id === agentId ? { ...a, ...status } : a);
            } else {
                return [...prev, { id: agentId, name: agentId, status: 'idle', ...status }];
            }
        });
    };

    // Display output from agents in the orchestrator terminal
    const displayAgentOutput = (agentId: string, output: string) => {
        if (xtermRef.current) {
            xtermRef.current.writeln(`\r\n\x1b[1;34m[${agentId}]\x1b[0m ${output}`);
        }
    };

    // Handle sending commands to agents or orchestrator via chat interface
    const handleSendCommand = async (command: string, targetIds: string[]): Promise<boolean> => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return false;
        }

        // Check if we're sending to the orchestrator itself
        if (targetIds.includes('orchestrator')) {
            // Send directly to orchestrator terminal
            wsRef.current.send(JSON.stringify({
                type: 'orchestrator-command',
                subtype: 'terminal-input',
                data: command + '\n'
            }));
            
            // Remove orchestrator from targets for agent sending
            targetIds = targetIds.filter(id => id !== 'orchestrator');
        }

        // If there are still agent targets, send to them
        if (targetIds.length > 0) {
            wsRef.current.send(JSON.stringify({
                type: 'orchestrator-command',
                action: 'send-to-agents',
                targets: targetIds,
                command: command
            }));
        }

        return true;
    };

    // Handle paste events
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault();
            const pastedData = e.clipboardData?.getData('text');
            if (pastedData && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'orchestrator-command',
                    subtype: 'terminal-input',
                    data: pastedData
                }));
            }
        };

        // Add paste event listener to the terminal element
        const termElement = terminalRef.current;
        if (termElement) {
            termElement.addEventListener('paste', handlePaste);
        }

        return () => {
            if (termElement) {
                termElement.removeEventListener('paste', handlePaste);
            }
        };
    }, []);

    // Show interactive startup sequence
    const showStartupSequence = async (term: Terminal) => {
        // Clear screen and start fresh
        term.clear();
        term.write(TerminalUI.createBanner());
        term.write('\r\n\r\n');
        
        term.write(`${ANSI.BRIGHT_YELLOW}== Quick Setup ==${ANSI.RESET}\r\n\r\n`);
        
        // Show MCP server status
        term.write(`${ANSI.BRIGHT_CYAN}Docker MCP Toolkit (104+ tools):${ANSI.RESET}\r\n`);
        mcpServers.forEach(server => {
            const status = server.checked ? `${ANSI.BRIGHT_GREEN}[X]` : `${ANSI.DIM}[ ]`;
            term.write(`  ${status} ${server.label} ${ANSI.DIM}(${server.description})${ANSI.RESET}\r\n`);
        });
        term.write(`${ANSI.DIM}  All servers connected via Docker MCP Gateway${ANSI.RESET}\r\n`);
        
        term.write('\r\n');
        term.write(`${ANSI.BRIGHT_YELLOW}== Quick Actions ==${ANSI.RESET}\r\n`);
        term.write(`  ${TerminalUI.formatCommand('spawn <name>')} - Create a new Claude terminal\r\n`);
        term.write(`  ${TerminalUI.formatCommand('chat <message>')} - Send to all terminals\r\n`);
        term.write(`  ${TerminalUI.formatCommand('setup')} - Interactive MCP configuration\r\n`);
        term.write(`  ${TerminalUI.formatCommand('help')} - Show all commands\r\n`);
        
        term.write('\r\n');
        term.write(`${ANSI.DIM}Tip: Terminals can use /agents to access Claude's built-in agents${ANSI.RESET}\r\n`);
        term.write('\r\n');
        term.write('orchestrator> ');
    };

    // Process orchestrator commands
    const processCommand = async (command: string) => {
        const parts = command.trim().split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            xtermRef.current?.writeln('\x1b[1;31mNot connected to backend\x1b[0m');
            return;
        }

        // Handle special 'chat' command to send via unified interface
        if (cmd === 'chat') {
            const message = args.join(' ');
            if (!message) {
                xtermRef.current?.writeln('\x1b[1;31mUsage: chat <message>\x1b[0m');
                return;
            }
            
            // Send to all connected agents via chat interface
            const allAgentIds = agents.filter(a => a.status !== 'error').map(a => a.id);
            if (allAgentIds.length === 0) {
                xtermRef.current?.writeln('\x1b[1;31mNo agents available to receive message\x1b[0m');
                return;
            }
            
            const success = await handleSendCommand(message, allAgentIds);
            if (success) {
                xtermRef.current?.writeln(`\x1b[1;32m✅ Sent via chat: "${message}" to ${allAgentIds.length} agents\x1b[0m`);
            } else {
                xtermRef.current?.writeln('\x1b[1;31m❌ Failed to send message via chat\x1b[0m');
            }
            return;
        }

        // Handle special 'setup' command for interactive MCP configuration
        if (cmd === 'setup') {
            await showMCPSetup();
            return;
        }

        // Send other commands to backend
        wsRef.current.send(JSON.stringify({
            type: 'orchestrator-command',
            command: cmd,
            args: args
        }));
    };

    // Show interactive MCP setup
    const showMCPSetup = async () => {
        if (!xtermRef.current) return;
        const term = xtermRef.current;
        
        setIsInteractiveMode(true);
        term.write(ANSI.CLEAR_SCREEN + ANSI.CURSOR_HOME);
        
        const setupBox = TerminalUI.createBox([
            'MCP Server Configuration',
            '',
            'Use ↑/↓ to navigate, SPACE to toggle, ENTER to save, ESC to cancel'
        ], '⚙️  Setup');
        
        term.write(setupBox);
        term.writeln('');
        
        let selectedIndex = 0;
        const updateDisplay = () => {
            term.write(ANSI.CURSOR_SAVE);
            term.write(ANSI.GOTO(1, 8));
            term.write(TerminalUI.renderCheckboxes(mcpServers, selectedIndex));
            term.write(ANSI.CURSOR_RESTORE);
        };
        
        updateDisplay();
        
        // Handle interactive input
        const handler = term.onData((data) => {
            if (data === '\x1b') { // ESC
                handler.dispose();
                setIsInteractiveMode(false);
                term.write(ANSI.CLEAR_SCREEN + ANSI.CURSOR_HOME);
                showStartupSequence(term);
            } else if (data === '\r') { // ENTER
                handler.dispose();
                setIsInteractiveMode(false);
                term.write(ANSI.CLEAR_SCREEN + ANSI.CURSOR_HOME);
                saveMCPConfiguration();
                showStartupSequence(term);
            } else if (data === ' ') { // SPACE
                const newServers = [...mcpServers];
                newServers[selectedIndex].checked = !newServers[selectedIndex].checked;
                setMcpServers(newServers);
                updateDisplay();
            } else if (data === '\x1b[A') { // UP
                selectedIndex = Math.max(0, selectedIndex - 1);
                updateDisplay();
            } else if (data === '\x1b[B') { // DOWN
                selectedIndex = Math.min(mcpServers.length - 1, selectedIndex + 1);
                updateDisplay();
            }
        });
    };

    // Save MCP configuration
    const saveMCPConfiguration = () => {
        if (!xtermRef.current || !wsRef.current) return;
        
        const enabledServers = mcpServers.filter(s => s.checked);
        const config = enabledServers.reduce((acc, server) => {
            acc[server.value] = true;
            return acc;
        }, {} as Record<string, boolean>);
        
        xtermRef.current.writeln(`${ANSI.BRIGHT_GREEN}✓ MCP Configuration saved!${ANSI.RESET}`);
        xtermRef.current.writeln(`  Enabled: ${enabledServers.map(s => s.label).join(', ')}`);
        xtermRef.current.writeln('');
        
        // Send configuration to backend
        wsRef.current.send(JSON.stringify({
            type: 'mcp-config-update',
            config: config
        }));
    };

    return (
        <div className={styles.orchestratorPage}>
            <Navigation />
            <header className={styles.header}>
                <h1>Orchestrator Terminal</h1>
                <div className={styles.status}>
                    <button 
                        className={styles.historyButton}
                        onClick={() => setShowTerminalHistory(true)}
                        title="View terminal history"
                    >
                        📜 History
                    </button>
                    <span className={isConnected ? styles.connected : styles.disconnected}>
                        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                    </span>
                    <span className={styles.agentCount}>
                        {agents.length} Agents Active
                    </span>
                </div>
            </header>

            <div className={styles.mainContent}>
                {/* Left Sidebar with Chat, Status, and Queue */}
                <div className={styles.leftSidebar}>
                    {/* Control Toggles */}
                    <div className={styles.sidebarControls}>
                        <label className={styles.autoExecuteToggle}>
                            <input 
                                type="checkbox" 
                                checked={autoExecute}
                                onChange={(e) => setAutoExecute(e.target.checked)}
                            />
                            <span>{autoExecute ? '🟢' : '🔴'} Auto-execute {autoExecute ? 'ON' : 'OFF'}</span>
                        </label>
                        <label className={styles.toggleOption}>
                            <input 
                                type="checkbox" 
                                checked={showQuickCommands}
                                onChange={(e) => setShowQuickCommands(e.target.checked)}
                            />
                            <span>Quick Commands</span>
                        </label>
                        <label className={styles.toggleOption}>
                            <input 
                                type="checkbox" 
                                checked={showChatDisplay}
                                onChange={(e) => setShowChatDisplay(e.target.checked)}
                            />
                            <span>Activity Feed</span>
                        </label>
                    </div>

                    {/* Active Agents */}
                    <div className={styles.statusSection}>
                        <h3>Active Agents</h3>
                        <div className={styles.agentList}>
                            {agents.map(agent => (
                                <div key={agent.id} className={`${styles.agentCard} ${styles[agent.status]}`}>
                                    <div className={styles.agentHeader}>
                                        <div>
                                            <div className={styles.agentName}>
                                                {agent.name}
                                                {agent.hidden && <span className={styles.hiddenBadge}> 👁️‍🗨️</span>}
                                            </div>
                                            <div className={styles.agentStatus}>{agent.status}</div>
                                        </div>
                                        <div className={styles.agentActions}>
                                            {!agent.hidden && (
                                                <button
                                                    className={styles.viewBtn}
                                                    onClick={() => {
                                                        if (visibleAgents.has(agent.id)) {
                                                            hideAgentTerminal(agent.id);
                                                        } else {
                                                            showAgentTerminal(agent.id);
                                                        }
                                                    }}
                                                    title={visibleAgents.has(agent.id) ? "Hide terminal" : "Show terminal"}
                                                >
                                                    {visibleAgents.has(agent.id) ? '◲' : '◱'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {agent.currentTask && (
                                        <div className={styles.agentTask}>{agent.currentTask}</div>
                                    )}
                                </div>
                            ))}
                            {agents.length === 0 && (
                                <div className={styles.noAgents}>
                                    No agents active. Use 'spawn' to create one!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Prompt Queue */}
                    <div className={styles.queueSection}>
                        <h3>Prompt Queue</h3>
                        <div className={styles.queueList}>
                            {(promptQueue || []).map(prompt => (
                                <div key={prompt.id} className={`${styles.queueItem} ${styles[prompt.status]}`}>
                                    <div className={styles.promptText}>
                                        {prompt.prompt}
                                    </div>
                                    <div className={styles.promptMeta}>
                                        <span className={styles.promptPriority} data-priority={prompt.priority}>{prompt.priority}</span>
                                        {prompt.targetAgent && <span>→ {prompt.targetAgent}</span>}
                                    </div>
                                </div>
                            ))}
                            {promptQueue.length === 0 && (
                                <div className={styles.emptyQueue}>
                                    Queue empty. Use 'queue' to add tasks!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chat Interface or Activity Feed */}
                    <div className={styles.chatSection}>
                        {showChatDisplay ? (
                            <OrchestratorChatDisplay
                                messages={chatMessages}
                                maxMessages={100}
                                autoScroll={true}
                                showTimestamps={true}
                            />
                        ) : (
                            <ChatInterface
                                terminals={[
                                    // Include the orchestrator itself as a target
                                    {
                                        id: 'orchestrator',
                                        terminalId: 'orchestrator',
                                        title: '🎯 Orchestrator',
                                        workbranchId: '',
                                        connected: isConnected
                                    },
                                    // Include all agents
                                    ...agents.map(a => ({
                                        id: a.id,
                                        terminalId: a.id,
                                        title: a.name,
                                        workbranchId: '',
                                        connected: a.status !== 'error'
                                    }))
                                ]}
                                onSendCommand={handleSendCommand}
                                showHistory={true}
                                showQuickCommands={showQuickCommands}
                            />
                        )}
                    </div>
                </div>

                {/* Main Container with Split Support */}
                <div className={`${styles.splitContainer} ${styles[`split-${splitLayout}`]}`}>
                    {/* Orchestrator Terminal */}
                    <div className={styles.terminalSection}>
                    {/* Tab Bar */}
                    <div className={styles.tabBar}>
                        {tabs.map(tab => (
                            <div 
                                key={tab.id}
                                className={`${styles.tab} ${tab.id === activeTabId ? styles.activeTab : ''}`}
                                onClick={() => switchToTab(tab.id)}
                                onDoubleClick={() => {
                                    setRenamingTabId(tab.id);
                                    setRenameValue(tab.name);
                                }}
                            >
                                {renamingTabId === tab.id ? (
                                    <input
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={() => {
                                            if (renameValue.trim()) {
                                                renameTab(tab.id, renameValue.trim());
                                            }
                                            setRenamingTabId(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (renameValue.trim()) {
                                                    renameTab(tab.id, renameValue.trim());
                                                }
                                                setRenamingTabId(null);
                                            } else if (e.key === 'Escape') {
                                                setRenamingTabId(null);
                                            }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className={styles.tabRenameInput}
                                        autoFocus
                                    />
                                ) : (
                                    <span className={styles.tabName}>{tab.name}</span>
                                )}
                                {tabs.length > 1 && (
                                    <button
                                        className={styles.tabClose}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            closeTab(tab.id);
                                        }}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                        <button 
                            className={styles.newTabButton}
                            onClick={() => createTab(`Session ${tabs.length + 1}`)}
                        >
                            +
                        </button>
                    </div>
                    
                    <div ref={terminalRef} className={styles.terminal} />
                    
                    {/* Paste Helper */}
                    <div className={styles.pasteHelper}>
                        <button 
                            className={styles.pasteButton}
                            onClick={() => setShowPasteHelper(!showPasteHelper)}
                        >
                            {showPasteHelper ? 'Hide' : 'Show'} Paste Helper
                        </button>
                        
                        {showPasteHelper && (
                            <div className={styles.pasteForm}>
                                <input
                                    type="text"
                                    placeholder="Paste OAuth code or long text here..."
                                    value={pasteValue}
                                    onChange={(e) => setPasteValue(e.target.value)}
                                    className={styles.pasteInput}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && pasteValue) {
                                            // Send to terminal
                                            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                                                wsRef.current.send(JSON.stringify({
                                                    type: 'orchestrator-command',
                                                    subtype: 'terminal-input',
                                                    data: pasteValue
                                                }));
                                                setPasteValue('');
                                                setShowPasteHelper(false);
                                            }
                                        }
                                    }}
                                />
                                <button
                                    className={styles.sendButton}
                                    onClick={() => {
                                        if (pasteValue && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                                            wsRef.current.send(JSON.stringify({
                                                type: 'orchestrator-command',
                                                subtype: 'terminal-input',
                                                data: pasteValue
                                            }));
                                            setPasteValue('');
                                            setShowPasteHelper(false);
                                        }
                                    }}
                                >
                                    Send to Terminal
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Agent Terminals Split View */}
                {splitLayout !== 'none' && visibleAgents.size > 0 && (
                    <div className={styles.agentTerminalsSection}>
                        <div className={styles.splitControls}>
                            <button
                                className={`${styles.layoutBtn} ${splitLayout === 'horizontal' ? styles.active : ''}`}
                                onClick={() => setSplitLayout('horizontal')}
                                title="Horizontal split"
                            >
                                ═
                            </button>
                            <button
                                className={`${styles.layoutBtn} ${splitLayout === 'vertical' ? styles.active : ''}`}
                                onClick={() => setSplitLayout('vertical')}
                                title="Vertical split"
                            >
                                ║
                            </button>
                            <button
                                className={styles.layoutBtn}
                                onClick={() => {
                                    setSplitLayout('none');
                                    setVisibleAgents(new Set());
                                }}
                                title="Close split view"
                            >
                                ✕
                            </button>
                        </div>
                        <div className={styles.agentTerminalsGrid}>
                            {Array.from(visibleAgents).map(agentId => {
                                const agentTerminal = agentTerminals.find(at => at.id === agentId);
                                if (!agentTerminal) return null;
                                
                                return (
                                    <AgentTerminalPanel
                                        key={agentId}
                                        agent={agentTerminal}
                                        layout={visibleAgents.size > 1 ? splitLayout as any : 'full'}
                                        onClose={hideAgentTerminal}
                                        onPopOut={popOutAgentTerminal}
                                        onMinimize={(id) => {}}
                                        wsConnection={wsRef.current}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
                </div>
            </div>
            
            {/* Terminal History Modal */}
            <TerminalHistory 
                isVisible={showTerminalHistory}
                onClose={() => setShowTerminalHistory(false)}
                onResumeSession={handleResumeSession}
            />
        </div>
    );
}