import React, { useState, useRef, useEffect } from 'react';
import styles from './SimpleTerminal.module.css';

interface SimpleTerminalProps {
  terminalId: string;
  title: string;
  workbranchId: string;
  projectId?: string;
  onCommand?: (command: string) => void;
  onClose?: (terminalId: string) => void;
}

interface CommandExecution {
  command: string;
  timestamp: Date;
  status: 'executing' | 'success' | 'error';
  output?: string;
}

export default function SimpleTerminal({ 
  terminalId, 
  title, 
  workbranchId, 
  projectId, 
  onCommand,
  onClose
}: SimpleTerminalProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<CommandExecution[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [realTerminalId, setRealTerminalId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [securityMode, setSecurityMode] = useState<'safe' | 'developer'>('safe');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const addLine = (line: string) => {
    setLines(prev => [...prev, line]);
    // Auto-scroll to bottom
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, 10);
  };

  const connectToMCPBackend = async () => {
    try {
      addLine('[SEARCH] Connecting to MCP Terminal Backend...');
      
      // Connect to our WebSocket backend
      const ws = new WebSocket('ws://localhost:8125');
      
      ws.onopen = () => {
        addLine('[OK] Connected to Terminal Backend');
        setWsConnection(ws);
        setIsConnected(true);
        
        // Create terminal session
        const createMessage = {
          type: 'terminal-create',
          id: `msg_${Date.now()}`,
          workbranchId: workbranchId,
          projectId: projectId,
          shell: 'powershell',
          title: title
        };
        
        ws.send(JSON.stringify(createMessage));
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 SimpleTerminal received message:', message.type, message);
          
          switch (message.type) {
            case 'connection-established':
              addLine(`[WEB] Backend connection established: ${message.data?.serverVersion || 'v1.0.0'}`);
              break;
              
            case 'terminal-created':
              if (message.success) {
                setRealTerminalId(message.terminalId);
                addLine(`[LAUNCH] Terminal session created: ${message.terminalId?.slice(-8)}`);
                addLine(`[DIR] Working directory: ${projectId ? `Project ${projectId}` : `Workbranch ${workbranchId}`}`);
                addLine('[TIP] Commands execute via MCP Terminal Backend');
                addLine('');
              } else {
                addLine('❌ Failed to create terminal session');
              }
              break;
              
            case 'terminal-output':
              console.log('[DEBUG] terminal-output:', {
                messageTerminalId: message.terminalId,
                realTerminalId: realTerminalId,
                matches: message.terminalId === realTerminalId,
                hasData: !!message.data,
                dataLength: message.data?.length,
                dataPreview: message.data?.substring(0, 100),
                rawData: JSON.stringify(message.data)
              });
              
              if (message.data) {
                // If realTerminalId is not set yet, accept output from any terminal for this session
                const shouldProcessOutput = realTerminalId === null || message.terminalId === realTerminalId;
                if (shouldProcessOutput) {
                  // Clean ANSI escape sequences and filter out control sequences
                  let cleanData = message.data
                    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Remove ANSI escape sequences
                    .replace(/\x1b\[[0-9;]*[~]/g, '')     // Remove function key sequences
                    .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '') // Remove mode sequences
                    .replace(/\x1b\]0;[^\x07]*\x07/g, '') // Remove window title sequences (]0;...BEL)
                    .replace(/\x1b\]0;[^\n]*$/g, '')      // Remove incomplete title sequences
                    .replace(/\]0;[^\x07]*\x07/g, '')     // Remove title sequences without ESC
                    .replace(/\]0;[^\n]*$/g, '')          // Remove incomplete title sequences without ESC
                    .replace(/\x07/g, '')                 // Remove bell characters
                    .replace(/\r/g, '');                  // Remove carriage returns
                  
                  console.log('[CLEAN] Cleaned data:', JSON.stringify(cleanData));
                  
                  // Skip if only control sequences (like [6n)
                  if (cleanData.trim() && !cleanData.match(/^\[[0-9]+[a-zA-Z]$/)) {
                    const outputLines = cleanData.split('\n');
                    outputLines.forEach((line: string) => {
                      if (line.trim()) {
                        addLine(`${line.trim()}`);
                      }
                    });
                  } else {
                    console.log('[SKIP] Skipped control sequence:', JSON.stringify(cleanData));
                  }
                  
                  // Set the real terminal ID if we haven't got it yet
                  if (realTerminalId === null && message.terminalId) {
                    console.log('[LINKS] Setting realTerminalId from output:', message.terminalId);
                    setRealTerminalId(message.terminalId);
                  }
                } else {
                  console.log('[IGNORE] Ignoring output from different terminal:', message.terminalId);
                }
              }
              break;
              
            case 'command-executed':
              // Reset executing state regardless of terminal ID match for responsiveness
              setIsExecuting(false);
              
              if (message.terminalId === realTerminalId || realTerminalId === null) {
                if (message.success) {
                  console.log(`[OK] Command executed successfully: ${message.command}`);
                  // Remove the timeout warning since output is working now
                } else {
                  addLine(`❌ Command failed: ${message.command}`);
                }
              }
              break;
              
            case 'error':
              addLine(`❌ Backend error: ${message.error}`);
              setIsExecuting(false);
              break;
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        addLine('⚠️ Connection to backend lost');
        setIsConnected(false);
        setWsConnection(null);
      };
      
      ws.onerror = (error) => {
        addLine('❌ WebSocket connection error');
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      addLine(`❌ Failed to connect to backend: ${error instanceof Error ? error.message : 'Unknown error'}`);
      addLine('[TIP] Make sure to run: npm run backend');
    }
  };

  const handleCommand = async (command: string) => {
    if (command.trim() && wsConnection && realTerminalId) {
      const timestamp = new Date();
      const execution: CommandExecution = {
        command,
        timestamp,
        status: 'executing'
      };
      
      setCommandHistory(prev => [...prev, execution]);
      setIsExecuting(true);
      
      // Handle special commands that affect the frontend display
      if (command.trim().toLowerCase() === 'clear' || command.trim().toLowerCase() === 'cls') {
        // Clear the frontend display immediately
        setLines([]);
        console.log('[CLEAR] Frontend display cleared for clear/cls command');
      }
      
      try {
        // Send command to MCP backend
        const commandMessage = {
          type: 'terminal-command',
          id: `cmd_${Date.now()}`,
          terminalId: realTerminalId,
          command: command,
          securityMode: securityMode  // Include security mode
        };
        
        console.log('📤 Sending command message:', commandMessage);
        wsConnection.send(JSON.stringify(commandMessage));
        
        // Only add command line if we didn't just clear
        if (command.trim().toLowerCase() !== 'clear' && command.trim().toLowerCase() !== 'cls') {
          addLine(`📋 $ ${command}`);
        }
        
        // Don't set status to success immediately - wait for backend response
        // execution.status remains 'executing' until we get command-executed response
        
      } catch (error) {
        execution.status = 'error';
        execution.output = error instanceof Error ? error.message : 'Unknown error';
        addLine(`❌ Error: ${execution.output}`);
        setIsExecuting(false);
      }
      
      // Update command history with the current execution state
      setCommandHistory(prev => prev.map(cmd => 
        cmd.timestamp === execution.timestamp ? execution : cmd
      ));
      
      setCurrentInput('');
    } else if (!wsConnection) {
      addLine('❌ No backend connection - run: npm run backend');
    } else if (!realTerminalId) {
      addLine('❌ No terminal session - backend may be starting');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isExecuting) {
      handleCommand(currentInput);
    } else if (e.key === 'ArrowUp' && commandHistory.length > 0) {
      const lastCommand = commandHistory[commandHistory.length - 1];
      if (lastCommand) {
        setCurrentInput(lastCommand.command);
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only focus input if user isn't selecting text
    const selection = window.getSelection();
    if (!selection || selection.toString().length === 0) {
      // No text selected, safe to focus input
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
    // If text is selected, do nothing to allow copying
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Connect to MCP backend
    connectToMCPBackend();
    
    return () => {
      // Cleanup WebSocket connection
      if (wsConnection) {
        if (realTerminalId) {
          const destroyMessage = {
            type: 'terminal-destroy',
            id: `destroy_${Date.now()}`,
            terminalId: realTerminalId
          };
          wsConnection.send(JSON.stringify(destroyMessage));
        }
        wsConnection.close();
      }
    };
  }, [workbranchId, projectId, terminalId]);
  
  return (
    <div className={styles.simpleTerminal} onClick={handleClick} ref={containerRef}>
      <div className={styles.terminalHeader}>
        <span className={styles.terminalTitle}>{title}</span>
        <div className={styles.terminalActions}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSecurityMode(securityMode === 'safe' ? 'developer' : 'safe');
            }}
            className={styles.securityToggle}
            title={`Security Mode: ${securityMode === 'safe' ? 'Safe (MCP Protected)' : 'Developer (Full Access)'}`}
            style={{
              background: securityMode === 'safe' ? '#28a745' : '#ffc107',
              color: securityMode === 'safe' ? 'white' : 'black',
              border: 'none',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              cursor: 'pointer',
              marginRight: '8px'
            }}
          >
            {securityMode === 'safe' ? '[SECURITY] Safe' : '⚠️ Dev'}
          </button>
          <span className={styles.connectionStatus}>
            {isConnected ? '[LINKS] MCP Backend' : '📱 Disconnected'}
          </span>
          <span className={styles.terminalId}>{realTerminalId?.slice(-8) || terminalId.slice(-8)}</span>
          {onClose && (
            <button 
              className={styles.closeButton}
              onClick={() => onClose(terminalId)}
              title="Close terminal"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      <div 
        className={styles.terminalContent}
        onMouseDown={(e) => {
          // Prevent the container click handler from focusing input during text selection
          e.stopPropagation();
        }}
      >
        {lines.map((line, index) => (
          <div 
            key={index} 
            className={styles.terminalLine}
            style={{ userSelect: 'text', cursor: 'text' }}
          >
            {line}
          </div>
        ))}
        
        <div className={styles.currentLine}>
          <span className={styles.prompt}>$ </span>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className={styles.terminalInput}
            placeholder={
              isExecuting 
                ? "Executing command..." 
                : isConnected 
                  ? "Type a command... (↑ for history)"
                  : "Connecting to MCP backend..."
            }
            disabled={isExecuting || !isConnected}
            style={{ 
              opacity: isExecuting || !isConnected ? 0.7 : 1,
              cursor: isExecuting ? 'wait' : isConnected ? 'text' : 'not-allowed'
            }}
          />
          {isExecuting && (
            <span className={styles.loadingIndicator}>⏳</span>
          )}
        </div>
      </div>
    </div>
  );
}