/**
 * WebSocket Utility Functions
 * Centralized message sending utilities to eliminate duplicate JSON.stringify calls
 */

/**
 * Send a basic message via WebSocket
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} type - Message type
 * @param {object} data - Message data
 */
function sendMessage(ws, type, data = {}) {
    if (!ws || ws.readyState !== 1) { // WebSocket.OPEN = 1
        console.warn('[WEBSOCKET] Attempted to send message to closed connection:', type);
        return false;
    }
    
    try {
        ws.send(JSON.stringify({ type, data }));
        return true;
    } catch (error) {
        console.error('[WEBSOCKET] Error sending message:', error);
        return false;
    }
}

/**
 * Send a response message with success/error status
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} type - Response type
 * @param {boolean} success - Success status
 * @param {object} data - Response data
 * @param {string} error - Error message (if success is false)
 */
function sendResponse(ws, type, success, data = {}, error = null) {
    if (!ws || ws.readyState !== 1) {
        console.warn('[WEBSOCKET] Attempted to send response to closed connection:', type);
        return false;
    }
    
    const response = {
        type,
        success,
        ...data
    };
    
    if (!success && error) {
        response.error = error;
    }
    
    try {
        ws.send(JSON.stringify(response));
        return true;
    } catch (err) {
        console.error('[WEBSOCKET] Error sending response:', err);
        return false;
    }
}

/**
 * Send terminal creation response
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} id - Terminal ID
 * @param {boolean} success - Success status
 * @param {object} terminalData - Terminal data (if success)
 * @param {string} error - Error message (if failed)
 */
function sendTerminalCreated(ws, id, success, terminalData = {}, error = null) {
    const response = {
        type: 'terminal-created',
        id,
        success
    };
    
    if (success) {
        Object.assign(response, terminalData);
    } else if (error) {
        response.error = error;
    }
    
    return sendRawMessage(ws, response);
}

/**
 * Send terminal data (output from PTY)
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} id - Terminal ID
 * @param {string} data - Terminal output data
 */
function sendTerminalData(ws, id, data) {
    return sendMessage(ws, 'terminal-data', { id, data });
}

/**
 * Send terminal output (alternative format)
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} terminalId - Terminal ID
 * @param {string} data - Terminal output data
 */
function sendTerminalOutput(ws, terminalId, data) {
    return sendRawMessage(ws, {
        type: 'terminal-output',
        terminalId,
        data
    });
}

/**
 * Send terminal exit notification
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} terminalId - Terminal ID
 * @param {number} exitCode - Process exit code
 * @param {string} signal - Exit signal
 */
function sendTerminalExit(ws, terminalId, exitCode = 0, signal = null) {
    return sendRawMessage(ws, {
        type: 'terminal-exit',
        terminalId,
        exitCode,
        signal
    });
}

/**
 * Send terminal close notification
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} id - Terminal ID
 * @param {number} exitCode - Process exit code
 */
function sendTerminalClosed(ws, id, exitCode = 0) {
    return sendMessage(ws, 'terminal-closed', { id, exitCode });
}

/**
 * Send error message
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} error - Error message
 * @param {string} type - Error type (default: 'error')
 */
function sendError(ws, error, type = 'error') {
    return sendRawMessage(ws, { type, error });
}

/**
 * Send connection established message
 * @param {WebSocket} ws - WebSocket connection
 * @param {object} capabilities - System capabilities
 */
function sendConnectionEstablished(ws, capabilities = {}) {
    return sendMessage(ws, 'connection-established', {
        capabilities: ['terminal-management', 'multi-terminal', 'command-execution', 'real-pty'],
        maxTerminals: capabilities.maxTerminals || 10,
        ...capabilities
    });
}

/**
 * Send raw message object (for complex messages)
 * @param {WebSocket} ws - WebSocket connection
 * @param {object} message - Message object to send
 */
function sendRawMessage(ws, message) {
    if (!ws || ws.readyState !== 1) {
        console.warn('[WEBSOCKET] Attempted to send raw message to closed connection');
        return false;
    }
    
    try {
        ws.send(JSON.stringify(message));
        return true;
    } catch (error) {
        console.error('[WEBSOCKET] Error sending raw message:', error);
        return false;
    }
}

