/**
 * Multi-Terminal Grid Component - Standalone MCP Backend Version
 * 
 * This component provides a 4-terminal grid interface that connects to the
 * standalone MCP backend via WebSocket for real terminal processes.
 * Adapted from the original VS Code integration to work with standalone backend.
 */

import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { ImageAddon } from '@xterm/addon-image';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { SerializeAddon } from '@xterm/addon-serialize';
import '@xterm/xterm/css/xterm.css';
import styles from './MultiTerminalGrid.module.css';
import ExtendedTerminalCreator, { ExtendedTerminalConfig } from './ExtendedTerminalCreator';

interface TerminalSession {
    id: string;
    terminalId: string; // Backend terminal ID
    workbranchId: string;
    title: string;
    shell: 'powershell' | 'bash' | 'cmd';
    terminal: Terminal;
    fitAddon: FitAddon;
    webglAddon?: WebglAddon;
    searchAddon: SearchAddon;
    imageAddon: ImageAddon;
    clipboardAddon: ClipboardAddon;
    serializeAddon: SerializeAddon;
    connected: boolean;
    element: HTMLDivElement | null;
    createdAt: Date;
    securityEnabled: boolean; // MCP security mode toggle
}

interface MultiTerminalGridProps {
    maxTerminals?: number;
    gridColumns?: number;
    className?: string;
    onTerminalUpdate?: (terminals: TerminalSession[]) => void;
}

interface BackendMessage {
    type: string;
    id?: string;
    terminalId?: string;
    success?: boolean;
    data?: any;
    error?: string;
    command?: string;
}

export interface MultiTerminalGridRef {
    createTerminal: (workbranchId: string, shell?: 'powershell' | 'bash' | 'cmd', title?: string) => Promise<string | null>;
    getSessionCount: () => number;
    searchInTerminal: (sessionId: string, query: string) => boolean;
    searchNext: (sessionId: string) => boolean;
    searchPrevious: (sessionId: string) => boolean;
    exportTerminalContent: (sessionId: string) => string | null;
}

