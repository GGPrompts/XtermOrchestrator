/**
 * Multi-Terminal Page - Full 4-Terminal Grid + Chat Interface
 * 
 * This is the complete multi-terminal interface with:
 * - 4-terminal grid layout (2x2) 
 * - Integrated chat interface for multi-terminal commands
 * - Real-time Terminal Orchestrator backend integration
 * - Matrix cyberpunk styling throughout
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import MultiTerminalGrid, { MultiTerminalGridRef } from '../components/MultiTerminalGrid';
import ChatInterface from '../components/ChatInterface';
import TerminalHistory from '../components/TerminalHistory';
import Navigation from '../components/Navigation';
import styles from './MultiTerminal.module.css';

interface TerminalInfo {
    id: string;
    terminalId: string;
    title: string;
    workbranchId: string;
    connected: boolean;
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

export default function MultiTerminal() {
    const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
    const [backendConnection, setBackendConnection] = useState<WebSocket | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<{
        connected: boolean;
        error?: string;
    }>({ connected: false });
    const [showHistory, setShowHistory] = useState<boolean>(false);
    const [showQuickCommands, setShowQuickCommands] = useState<boolean>(false);
    const [showTerminalHistory, setShowTerminalHistory] = useState<boolean>(false);
    
    const multiTerminalRef = useRef<MultiTerminalGridRef>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

    /**
     * Connect to Terminal Orchestrator backend
     */
    const connectToBackend = useCallback(() => {
        try {
            console.log('[LINKS] MultiTerminal connecting to Terminal Orchestrator backend...');
            const ws = new WebSocket('ws://localhost:8125');
            
            ws.onopen = () => {
                console.log('[OK] MultiTerminal connected to Terminal Orchestrator backend');
                setConnectionStatus({ connected: true });
                setBackendConnection(ws);
            };

            ws.onmessage = (event) => {
                try {
                    const message: BackendMessage = JSON.parse(event.data);
                    console.log('[MSG] MultiTerminal received:', message.type, message);
                    handleBackendMessage(message);
                } catch (error) {
                    console.error('Failed to parse backend message:', error);
                }
            };

            ws.onclose = () => {
                console.log('[CLOSE] MultiTerminal backend connection closed');
                setConnectionStatus({ connected: false });
                setBackendConnection(null);
                
                // Clear terminals on disconnect
                setTerminals([]);
                
                // Attempt to reconnect after 3 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    connectToBackend();
                }, 3000);
            };

            ws.onerror = (error) => {
                console.error('MultiTerminal backend WebSocket error:', error);
                setConnectionStatus({ 
                    connected: false, 
                    error: 'Failed to connect to Terminal Orchestrator backend' 
                });
            };

        } catch (error) {
            console.error('Failed to connect to Terminal Orchestrator backend:', error);
            setConnectionStatus({ 
                connected: false, 
                error: 'Terminal Orchestrator backend unavailable' 
            });
        }
    }, []);

    /**
     * Handle messages from Terminal Orchestrator backend
     */
    const handleBackendMessage = useCallback((message: BackendMessage) => {
        switch (message.type) {
            case 'connection-established':
                console.log('[OK] MultiTerminal Backend capabilities:', message.data?.capabilities);
                break;

            case 'terminal-created':
                if (message.success && message.terminalId) {
                    console.log(`[OK] MultiTerminal terminal created: ${message.terminalId}`);
                    // This will be handled by the MultiTerminalGrid component
                }
                break;

            case 'terminal-destroyed':
                if (message.terminalId) {
                    console.log(`[DELETE] MultiTerminal terminal destroyed: ${message.terminalId}`);
                    setTerminals(prev => prev.filter(t => t.terminalId !== message.terminalId));
                }
                break;

            case 'command-executed':
                if (message.terminalId) {
                    console.log(`[FAST] MultiTerminal command executed in ${message.terminalId}:`, message.success);
                }
                break;

            case 'error':
                console.error('MultiTerminal Backend error:', message.error);
                break;
        }
    }, []);

    /**
     * Send command to multiple terminals via chat interface
     */
    const handleSendCommand = useCallback(async (command: string, terminalIds: string[]): Promise<boolean> => {
        if (!backendConnection || backendConnection.readyState !== WebSocket.OPEN) {
            console.error('Backend not connected');
            return false;
        }

        console.log(`[SEND] Sending command to ${terminalIds.length} terminals:`, command);
        console.log('[SEARCH] Available terminals:', terminals.map(t => ({
            id: t.id, 
            terminalId: t.terminalId, 
            title: t.title, 
            connected: t.connected
        })));
        console.log('[TARGET] Selected terminal IDs:', terminalIds);
        
        try {
            // Send command to each selected terminal
            const promises = terminalIds.map(sessionId => {
                const terminal = terminals.find(t => t.id === sessionId);
                if (!terminal) {
                    console.warn(`[ERROR] Terminal not found: ${sessionId}`);
                    return Promise.resolve(false);
                }

                if (terminal.terminalId === 'pending') {
                    console.warn(`[PENDING] Terminal ${terminal.title} still pending backend connection`);
                    return Promise.resolve(false);
                }

                return new Promise<boolean>((resolve) => {
                    const commandMessage = {
                        type: 'terminal-command',
                        id: `chat_cmd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                        terminalId: terminal.terminalId,
                        command: command
                    };

                    console.log(`[LAUNCH] Sending to ${terminal.title} (${terminal.terminalId}):`, commandMessage);
                    backendConnection.send(JSON.stringify(commandMessage));
                    
                    // For now, assume success (real implementation would wait for response)
                    setTimeout(() => resolve(true), 100);
                });
            });

            const results = await Promise.all(promises);
            const allSuccessful = results.every(result => result);
            
            console.log(`[STATS] Command execution results: ${results.filter(r => r).length}/${results.length} successful`);
            return allSuccessful;
            
        } catch (error) {
            console.error('Failed to send commands:', error);
            return false;
        }
    }, [backendConnection, terminals]);

    /**
     * Update terminal list when MultiTerminalGrid creates/destroys terminals
     */
    const handleTerminalUpdate = useCallback((gridTerminals: any[]) => {
        const terminalInfos: TerminalInfo[] = gridTerminals.map(session => ({
            id: session.id,
            terminalId: session.terminalId,
            title: session.title,
            workbranchId: session.workbranchId,
            connected: session.connected
        }));
        
        setTerminals(terminalInfos);
    }, []);

    // Initialize connection
    useEffect(() => {
        connectToBackend();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (backendConnection) {
                backendConnection.close();
            }
        };
    }, [connectToBackend]);

    return (
        <div className={styles.multiTerminalPage}>
            <Navigation />
            {/* Page Header */}
            <header className={styles.pageHeader}>
                <div className={styles.headerContent}>
                    <h1>Multi-Terminal Interface</h1>
                    <p className={styles.subtitle}>
                        Run multiple terminal sessions side by side
                    </p>
                    <div className={styles.statusIndicator}>
                        <span className={connectionStatus.connected ? styles.connected : styles.disconnected}>
                            {connectionStatus.connected ? '🔗 Backend Connected' : '❌ Backend Disconnected'}
                        </span>
                        {connectionStatus.error && (
                            <span className={styles.errorText}> - {connectionStatus.error}</span>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className={styles.mainContent}>
                {/* Terminal Grid Section */}
                <section className={styles.terminalSection}>
                    <div className={styles.sectionHeader}>
                        <h2>🖥️ Terminal Grid</h2>
                        <span className={styles.terminalCount}>
                            {terminals.filter(t => t.connected).length}/{terminals.length} Active
                        </span>
                    </div>
                    <div className={styles.terminalGridContainer}>
                        <MultiTerminalGrid
                            ref={multiTerminalRef}
                            maxTerminals={4}
                            gridColumns={4}
                            className={styles.terminalGrid}
                            onTerminalUpdate={handleTerminalUpdate}
                        />
                    </div>
                </section>

                {/* Chat Interface Section */}
                <section className={styles.chatSection}>
                    <div className={styles.sectionHeader}>
                        <h2>💬 Command Center</h2>
                        <div className={styles.chatFeatures}>
                            <button 
                                className={styles.featureButton} 
                                title="Multi-terminal mode (currently active)"
                                style={{ opacity: 0.7 }}
                                disabled
                            >
                                🖥️ Multi-Terminal
                            </button>
                            <button 
                                className={styles.featureButton} 
                                title="View combined terminal logs"
                                onClick={() => setShowTerminalHistory(true)}
                                style={{ 
                                    background: showTerminalHistory ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 255, 255, 0.1)' 
                                }}
                            >
                                📜 History
                            </button>
                            <button 
                                className={styles.featureButton} 
                                title="Toggle quick commands panel"
                                onClick={() => setShowQuickCommands(!showQuickCommands)}
                                style={{ 
                                    background: showQuickCommands ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 255, 255, 0.1)' 
                                }}
                            >
                                ⚡ Quick Commands {showQuickCommands ? '✓' : ''}
                            </button>
                        </div>
                    </div>
                    <div className={styles.chatContainer}>
                        <ChatInterface
                            terminals={terminals}
                            onSendCommand={handleSendCommand}
                            className={styles.chatInterface}
                            showHistory={showHistory}
                            showQuickCommands={showQuickCommands}
                        />
                    </div>
                </section>
            </main>

            {/* Terminal History Modal */}
            <TerminalHistory 
                isVisible={showTerminalHistory}
                onClose={() => setShowTerminalHistory(false)}
            />

        </div>
    );
}