/**
 * Broadcast message to multiple WebSocket connections
 * @param {Array<WebSocket>} connections - Array of WebSocket connections
 * @param {string} type - Message type
 * @param {object} data - Message data
 */
function broadcastMessage(connections, type, data = {}) {
    let successCount = 0;
    
    connections.forEach(ws => {
        if (sendMessage(ws, type, data)) {
            successCount++;
        }
    });
    
    return successCount;
}

/**
 * Send orchestrator command response
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} command - Command that was executed
 * @param {boolean} success - Success status
 * @param {string} output - Command output
 * @param {string} error - Error message (if failed)
 */
function sendCommandResponse(ws, command, success, output = '', error = null) {
    return sendResponse(ws, 'orchestrator-response', success, {
        command,
        output
    }, error);
}

/**
 * Send command executed response
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} id - Message ID
 * @param {string} terminalId - Terminal ID
 * @param {boolean} success - Success status
 * @param {object} data - Response data
 * @param {string} error - Error message (if failed)
 */
function sendCommandExecuted(ws, id, terminalId, success, data = {}, error = null) {
    const response = {
        type: 'command-executed',
        id,
        terminalId,
        success,
        ...data
    };
    
    if (!success && error) {
        response.error = error;
    }
    
    return sendRawMessage(ws, response);
}

/**
 * Send terminal destroyed response
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} id - Message ID
 * @param {string} terminalId - Terminal ID
 * @param {boolean} success - Success status
 * @param {string} error - Error message (if failed)
 */
function sendTerminalDestroyed(ws, id, terminalId, success, error = null) {
    return sendResponse(ws, 'terminal-destroyed', success, { id, terminalId }, error);
}

/**
 * Send terminals list response
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} id - Message ID
 * @param {Array} terminals - Array of terminal objects
 */
function sendTerminalsList(ws, id, terminals) {
    return sendRawMessage(ws, {
        type: 'terminals-list',
        id,
        terminals
    });
}

/**
 * Send orchestrator response
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} data - Response data/message
 * @param {boolean} success - Optional success status (defaults to true)
 */
function sendOrchestratorResponse(ws, data, success = true) {
    return sendMessage(ws, 'orchestrator-response', { data, success });
}

/**
 * Send terminal timeout notification
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} terminalId - Terminal ID
 */
function sendTerminalTimeout(ws, terminalId) {
    return sendRawMessage(ws, {
        type: 'terminal-timeout',
        terminalId
    });
}

/**
 * Send agent update notification
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} agentId - Agent ID
 * @param {object} status - Agent status object
 */
function sendAgentUpdate(ws, agentId, status) {
    return sendRawMessage(ws, {
        type: 'agent-update',
        agentId,
        status
    });
}

/**
 * Send queue update notification
 * @param {WebSocket} ws - WebSocket connection
 * @param {Array} queue - Queue array
 */
function sendQueueUpdate(ws, queue) {
    return sendRawMessage(ws, {
        type: 'queue-update',
        queue
    });
}

/**
 * Send agent connected notification
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} agentId - Agent ID
 * @param {number} cols - Terminal columns
 * @param {number} rows - Terminal rows
 */
function sendAgentConnected(ws, agentId, cols, rows) {
    return sendRawMessage(ws, {
        type: 'agent-connected',
        agentId,
        cols,
        rows
    });
}

/**
 * Send agent output
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} agentId - Agent ID
 * @param {string} data - Output data
 */
function sendAgentOutput(ws, agentId, data) {
    return sendRawMessage(ws, {
        type: 'agent-output',
        agentId,
        data
    });
}

module.exports = {
    sendMessage,
    sendResponse,
    sendTerminalCreated,
    sendTerminalData,
    sendTerminalOutput,
    sendTerminalExit,
    sendTerminalClosed,
    sendError,
    sendConnectionEstablished,
    sendRawMessage,
    broadcastMessage,
    sendCommandResponse,
    sendCommandExecuted,
    sendTerminalDestroyed,
    sendTerminalsList,
    sendOrchestratorResponse,
    sendTerminalTimeout,
    sendAgentUpdate,
    sendQueueUpdate,
    sendAgentConnected,
    sendAgentOutput
};