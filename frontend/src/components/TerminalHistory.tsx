/**
 * Terminal History Component - Shows combined terminal logs
 * 
 * Displays logs from all terminal sessions in a chronological view
 */

import React, { useState, useEffect, useRef } from 'react';
import styles from './TerminalHistory.module.css';

interface LogEntry {
    timestamp: string;
    terminalId: string;
    instanceNumber: number;
    content: string;
}

interface ClaudeSession {
    terminalId: string;
    agentName: string;
    sessionId: string;
    metadata: {
        createdAt: string;
        lastActive: string;
        totalInteractions: number;
        mcpServers: string[];
        sessionId?: string;
    };
    status: 'active' | 'inactive';
    conversationHistory: Array<{
        timestamp: string;
        command: string;
        responses: any[];
    }>;
}

interface TerminalHistoryProps {
    isVisible: boolean;
    onClose: () => void;
    onResumeSession?: (sessionId: string, agentName: string) => void;
}

export default function TerminalHistory({ isVisible, onClose, onResumeSession }: TerminalHistoryProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [sessions, setSessions] = useState<ClaudeSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [activeTab, setActiveTab] = useState<'logs' | 'sessions'>('logs');
    const logsContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isVisible) {
            if (activeTab === 'logs') {
                fetchLogs();
            } else {
                fetchSessions();
            }
        }
    }, [isVisible, activeTab]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // Fetch list of agents from orchestrator backend
            const response = await fetch('http://localhost:8126/api/agents');
            if (response.ok) {
                const agents = await response.json();
                
                // For each agent, fetch their logs
                const allLogs: LogEntry[] = [];
                let instanceNumber = 1;
                
                for (const agent of agents) {
                    // Skip orchestrator logs (uses Obsidian for memory)
                    if (agent.id === 'orchestrator') continue;
                    
                    try {
                        // Fetch logs for this agent
                        const logResponse = await fetch(`http://localhost:8126/api/logs/${agent.id}`);
                        if (logResponse.ok) {
                            const logData = await logResponse.text();
                            const lines = logData.split('\n').filter(line => line.trim());
                            
                            // Parse log lines and create entries
                            lines.forEach(line => {
                                // Try to extract timestamp from log line
                                const timestampMatch = line.match(/^\[([\d-T:.Z]+)\]/);
                                const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
                                const content = timestampMatch ? line.substring(timestampMatch[0].length).trim() : line;
                                
                                allLogs.push({
                                    timestamp,
                                    terminalId: agent.id,
                                    instanceNumber,
                                    content
                                });
                            });
                        }
                    } catch (err) {
                        console.error(`Failed to fetch logs for agent ${agent.id}:`, err);
                    }
                    instanceNumber++;
                }
                
                // Sort logs by timestamp (newest first)
                setLogs(allLogs.sort((a, b) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                ));
            } else {
                console.error('Failed to fetch agents list');
            }
        } catch (error) {
            console.error('Failed to fetch terminal logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSessions = async () => {
        setSessionsLoading(true);
        try {
            const response = await fetch('http://localhost:8126/claude-sessions');
            if (response.ok) {
                const data = await response.json();
                setSessions(data.sessions || []);
            } else {
                console.error('Failed to fetch Claude sessions');
                setSessions([]);
            }
        } catch (error) {
            console.error('Failed to fetch Claude sessions:', error);
            setSessions([]);
        } finally {
            setSessionsLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => 
        filter === '' || 
        log.content.toLowerCase().includes(filter.toLowerCase()) ||
        log.terminalId.includes(filter) ||
        `terminal-${log.instanceNumber}`.includes(filter.toLowerCase())
    );

    const filteredSessions = sessions.filter(session =>
        filter === '' ||
        session.agentName.toLowerCase().includes(filter.toLowerCase()) ||
        session.sessionId.includes(filter) ||
        session.metadata.mcpServers.some(server => server.toLowerCase().includes(filter.toLowerCase()))
    );

    const clearLogs = () => {
        setLogs([]);
    };

    const handleResumeSession = (session: ClaudeSession) => {
        if (onResumeSession) {
            onResumeSession(session.sessionId, session.agentName);
            onClose(); // Close the modal after resuming
        } else {
            // Fallback: copy session ID to clipboard
            navigator.clipboard.writeText(session.sessionId);
            alert(`Session ID copied to clipboard: ${session.sessionId.substring(0, 8)}...`);
        }
    };

    const downloadLogs = () => {
        const content = filteredLogs.map(log => 
            `[${new Date(log.timestamp).toLocaleString()}] Terminal-${log.instanceNumber} (${log.terminalId}):\n${log.content}\n`
        ).join('\n---\n\n');
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `terminal-history-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!isVisible) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.historyModal}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h2>📜 Terminal History & Sessions</h2>
                        <div className={styles.tabBar}>
                            <button 
                                className={`${styles.tab} ${activeTab === 'logs' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('logs')}
                            >
                                📜 Logs
                            </button>
                            <button 
                                className={`${styles.tab} ${activeTab === 'sessions' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('sessions')}
                            >
                                🧠 Sessions
                            </button>
                        </div>
                    </div>
                    <div className={styles.headerActions}>
                        <button 
                            className={styles.actionButton}
                            onClick={activeTab === 'logs' ? fetchLogs : fetchSessions}
                            disabled={loading || sessionsLoading}
                        >
                            🔄 Refresh
                        </button>
                        <button 
                            className={styles.actionButton}
                            onClick={downloadLogs}
                            disabled={filteredLogs.length === 0}
                        >
                            📥 Download
                        </button>
                        <button 
                            className={styles.actionButton}
                            onClick={clearLogs}
                            disabled={logs.length === 0}
                        >
                            🗑️ Clear
                        </button>
                        <button className={styles.closeButton} onClick={onClose}>×</button>
                    </div>
                </div>

                <div className={styles.filterContainer}>
                    <input
                        type="text"
                        placeholder={activeTab === 'logs' 
                            ? "Filter logs... (terminal ID, instance number, or content)"
                            : "Filter sessions... (agent name, session ID, or MCP servers)"
                        }
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className={styles.filterInput}
                    />
                    <span className={styles.logCount}>
                        {activeTab === 'logs' 
                            ? `${filteredLogs.length} / ${logs.length} entries`
                            : `${filteredSessions.length} / ${sessions.length} sessions`
                        }
                    </span>
                </div>

                <div className={styles.logsContainer} ref={logsContainerRef}>
                    {activeTab === 'logs' ? (
                        loading ? (
                            <div className={styles.loading}>Loading terminal history...</div>
                        ) : filteredLogs.length === 0 ? (
                            <div className={styles.empty}>
                                {filter ? 'No logs match your filter' : 'No terminal history available'}
                            </div>
                        ) : (
                            filteredLogs.map((log, index) => (
                                <div key={index} className={styles.logEntry}>
                                    <div className={styles.logHeader}>
                                        <span className={styles.timestamp}>
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                        <span className={styles.terminal}>
                                            Terminal-{log.instanceNumber}
                                        </span>
                                        <span className={styles.terminalId}>
                                            ({log.terminalId.substring(0, 8)}...)
                                        </span>
                                    </div>
                                    <pre className={styles.logContent}>{log.content}</pre>
                                </div>
                            ))
                        )
                    ) : (
                        sessionsLoading ? (
                            <div className={styles.loading}>Loading Claude sessions...</div>
                        ) : filteredSessions.length === 0 ? (
                            <div className={styles.empty}>
                                {filter ? 'No sessions match your filter' : 'No Claude sessions found'}
                                <div className={styles.hint}>
                                    Spawn a Claude agent with: <code>spawn-claude &lt;name&gt;</code>
                                </div>
                            </div>
                        ) : (
                            filteredSessions.map((session, index) => (
                                <div key={index} className={styles.sessionEntry}>
                                    <div className={styles.sessionHeader}>
                                        <div className={styles.sessionInfo}>
                                            <span className={styles.agentName}>{session.agentName}</span>
                                            <span className={`${styles.sessionStatus} ${styles[session.status]}`}>
                                                {session.status === 'active' ? '🟢' : '🔴'} {session.status}
                                            </span>
                                        </div>
                                        <div className={styles.sessionActions}>
                                            <button
                                                className={styles.resumeButton}
                                                onClick={() => handleResumeSession(session)}
                                                title="Resume this session"
                                            >
                                                ▶️ Resume
                                            </button>
                                        </div>
                                    </div>
                                    <div className={styles.sessionDetails}>
                                        <div className={styles.sessionMeta}>
                                            <span><strong>Session ID:</strong> {session.sessionId.substring(0, 16)}...</span>
                                            <span><strong>Created:</strong> {new Date(session.metadata.createdAt).toLocaleString()}</span>
                                            <span><strong>Last Active:</strong> {new Date(session.metadata.lastActive).toLocaleString()}</span>
                                            <span><strong>Interactions:</strong> {session.metadata.totalInteractions}</span>
                                        </div>
                                        {session.metadata.mcpServers.length > 0 && (
                                            <div className={styles.mcpServers}>
                                                <strong>MCP Servers:</strong> {session.metadata.mcpServers.join(', ')}
                                            </div>
                                        )}
                                        {session.conversationHistory.length > 0 && (
                                            <div className={styles.conversationPreview}>
                                                <strong>Recent Commands:</strong>
                                                <ul>
                                                    {session.conversationHistory.slice(-3).map((conv, i) => (
                                                        <li key={i}>{conv.command.substring(0, 80)}...</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>
        </div>
    );
}