export const MultiTerminalGrid = forwardRef<MultiTerminalGridRef, MultiTerminalGridProps>(({
    maxTerminals = 4,
    gridColumns = 2,
    className = '',
    onTerminalUpdate
}, ref) => {
    const [sessions, setSessions] = useState<Map<string, TerminalSession>>(new Map());
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [backendConnection, setBackendConnection] = useState<WebSocket | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<{
        connected: boolean;
        error?: string;
    }>({ connected: false });
    const [showTerminalCreator, setShowTerminalCreator] = useState(false);
    
    const terminalContainerRef = useRef<HTMLDivElement>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const sessionsRef = useRef<Map<string, TerminalSession>>(sessions);

    // Update sessions ref when sessions change
    useEffect(() => {
        sessionsRef.current = sessions;
    }, [sessions]);

    // Debug component lifecycle
    useEffect(() => {
        console.log('🎬 MultiTerminalGrid mounted');
        return () => {
            console.log('🎬 MultiTerminalGrid unmounting');
        };
    }, []);


    /**
     * Connect to standalone MCP backend with deduplication
     */
    const connectToBackend = useCallback(() => {
        // Prevent duplicate connections by checking existing connection
        if (backendConnection && backendConnection.readyState === WebSocket.OPEN) {
            console.log('[INFO] Already connected to backend, skipping duplicate connection');
            return;
        }

        try {
            console.log('[LINKS] Connecting to standalone MCP backend...');
            const ws = new WebSocket('ws://localhost:8125');
            
            ws.onopen = () => {
                console.log('[OK] Connected to MCP backend');
                setConnectionStatus({ connected: true });
                setBackendConnection(ws);
                console.log('[LINKS] Connection status set to true, sessions.size:', sessions.size);
            };

            ws.onmessage = (event) => {
                try {
                    const message: BackendMessage = JSON.parse(event.data);
                    console.log('📨 MultiTerminal received:', message.type, message);
                    handleBackendMessage(message);
                } catch (error) {
                    console.error('Failed to parse backend message:', error);
                }
            };

            ws.onclose = () => {
                console.log('❌ MCP backend connection closed');
                setConnectionStatus({ connected: false });
                setBackendConnection(null);
                
                // Attempt to reconnect after 3 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    connectToBackend();
                }, 3000);
            };

            ws.onerror = (error) => {
                console.error('MCP backend WebSocket error:', error);
                setConnectionStatus({ 
                    connected: false, 
                    error: 'Failed to connect to MCP backend' 
                });
            };

        } catch (error) {
            console.error('Failed to connect to MCP backend:', error);
            setConnectionStatus({ 
                connected: false, 
                error: 'MCP backend unavailable' 
            });
        }
    }, [backendConnection, sessions.size]);

    /**
     * Handle messages from MCP backend
     */
    const handleBackendMessage = useCallback((message: BackendMessage) => {
        switch (message.type) {
            case 'connection-established':
                console.log('[OK] MCP Backend capabilities:', message.data?.capabilities);
                break;

            case 'terminal-created':
                if (message.success && message.terminalId) {
                    console.log(`[OK] Terminal session created: ${message.terminalId}`);
                    // Update session with real backend terminal ID
                    setSessions(prev => {
                        const newSessions = new Map(prev);
                        console.log('[SEARCH] Looking for pending session among:', Array.from(newSessions.entries()).map(([id, s]) => ({id, terminalId: s.terminalId, title: s.title})));
                        
                        for (const [sessionId, session] of newSessions) {
                            if (session.terminalId === 'pending') {
                                console.log(`[LINKS] Connecting session ${sessionId} to backend terminal ${message.terminalId}`);
                                session.terminalId = message.terminalId!;
                                session.connected = true;
                                break;
                            }
                        }
                        
                        console.log('[STATS] Sessions after update:', Array.from(newSessions.entries()).map(([id, s]) => ({id, terminalId: s.terminalId, connected: s.connected})));
                        return newSessions;
                    });
                }
                break;

            case 'terminal-output':
                if (message.terminalId && message.data) {
                    console.log('[TERMINAL] Received terminal output:', message.terminalId, message.data);
                    const currentSessions = sessionsRef.current;
                    console.log('[SEARCH] Current sessions state:', {
                        count: currentSessions.size,
                        sessions: Array.from(currentSessions.entries()).map(([id, s]) => ({
                            id: id.slice(-8),
                            terminalId: s.terminalId,
                            title: s.title,
                            connected: s.connected,
                            hasElement: !!s.element
                        }))
                    });
                    
                    // Find session by backend terminal ID
                    const sessionEntry = Array.from(currentSessions.entries()).find(
                        ([_, session]) => session.terminalId === message.terminalId
                    );
                    if (sessionEntry) {
                        const [_, session] = sessionEntry;
                        console.log('[OK] Writing to terminal:', session.title, message.data);
                        if (session.element) {
                            session.terminal.write(message.data);
                            console.log('📝 Data written to xterm terminal');
                        } else {
                            console.warn('⚠️ Terminal not attached to DOM yet');
                        }
                    } else {
                        console.warn('❌ No terminal session found for ID:', message.terminalId);
                        console.log('Available sessions:', Array.from(currentSessions.entries()).map(([id, s]) => ({id, terminalId: s.terminalId, title: s.title})));
                    }
                }
                break;

            case 'command-executed':
                if (message.terminalId) {
                    console.log(`[FAST] Command executed in ${message.terminalId}:`, message.success);
                }
                break;

            case 'terminal-destroyed':
                if (message.terminalId) {
                    console.log(`🗑️ Terminal destroyed: ${message.terminalId}`);
                    removeTerminalByBackendId(message.terminalId);
                }
                break;

            case 'terminal-resized':
                if (message.terminalId) {
                    console.log(`📐 Terminal resized: ${message.terminalId}`, message.data);
                }
                break;

            case 'error':
                console.error('MCP Backend error:', message.error);
                break;

            default:
                console.log('Unknown backend message type:', message.type);
        }
    }, []);

    /**
     * Create a new terminal session
     */
    const createTerminalSession = useCallback(async (
        workbranchId: string, 
        shell: 'powershell' | 'bash' | 'cmd' = 'powershell',
        title?: string
    ) => {
        console.log('🔨 createTerminalSession called:', { workbranchId, shell, title });
        console.log('[SEARCH] Backend connection state:', {
            hasConnection: !!backendConnection,
            readyState: backendConnection?.readyState,
            isOpen: backendConnection?.readyState === WebSocket.OPEN
        });
        
        if (!backendConnection || backendConnection.readyState !== WebSocket.OPEN) {
            console.error('MCP backend not connected');
            return null;
        }

        // Check current sessions count inside setSessions to get real-time value
        let canCreate = true;
        setSessions(prev => {
            if (prev.size >= maxTerminals) {
                console.warn(`Maximum terminals (${maxTerminals}) reached`);
                canCreate = false;
            }
            return prev; // Don't modify, just check
        });
        
        if (!canCreate) {
            return null;
        }

        // Create xterm.js terminal with Matrix theme
        const terminal = new Terminal({
            rows: 24,
            cols: 80,
            theme: {
                background: '#000814',
                foreground: '#00ff41',
                cursor: '#00ff41',
                selectionBackground: '#004d1a',
                black: '#000000',
                red: '#ff0040',
                green: '#00ff41',
                yellow: '#ffff00',
                blue: '#0080ff',
                magenta: '#ff00ff',
                cyan: '#00ffff',
                white: '#ffffff',
                brightBlack: '#333333',
                brightRed: '#ff4066',
                brightGreen: '#66ff66',
                brightYellow: '#ffff66',
                brightBlue: '#6666ff',
                brightMagenta: '#ff66ff',
                brightCyan: '#66ffff',
                brightWhite: '#ffffff'
            },
            fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
            fontSize: 14,
            cursorBlink: true,
            allowTransparency: true
        });

        const fitAddon = new FitAddon();
        const searchAddon = new SearchAddon();
        const imageAddon = new ImageAddon();
        const clipboardAddon = new ClipboardAddon();
        const serializeAddon = new SerializeAddon();
        
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(searchAddon);
        terminal.loadAddon(imageAddon);
        terminal.loadAddon(clipboardAddon);
        terminal.loadAddon(serializeAddon);

        // Try to enable WebGL acceleration
        let webglAddon: WebglAddon | undefined;
        try {
            webglAddon = new WebglAddon();
            terminal.loadAddon(webglAddon);
        } catch (error) {
            console.warn('WebGL addon not supported, falling back to canvas renderer');
        }

        // Create session object
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        const session: TerminalSession = {
            id: sessionId,
            terminalId: 'pending', // Will be updated when backend responds
            workbranchId,
            title: title || `Terminal - ${workbranchId}`,
            shell,
            terminal,
            fitAddon,
            webglAddon,
            searchAddon,
            imageAddon,
            clipboardAddon,
            serializeAddon,
            connected: false,
            element: null,
            createdAt: new Date(),
            securityEnabled: true // Default to safe mode enabled
        };

        // Handle terminal input - send raw input to backend for proper PTY handling
        terminal.onData((data) => {
            if (backendConnection && backendConnection.readyState === WebSocket.OPEN && session.terminalId !== 'pending') {
                // Send raw input directly to backend PTY process
                backendConnection.send(JSON.stringify({
                    type: 'terminal-input',
                    id: `input_${Date.now()}`,
                    terminalId: session.terminalId,
                    data: data
                }));
            }
        });

        // Add session to state
        setSessions(prev => {
            const newSessions = new Map(prev).set(sessionId, session);
            console.log(`➕ Added session ${sessionId} (${session.title}) - Total sessions: ${newSessions.size}`);
            return newSessions;
        });
        setActiveSessionId(sessionId);

        // Request terminal creation from MCP backend
        const createMessage = {
            type: 'terminal-create',
            id: `create_${Date.now()}`,
            workbranchId,
            projectId: 'standalone-terminal-system',
            shell,
            title: session.title,
            securityEnabled: session.securityEnabled
        };

        backendConnection.send(JSON.stringify(createMessage));

        return sessionId;
    }, [backendConnection, maxTerminals]);

    /**
     * Create extended terminal session with connection types
     */
    const createExtendedTerminalSession = useCallback(async (config: ExtendedTerminalConfig) => {
        console.log('[NETWORK] createExtendedTerminalSession called:', config);
        
        if (!backendConnection || backendConnection.readyState !== WebSocket.OPEN) {
            console.error('MCP backend not connected');
            return null;
        }

        if (sessions.size >= maxTerminals) {
            console.warn(`Maximum terminals (${maxTerminals}) reached`);
            return null;
        }

        // Create XTerm terminal with standard settings
        const terminal = new Terminal({
            theme: {
                background: '#0a0a0a',
                foreground: '#00ff41',
                cursor: '#00ff41',
                selectionBackground: 'rgba(0, 255, 65, 0.3)',
                black: '#000000',
                red: '#ff0000',
                green: '#00ff41',
                yellow: '#ffff00',
                blue: '#0066ff',
                magenta: '#ff00ff',
                cyan: '#00ffff',
                white: '#ffffff'
            },
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 13,
            lineHeight: 1.2,
            convertEol: true,
            scrollback: 10000,
            cursorBlink: true,
            cursorStyle: 'block'
        });

        // Add all addons
        const fitAddon = new FitAddon();
        const searchAddon = new SearchAddon();
        const imageAddon = new ImageAddon();
        const clipboardAddon = new ClipboardAddon();
        const serializeAddon = new SerializeAddon();
        let webglAddon: WebglAddon | undefined;

        terminal.loadAddon(fitAddon);
        terminal.loadAddon(searchAddon);
        terminal.loadAddon(imageAddon);
        terminal.loadAddon(clipboardAddon);
        terminal.loadAddon(serializeAddon);

        try {
            webglAddon = new WebglAddon();
            terminal.loadAddon(webglAddon);
        } catch (e) {
            console.warn('WebGL addon failed to load, using canvas renderer');
        }

        // Create session object
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        const session: TerminalSession = {
            id: sessionId,
            terminalId: 'pending',
            workbranchId: config.workbranchId,
            title: config.title,
            shell: config.shell as 'powershell' | 'bash' | 'cmd',
            terminal,
            fitAddon,
            webglAddon,
            searchAddon,
            imageAddon,
            clipboardAddon,
            serializeAddon,
            connected: false,
            element: null,
            createdAt: new Date(),
            securityEnabled: false
        };

        // Add session to state immediately (optimistic update)
        setSessions(prev => {
            const newSessions = new Map(prev);
            newSessions.set(sessionId, session);
            return newSessions;
        });

        // If this is the first session, make it active
        if (sessions.size === 0) {
            setActiveSessionId(sessionId);
        }

        // Request extended terminal creation from MCP backend
        const createMessage = {
            type: 'terminal-create',
            id: `create_${Date.now()}`,
            workbranchId: config.workbranchId,
            projectId: 'standalone-terminal-system',
            shell: config.shell,
            title: config.title,
            connectionType: config.connectionType,
            connectionConfig: config.connectionConfig,
            securityEnabled: session.securityEnabled
        };

        backendConnection.send(JSON.stringify(createMessage));

        return sessionId;
    }, [backendConnection, maxTerminals, sessions.size]);

    /**
     * Search functionality for terminals
     */
    const searchInTerminal = useCallback((sessionId: string, query: string): boolean => {
        const session = sessions.get(sessionId);
        if (session && query.trim()) {
            return session.searchAddon.findNext(query, { 
                decorations: { 
                    activeMatchColorOverviewRuler: '#ffff00',
                    matchOverviewRuler: '#ffff00'
                } 
            });
        }
        return false;
    }, [sessions]);

    const searchNext = useCallback((sessionId: string): boolean => {
        const session = sessions.get(sessionId);
        if (session) {
            return session.searchAddon.findNext('');
        }
        return false;
    }, [sessions]);

    const searchPrevious = useCallback((sessionId: string): boolean => {
        const session = sessions.get(sessionId);
        if (session) {
            return session.searchAddon.findPrevious('');
        }
        return false;
    }, [sessions]);

    const exportTerminalContent = useCallback((sessionId: string): string | null => {
        const session = sessions.get(sessionId);
        if (session) {
            return session.serializeAddon.serialize();
        }
        return null;
    }, [sessions]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        createTerminal: createTerminalSession,
        getSessionCount: () => sessions.size,
        searchInTerminal,
        searchNext,
        searchPrevious,
        exportTerminalContent
    }), [createTerminalSession, sessions.size, searchInTerminal, searchNext, searchPrevious, exportTerminalContent]);

    /**
     * Toggle Security Mode for a terminal session (UI only - backend always enforces security)
     */
    const toggleSecurityMode = useCallback((sessionId: string) => {
        setSessions(prev => {
            const newSessions = new Map(prev);
            const session = newSessions.get(sessionId);
            if (session) {
                // Security is always enforced by the backend
                // This is just a UI indicator
                session.terminal.write(`\r\n\x1b[33m🔒 Security is always enabled - blocking dangerous commands (claude, mcp, docker, fix-*, repair-*)\x1b[0m\r\n`);
            }
            return newSessions;
        });
    }, []);

    /**
     * Remove a terminal session
     */
    const removeTerminalSession = useCallback((sessionId: string) => {
        const session = sessions.get(sessionId);
        if (session) {
            // Notify backend to destroy terminal
            if (backendConnection && backendConnection.readyState === WebSocket.OPEN && session.terminalId !== 'pending') {
                backendConnection.send(JSON.stringify({
                    type: 'terminal-destroy',
                    id: `destroy_${Date.now()}`,
                    terminalId: session.terminalId
                }));
            }

            // Clean up terminal resources
            session.terminal.dispose();
            
            // Remove from sessions
            setSessions(prev => {
                const newSessions = new Map(prev);
                newSessions.delete(sessionId);
                return newSessions;
            });

            // Update active session
            if (activeSessionId === sessionId) {
                const remainingSessions = Array.from(sessions.keys()).filter(id => id !== sessionId);
                setActiveSessionId(remainingSessions.length > 0 ? remainingSessions[0] : null);
            }
        }
    }, [sessions, activeSessionId, backendConnection]);

    /**
     * Remove terminal by backend ID (when backend notifies of destruction)
     */
    const removeTerminalByBackendId = useCallback((backendTerminalId: string) => {
        const sessionEntry = Array.from(sessions.entries()).find(
            ([_, session]) => session.terminalId === backendTerminalId
        );
        if (sessionEntry) {
            const [sessionId, _] = sessionEntry;
            removeTerminalSession(sessionId);
        }
    }, [sessions, removeTerminalSession]);

    /**
     * Attach terminal to DOM element
     */
    const attachTerminal = useCallback((sessionId: string, element: HTMLDivElement) => {
        const session = sessions.get(sessionId);
        if (session && element && !session.element) {
            session.element = element;
            session.terminal.open(element);
            
            // Fit terminal to container with multiple attempts
            const fitTerminal = () => {
                session.fitAddon.fit();
                
                // Notify backend of new dimensions immediately after fit
                if (backendConnection && backendConnection.readyState === WebSocket.OPEN && session.terminalId !== 'pending') {
                    const { rows, cols } = session.terminal;
                    backendConnection.send(JSON.stringify({
                        type: 'terminal-resize',
                        id: `resize_${Date.now()}`,
                        terminalId: session.terminalId,
                        data: { rows, cols }
                    }));
                }
            };
            
            // Multiple fit attempts to ensure proper sizing and cursor positioning
            setTimeout(() => {
                fitTerminal();
                // Focus the terminal to enable proper cursor
                session.terminal.focus();
            }, 50);
            setTimeout(() => {
                fitTerminal();
                session.terminal.focus();
            }, 150);
            setTimeout(() => {
                fitTerminal();
                session.terminal.focus();
            }, 300);

            // Handle resize
            const resizeObserver = new ResizeObserver(() => {
                fitTerminal(); // Use the same function for consistency
            });

            resizeObserver.observe(element);

            // Store cleanup function
            element.dataset.sessionId = sessionId;
            
            return () => {
                resizeObserver.disconnect();
            };
        }
    }, [sessions, backendConnection]);

    /**
     * Initialize backend connection
     */
    useEffect(() => {
        console.log('[LAUNCH] Initializing backend connection...');
        connectToBackend();

        return () => {
            console.log('🧹 Cleaning up backend connection...');
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (backendConnection) {
                backendConnection.close();
            }
        };
    }, [connectToBackend]);

    /**
     * Clean up sessions on unmount
     */
    useEffect(() => {
        return () => {
            sessions.forEach((session) => {
                session.terminal.dispose();
            });
        };
    }, []);

    /**
     * Create default terminals on connection
     */
    useEffect(() => {
        console.log('[SEARCH] Auto-creation check:', {
            connected: connectionStatus.connected,
            sessionsSize: sessions.size,
            createFunction: !!createTerminalSession
        });
        
        if (connectionStatus.connected && sessions.size === 0) {
            console.log('[LAUNCH] Auto-creating 4 default terminals...');
            // Auto-create 4 default terminals
            const defaultTerminals = [
                { workbranchId: 'main', title: 'Main Terminal' },
                { workbranchId: 'frontend', title: 'Frontend Dev' },
                { workbranchId: 'backend', title: 'Backend API' },
                { workbranchId: 'tools', title: 'Dev Tools' }
            ];

            defaultTerminals.forEach((config, index) => {
                setTimeout(() => {
                    console.log(`🔨 Creating terminal ${index + 1}/4: ${config.title}`);
                    createTerminalSession(config.workbranchId, 'powershell', config.title);
                }, index * 200); // Stagger creation slightly
            });
        }
    }, [connectionStatus.connected, sessions.size, createTerminalSession]);

    /**
     * Notify parent when terminals change
     */
    useEffect(() => {
        console.log('[STATS] Sessions changed:', {
            count: sessions.size,
            sessions: Array.from(sessions.entries()).map(([id, s]) => ({
                id: id.slice(-8),
                terminalId: s.terminalId,
                title: s.title,
                connected: s.connected
            }))
        });
        
        if (onTerminalUpdate) {
            const sessionsArray = Array.from(sessions.values());
            onTerminalUpdate(sessionsArray);
        }
    }, [sessions, onTerminalUpdate]);

    const sessionsArray = Array.from(sessions.values());

    return (
        <div className={`${styles.multiTerminalGrid} ${className}`}>
            {/* Connection Status Header */}
            <div className={styles.statusHeader}>
                <div className={styles.statusInfo}>
                    <span className={connectionStatus.connected ? styles.connected : styles.disconnected}>
                        {connectionStatus.connected ? '🔗 MCP Backend Connected' : '❌ MCP Backend Disconnected'}
                    </span>
                    {connectionStatus.error && (
                        <span className={styles.errorText}> - {connectionStatus.error}</span>
                    )}
                </div>
                <div className={styles.controls}>
                    <button 
                        onClick={() => setShowTerminalCreator(true)}
                        disabled={!connectionStatus.connected || sessions.size >= maxTerminals}
                        className={styles.newTerminalBtn}
                    >
                        + New Terminal
                    </button>
                    <span className={styles.terminalCount}>{sessions.size}/{maxTerminals} terminals</span>
                </div>
            </div>

            {/* Terminal Grid */}
            <div 
                className={styles.terminalGrid}
                style={{ 
                    gridTemplateColumns: `repeat(${gridColumns}, 1fr)`
                }}
                ref={terminalContainerRef}
            >
                {sessionsArray.map((session) => (
                    <div 
                        key={session.id}
                        className={`${styles.terminalSession} ${activeSessionId === session.id ? styles.active : ''}`}
                        onClick={() => setActiveSessionId(session.id)}
                    >
                        {/* Terminal Header */}
                        <div className={styles.terminalHeader}>
                            <div className={styles.terminalInfo}>
                                <span className={styles.shellIcon}>
                                    {session.shell === 'powershell' ? '💙' : 
                                     session.shell === 'bash' ? '🐧' : '⚫'}
                                </span>
                                <span className={styles.terminalTitle}>{session.title}</span>
                                <span className={styles.workbranchId}>({session.workbranchId})</span>
                                <span className={styles.terminalId} title={`Backend Terminal ID: ${session.terminalId}`}>
                                    ID: {session.terminalId === 'pending' ? 'pending...' : session.terminalId.slice(-6)}
                                </span>
                                <span className={styles.connectionIndicator}>
                                    {session.connected ? '🟢' : '🟡'}
                                </span>
                            </div>
                            <div className={styles.terminalControls}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const query = prompt('Search in terminal:', '');
                                        if (query) {
                                            searchInTerminal(session.id, query);
                                        }
                                    }}
                                    className={styles.searchButton}
                                    title="Search in terminal"
                                >
                                    🔍
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const content = exportTerminalContent(session.id);
                                        if (content) {
                                            const blob = new Blob([content], { type: 'text/plain' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `${session.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }
                                    }}
                                    className={styles.exportButton}
                                    title="Export terminal content"
                                >
                                    💾
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSecurityMode(session.id);
                                    }}
                                    className={`${styles.safeModeButton} ${styles.enabled}`}
                                    title="Security is always enabled - Commands are filtered for safety"
                                >
                                    🔒
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeTerminalSession(session.id);
                                    }}
                                    className={styles.closeButton}
                                    title="Close terminal"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* Terminal Content */}
                        <div 
                            className={styles.terminalContent}
                            ref={(el) => {
                                if (el && !el.dataset.sessionId) {
                                    attachTerminal(session.id, el);
                                }
                            }}
                        />
                    </div>
                ))}

                {/* Add Terminal Placeholder */}
                {sessions.size < maxTerminals && (
                    <div 
                        className={styles.addTerminalPlaceholder}
                        onClick={() => setShowTerminalCreator(true)}
                    >
                        <div className={styles.placeholderContent}>
                            <div className={styles.placeholderIcon}>+</div>
                            <div className={styles.placeholderText}>Add Terminal</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Empty State */}
            {sessions.size === 0 && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyStateContent}>
                        <div className={styles.emptyStateIcon}>🖥️</div>
                        <h3>No Terminal Sessions</h3>
                        <p>Terminals will be created automatically when backend connects</p>
                        {!connectionStatus.connected && (
                            <p className={styles.connectionHelp}>
                                Make sure the MCP backend is running: <code>npm run backend</code>
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Extended Terminal Creator Modal */}
            <ExtendedTerminalCreator
                isVisible={showTerminalCreator}
                onCreateTerminal={(config) => {
                    createExtendedTerminalSession(config);
                    setShowTerminalCreator(false);
                }}
                onCancel={() => setShowTerminalCreator(false)}
            />
        </div>
    );
});

MultiTerminalGrid.displayName = 'MultiTerminalGrid';

export default MultiTerminalGrid;