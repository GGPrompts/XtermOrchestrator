/**
 * Chat Interface - Standalone MCP Backend Version
 * 
 * Simplified chat interface for sending commands to multiple terminals
 * via the standalone MCP backend. Ready for Claude Code integration.
 */

import React, { useState, useRef, useEffect } from 'react';
// Voice recognition component removed - using Windows native (Ctrl+H)
import styles from './ChatInterface.module.css';

interface ChatMessage {
    id: string;
    content: string;
    timestamp: Date;
    targets: string[];
    status: 'sending' | 'sent' | 'error';
}

interface TerminalInfo {
    id: string;
    terminalId: string;
    title: string;
    workbranchId: string;
    connected: boolean;
}

interface ChatInterfaceProps {
    terminals: TerminalInfo[];
    onSendCommand: (command: string, terminalIds: string[]) => Promise<boolean>;
    className?: string;
    showHistory?: boolean;
    showQuickCommands?: boolean;
}

export default function ChatInterface({
    terminals,
    onSendCommand,
    className = '',
    showHistory: propShowHistory = false,
    showQuickCommands: propShowQuickCommands = true
}: ChatInterfaceProps) {
    const [messageInput, setMessageInput] = useState('');
    const [selectedTerminals, setSelectedTerminals] = useState<Set<string>>(new Set());
    const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([]);
    const [isExpanded, setIsExpanded] = useState(true);
    const [showHistory, setShowHistory] = useState(propShowHistory);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);
    const historyRef = useRef<HTMLDivElement>(null);

    // Auto-select all connected terminals initially
    useEffect(() => {
        const connectedTerminals = terminals.filter(t => t.connected).map(t => t.id);
        setSelectedTerminals(new Set(connectedTerminals));
    }, [terminals]);

    // Handle orchestrator commands
    const handleOrchestratorCommand = async (command: string) => {
        const parts = command.split(' ');
        const action = parts[0];
        
        if (action === 'create') {
            // Create a new terminal
            const title = parts.slice(1).join(' ') || 'Orchestrator Terminal';
            try {
                const response = await fetch('http://localhost:8125/api/terminal/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title,
                        connectionType: 'local',
                        shell: 'bash'
                    })
                });
                const result = await response.json();
                if (result.success) {
                    // Add success message to history
                    const message: ChatMessage = {
                        id: `orch_${Date.now()}`,
                        content: `✅ Created terminal: ${title}`,
                        timestamp: new Date(),
                        targets: [],
                        status: 'sent'
                    };
                    setMessageHistory(prev => [...prev, message]);
                } else {
                    // Add error message to history
                    const message: ChatMessage = {
                        id: `orch_${Date.now()}`,
                        content: `❌ Failed to create terminal: ${result.error}`,
                        timestamp: new Date(),
                        targets: [],
                        status: 'error'
                    };
                    setMessageHistory(prev => [...prev, message]);
                }
            } catch (error) {
                console.error('Failed to create terminal:', error);
            }
        } else if (action === 'help') {
            const message: ChatMessage = {
                id: `orch_${Date.now()}`,
                content: '🤖 Orchestrator Commands:\n/orchestrator create [title] - Create a new terminal\n/orchestrator help - Show this help',
                timestamp: new Date(),
                targets: [],
                status: 'sent'
            };
            setMessageHistory(prev => [...prev, message]);
        }
    };



    // Handle message send
    const handleSendMessage = async () => {
        const trimmedInput = messageInput.trim();
        
        // Check for orchestrator commands
        if (trimmedInput.startsWith('/orchestrator ')) {
            const command = trimmedInput.substring(14);
            await handleOrchestratorCommand(command);
            setMessageInput('');
            return;
        }
        
        if (!trimmedInput || selectedTerminals.size === 0) {
            return;
        }

        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        const targets = Array.from(selectedTerminals);
        
        // Add to history with sending status
        const message: ChatMessage = {
            id: messageId,
            content: messageInput.trim(),
            timestamp: new Date(),
            targets,
            status: 'sending'
        };
        
        setMessageHistory(prev => [...prev, message]);
        setMessageInput('');

        try {
            // Send command via parent callback
            const success = await onSendCommand(message.content, targets);
            
            // Update message status
            setMessageHistory(prev => prev.map(msg => 
                msg.id === messageId 
                    ? { ...msg, status: success ? 'sent' : 'error' }
                    : msg
            ));
        } catch (error) {
            console.error('Failed to send command:', error);
            setMessageHistory(prev => prev.map(msg => 
                msg.id === messageId 
                    ? { ...msg, status: 'error' }
                    : msg
            ));
        }

        // Focus back to input
        if (messageInputRef.current) {
            messageInputRef.current.focus();
        }
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        } else if (e.key === 'Escape') {
            setMessageInput('');
        }
    };

    // Terminal selection handlers
    const handleTerminalToggle = (terminalId: string) => {
        setSelectedTerminals(prev => {
            const newSet = new Set(prev);
            if (newSet.has(terminalId)) {
                newSet.delete(terminalId);
            } else {
                newSet.add(terminalId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        const connectedTerminals = terminals.filter(t => t.connected).map(t => t.id);
        setSelectedTerminals(new Set(connectedTerminals));
    };

    const handleDeselectAll = () => {
        setSelectedTerminals(new Set());
    };

    const clearHistory = () => {
        setMessageHistory([]);
    };

    // Auto-scroll history to bottom
    useEffect(() => {
        if (historyRef.current && showHistory) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [messageHistory, showHistory]);

    // Format timestamp
    const formatTimestamp = (date: Date) => {
        return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Quick command suggestions for orchestrator system
    const commandSuggestions = [
        'spawn frontend-dev',
        'spawn backend-api', 
        'spawn researcher',
        'spawn-hidden worker',
        'status',
        'status-all',
        'send agent-1 pwd',
        'broadcast ls -la',
        'chat "Analyze this codebase"',
        '/agents prompt-engineer',
        'logs agent-1 50',
        'summary agent-1',
        'clear',
        'help'
    ];

    const insertCommand = (command: string) => {
        setMessageInput(command);
        if (messageInputRef.current) {
            messageInputRef.current.focus();
        }
    };

    // Get emoji for terminal based on workbranch/title
    const getTerminalEmoji = (terminal: TerminalInfo) => {
        // Special case for orchestrator
        if (terminal.id === 'orchestrator') return '🎯';
        
        const workbranch = (terminal.workbranchId || '').toLowerCase();
        const title = (terminal.title || '').toLowerCase();
        
        if (workbranch.includes('main') || title.includes('main')) return '🏠';
        if (workbranch.includes('frontend') || title.includes('frontend')) return '🎨';
        if (workbranch.includes('backend') || title.includes('backend')) return '⚙️';
        if (workbranch.includes('tools') || title.includes('tools')) return '🛠️';
        
        // Default emojis based on position
        const index = terminals.findIndex(t => t.id === terminal.id);
        const defaultEmojis = ['🟦', '🟩', '🟨', '🟪'];
        return defaultEmojis[index % defaultEmojis.length];
    };

    return (
        <div className={`${styles.chatInterface} ${className} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            {/* Chat Header */}
            <div className={styles.chatHeader}>
                <div className={styles.chatTitle}>
                    <span className={styles.chatIcon}>💬</span>
                    <span>Multi-Terminal Command Center</span>
                    {selectedTerminals.size > 0 && (
                        <span className={styles.targetCount}>
                            → {selectedTerminals.size} terminal{selectedTerminals.size !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                
                <div className={styles.chatControls}>
                    <button
                        className={`${styles.controlButton} ${showHistory ? styles.active : ''}`}
                        onClick={() => setShowHistory(!showHistory)}
                        title="Toggle message history"
                    >
                        📜
                    </button>
                    
                    <button
                        className={styles.controlButton}
                        onClick={clearHistory}
                        title="Clear message history"
                        disabled={messageHistory.length === 0}
                    >
                        🗑️
                    </button>
                    
                    <button
                        className={styles.controlButton}
                        onClick={() => {
                            // Trigger Ctrl+H for Windows voice-to-text
                            const event = new KeyboardEvent('keydown', {
                                key: 'h',
                                code: 'KeyH',
                                ctrlKey: true,
                                bubbles: true
                            });
                            document.dispatchEvent(event);
                        }}
                        title="Open Windows Voice to Text (Ctrl+H)"
                    >
                        🎤
                    </button>
                    
                    <button
                        className={styles.controlButton}
                        onClick={() => setIsExpanded(!isExpanded)}
                        title={isExpanded ? 'Collapse chat' : 'Expand chat'}
                    >
                        {isExpanded ? '🔽' : '🔼'}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <>
                    {/* Compact Terminal Selectors */}
                    <div className={styles.compactTerminalSelector}>
                        <div className={styles.selectorLabel}>Send to:</div>
                        <div className={styles.terminalCheckboxes}>
                            {terminals.map(terminal => (
                                <button
                                    key={terminal.id}
                                    className={`${styles.terminalCheckbox} ${
                                        selectedTerminals.has(terminal.id) ? styles.selected : ''
                                    } ${terminal.connected ? styles.connected : styles.disconnected}`}
                                    onClick={() => handleTerminalToggle(terminal.id)}
                                    title={`${terminal.title} (${terminal.workbranchId}) - ${terminal.connected ? 'Connected' : 'Disconnected'}`}
                                    disabled={!terminal.connected}
                                >
                                    <span className={styles.terminalEmoji}>{getTerminalEmoji(terminal)}</span>
                                    {selectedTerminals.has(terminal.id) && <span className={styles.checkMark}>✓</span>}
                                </button>
                            ))}
                            <div className={styles.selectControls}>
                                <button 
                                    className={styles.selectAllBtn}
                                    onClick={handleSelectAll}
                                    disabled={terminals.filter(t => t.connected).length === 0}
                                    title="Select all connected terminals"
                                >
                                    All
                                </button>
                                <button 
                                    className={styles.deselectAllBtn}
                                    onClick={handleDeselectAll}
                                    disabled={selectedTerminals.size === 0}
                                    title="Deselect all terminals"
                                >
                                    None
                                </button>
                            </div>
                        </div>
                    </div>


                    {/* Message History */}
                    {showHistory && messageHistory.length > 0 && (
                        <div className={styles.messageHistory} ref={historyRef}>
                            <div className={styles.historyHeader}>
                                <span>📜 Command History ({messageHistory.length})</span>
                            </div>
                            
                            <div className={styles.historyMessages}>
                                {messageHistory.map(message => (
                                    <div
                                        key={message.id}
                                        className={`${styles.historyMessage} ${styles[message.status]}`}
                                    >
                                        <div className={styles.messageHeader}>
                                            <span className={styles.timestamp}>
                                                {formatTimestamp(message.timestamp)}
                                            </span>
                                            <span className={styles.targetCount}>
                                                → {message.targets.length} terminals
                                            </span>
                                            <span className={`${styles.messageStatus} ${styles[message.status]}`}>
                                                {message.status === 'sending' && '⏳'}
                                                {message.status === 'sent' && '✅'}
                                                {message.status === 'error' && '❌'}
                                            </span>
                                        </div>
                                        <div className={styles.messageContent}>
                                            <code>{message.content}</code>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Commands */}
                    {propShowQuickCommands && (
                        <div className={styles.quickCommands}>
                            <div className={styles.commandsHeader}>
                                <span>⚡ Quick Commands:</span>
                            </div>
                            <div className={styles.commandsList}>
                                {commandSuggestions.map((command, index) => (
                                    <button
                                        key={index}
                                        className={styles.commandButton}
                                        onClick={() => insertCommand(command)}
                                        title={`Insert: ${command}`}
                                    >
                                        <code>{command}</code>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Message Input */}
                    <div className={styles.messageInput}>
                        <div className={styles.inputContainer}>
                            <textarea
                                ref={messageInputRef}
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={
                                    selectedTerminals.size === 0 
                                        ? 'Select terminals above to send commands...'
                                        : `Send command to ${selectedTerminals.size} terminal${selectedTerminals.size !== 1 ? 's' : ''}... (Enter to send, Shift+Enter for new line)`
                                }
                                className={styles.messageTextarea}
                                rows={2}
                                disabled={selectedTerminals.size === 0}
                            />
                            
                            <div className={styles.inputActions}>
                                <button
                                    className={styles.sendButton}
                                    onClick={handleSendMessage}
                                    disabled={!messageInput.trim() || selectedTerminals.size === 0}
                                    title={`Send to ${selectedTerminals.size} terminals`}
                                >
                                    <span>🚀 Send</span>
                                </button>
                                
                                <button
                                    className={styles.clearButton}
                                    onClick={() => setMessageInput('')}
                                    disabled={!messageInput}
                                    title="Clear input"
                                >
                                    ❌
                                </button>
                            </div>
                        </div>
                        
                        <div className={styles.inputHints}>
                            <div className={styles.shortcuts}>
                                <span><kbd>Enter</kbd> Send</span>
                                <span><kbd>Shift+Enter</kbd> New line</span>
                                <span><kbd>Esc</kbd> Clear</span>
                            </div>
                            
                            {messageInput.length > 0 && (
                                <div className={styles.charCount}>
                                    {messageInput.length} characters
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}