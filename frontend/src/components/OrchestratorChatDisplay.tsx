/**
 * Orchestrator Chat Display
 * 
 * Display-only chat feed showing:
 * - Claude Code commands and responses
 * - Agent status updates
 * - System notifications
 * 
 * No input to prevent recursion - Claude Code runs only in terminal
 */

import React, { useEffect, useRef, useState } from 'react';
import styles from './OrchestratorChatDisplay.module.css';

export interface ChatMessage {
    id: string;
    type: 'claude-command' | 'claude-response' | 'agent-update' | 'system' | 'agent-message';
    source: string;
    content: string;
    timestamp: Date;
    metadata?: {
        agentId?: string;
        status?: string;
        targetAgents?: string[];
    };
}

interface OrchestratorChatDisplayProps {
    messages: ChatMessage[];
    maxMessages?: number;
    autoScroll?: boolean;
    showTimestamps?: boolean;
    className?: string;
}

export default function OrchestratorChatDisplay({
    messages,
    maxMessages = 100,
    autoScroll = true,
    showTimestamps = true,
    className = ''
}: OrchestratorChatDisplayProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [filteredMessages, setFilteredMessages] = useState<ChatMessage[]>([]);
    const [filter, setFilter] = useState<'all' | 'claude' | 'agents' | 'system'>('all');

    // Filter and limit messages
    useEffect(() => {
        let filtered = [...messages];
        
        // Apply filter
        if (filter !== 'all') {
            filtered = filtered.filter(msg => {
                if (filter === 'claude') return msg.type === 'claude-command' || msg.type === 'claude-response';
                if (filter === 'agents') return msg.type === 'agent-update' || msg.type === 'agent-message';
                if (filter === 'system') return msg.type === 'system';
                return true;
            });
        }

        // Limit messages
        if (filtered.length > maxMessages) {
            filtered = filtered.slice(-maxMessages);
        }

        setFilteredMessages(filtered);
    }, [messages, filter, maxMessages]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (autoScroll && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [filteredMessages, autoScroll]);

    const getMessageIcon = (type: ChatMessage['type']) => {
        switch (type) {
            case 'claude-command': return '🤖';
            case 'claude-response': return '💬';
            case 'agent-update': return '📊';
            case 'agent-message': return '🔧';
            case 'system': return '⚙️';
            default: return '📝';
        }
    };

    const getMessageColor = (type: ChatMessage['type']) => {
        switch (type) {
            case 'claude-command': return styles.claudeCommand;
            case 'claude-response': return styles.claudeResponse;
            case 'agent-update': return styles.agentUpdate;
            case 'agent-message': return styles.agentMessage;
            case 'system': return styles.system;
            default: return '';
        }
    };

    const formatTimestamp = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div className={`${styles.chatDisplay} ${className}`}>
            <div className={styles.header}>
                <h3>Orchestrator Activity Feed</h3>
                <div className={styles.filters}>
                    <button 
                        className={filter === 'all' ? styles.active : ''}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                    <button 
                        className={filter === 'claude' ? styles.active : ''}
                        onClick={() => setFilter('claude')}
                    >
                        Claude
                    </button>
                    <button 
                        className={filter === 'agents' ? styles.active : ''}
                        onClick={() => setFilter('agents')}
                    >
                        Agents
                    </button>
                    <button 
                        className={filter === 'system' ? styles.active : ''}
                        onClick={() => setFilter('system')}
                    >
                        System
                    </button>
                </div>
            </div>

            <div className={styles.messagesContainer}>
                {filteredMessages.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>No messages yet. Activity will appear here when:</p>
                        <ul>
                            <li>Claude Code executes commands</li>
                            <li>Agents report status updates</li>
                            <li>System events occur</li>
                        </ul>
                    </div>
                ) : (
                    filteredMessages.map(message => (
                        <div 
                            key={message.id} 
                            className={`${styles.message} ${getMessageColor(message.type)}`}
                        >
                            <div className={styles.messageHeader}>
                                <span className={styles.icon}>{getMessageIcon(message.type)}</span>
                                <span className={styles.source}>{message.source}</span>
                                {message.metadata?.agentId && (
                                    <span className={styles.agentBadge}>
                                        Agent: {message.metadata.agentId}
                                    </span>
                                )}
                                {showTimestamps && (
                                    <span className={styles.timestamp}>
                                        {formatTimestamp(message.timestamp)}
                                    </span>
                                )}
                            </div>
                            <div className={styles.messageContent}>
                                {message.content}
                            </div>
                            {message.metadata?.targetAgents && (
                                <div className={styles.targets}>
                                    → {message.metadata.targetAgents.join(', ')}
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className={styles.footer}>
                <span className={styles.messageCount}>
                    {filteredMessages.length} messages
                </span>
                <span className={styles.liveIndicator}>
                    <span className={styles.liveDot}></span> Live
                </span>
            </div>
        </div>
    );
}