/**
 * Agent Terminal Panel Component
 * 
 * Displays agent terminals in a flexible layout that supports:
 * - Split view (horizontal/vertical)
 * - Pop-out to separate window
 * - Minimize/maximize
 * - Direct terminal interaction
 */

import React, { useRef, useEffect, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import styles from './AgentTerminalPanel.module.css';

export interface AgentTerminal {
    id: string;
    name: string;
    status: 'idle' | 'working' | 'completed' | 'error';
    isHidden?: boolean;
    terminal?: Terminal;
    fitAddon?: FitAddon;
}

interface AgentTerminalPanelProps {
    agent: AgentTerminal;
    layout: 'full' | 'split-horizontal' | 'split-vertical';
    onClose: (id: string) => void;
    onPopOut: (id: string) => void;
    onMinimize: (id: string) => void;
    wsConnection: WebSocket | null;
}

export default function AgentTerminalPanel({
    agent,
    layout,
    onClose,
    onPopOut,
    onMinimize,
    wsConnection
}: AgentTerminalPanelProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        if (!terminalRef.current || agent.terminal || isMinimized) return;

        // Create terminal instance for this agent
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            theme: {
                background: '#1a1a2e',
                foreground: '#eee',
                cursor: '#f0f0f0',
                selection: 'rgba(255, 255, 255, 0.3)',
                black: '#000000',
                red: '#ff5555',
                green: '#50fa7b',
                yellow: '#f1fa8c',
                blue: '#6272a4',
                magenta: '#bd93f9',
                cyan: '#8be9fd',
                white: '#f8f8f2',
                brightBlack: '#555555',
                brightRed: '#ff6666',
                brightGreen: '#69ff94',
                brightYellow: '#ffffa5',
                brightBlue: '#7b8bb4',
                brightMagenta: '#d6acff',
                brightCyan: '#a4ffff',
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

        // Store references
        agent.terminal = term;
        agent.fitAddon = fitAddon;

        // Connect to agent via WebSocket
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
            wsConnection.send(JSON.stringify({
                type: 'connect-agent-terminal',
                agentId: agent.id
            }));
        }

        // Handle terminal input
        const onData = term.onData((data) => {
            if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
                wsConnection.send(JSON.stringify({
                    type: 'agent-input',
                    agentId: agent.id,
                    data: data
                }));
            }
        });

        // Handle resize
        const handleResize = () => {
            if (fitAddon) {
                fitAddon.fit();
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            onData.dispose();
            term.dispose();
        };
    }, [agent, wsConnection, isMinimized]);

    const handleMinimize = () => {
        setIsMinimized(!isMinimized);
        if (!isMinimized) {
            onMinimize(agent.id);
        }
    };

    return (
        <div className={`${styles.agentPanel} ${styles[layout]} ${isMinimized ? styles.minimized : ''}`}>
            <div className={styles.header}>
                <div className={styles.agentInfo}>
                    <span className={`${styles.status} ${styles[agent.status]}`}>●</span>
                    <span className={styles.name}>{agent.name}</span>
                    {agent.isHidden && <span className={styles.hiddenBadge}>👁️‍🗨️</span>}
                </div>
                <div className={styles.controls}>
                    <button 
                        className={styles.controlBtn}
                        onClick={handleMinimize}
                        title={isMinimized ? "Restore" : "Minimize"}
                    >
                        {isMinimized ? '□' : '_'}
                    </button>
                    <button 
                        className={styles.controlBtn}
                        onClick={() => onPopOut(agent.id)}
                        title="Pop out"
                    >
                        ⧉
                    </button>
                    <button 
                        className={styles.controlBtn}
                        onClick={() => onClose(agent.id)}
                        title="Close"
                    >
                        ×
                    </button>
                </div>
            </div>
            {!isMinimized && (
                <div ref={terminalRef} className={styles.terminal} />
            )}
        </div>
    );
}