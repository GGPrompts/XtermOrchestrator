/**
 * MessageRouter Service
 * Centralized WebSocket message routing and handling
 */

const { sendError, sendConnectionEstablished } = require('../utils/WebSocketUtils');

class MessageRouter {
    constructor() {
        this.handlers = new Map();
        this.middleware = [];
        this.onConnectionCallbacks = [];
        this.onDisconnectionCallbacks = [];
    }

    /**
     * Register a message handler for a specific message type
     * @param {string} messageType - Type of message to handle
     * @param {function} handler - Handler function (ws, message) => void
     */
    registerHandler(messageType, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        
        this.handlers.set(messageType, handler);
        console.log(`[MESSAGE-ROUTER] Registered handler for: ${messageType}`);
    }

    /**
     * Register multiple handlers at once
     * @param {object} handlerMap - Object mapping message types to handlers
     */
    registerHandlers(handlerMap) {
        Object.entries(handlerMap).forEach(([messageType, handler]) => {
            this.registerHandler(messageType, handler);
        });
    }

    /**
     * Add middleware to process messages before routing
     * @param {function} middlewareFunction - (ws, message, next) => void
     */
    addMiddleware(middlewareFunction) {
        if (typeof middlewareFunction !== 'function') {
            throw new Error('Middleware must be a function');
        }
        
        this.middleware.push(middlewareFunction);
        console.log('[MESSAGE-ROUTER] Added middleware');
    }

    /**
     * Add callback for new connections
     * @param {function} callback - (ws) => void
     */
    onConnection(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Connection callback must be a function');
        }
        
        this.onConnectionCallbacks.push(callback);
    }

    /**
     * Add callback for disconnections
     * @param {function} callback - (ws) => void
     */
    onDisconnection(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Disconnection callback must be a function');
        }
        
        this.onDisconnectionCallbacks.push(callback);
    }

    /**
     * Handle a new WebSocket connection
     * @param {WebSocket} ws - WebSocket connection
     * @param {object} connectionOptions - Connection options
     */
    handleConnection(ws, connectionOptions = {}) {
        console.log('[MESSAGE-ROUTER] New WebSocket connection');
        
        // Send connection established message
        const capabilities = {
            maxTerminals: connectionOptions.maxTerminals || 10,
            ...connectionOptions.capabilities
        };
        sendConnectionEstablished(ws, capabilities);

        // Set up message handler
        ws.on('message', (data) => {
            this.handleMessage(ws, data);
        });

        // Set up close handler
        ws.on('close', () => {
            console.log('[MESSAGE-ROUTER] WebSocket connection closed');
            this.onDisconnectionCallbacks.forEach(callback => {
                try {
                    callback(ws);
                } catch (error) {
                    console.error('[MESSAGE-ROUTER] Error in disconnection callback:', error);
                }
            });
        });

        // Set up error handler
        ws.on('error', (error) => {
            console.error('[MESSAGE-ROUTER] WebSocket error:', error);
        });

        // Call connection callbacks
        this.onConnectionCallbacks.forEach(callback => {
            try {
                callback(ws);
            } catch (error) {
                console.error('[MESSAGE-ROUTER] Error in connection callback:', error);
            }
        });
    }

    /**
     * Handle an incoming message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Buffer|string} data - Message data
     */
    async handleMessage(ws, data) {
        try {
            // Parse message
            const message = JSON.parse(data.toString());
            console.log('[MESSAGE-ROUTER] Received:', message.type);

            // Run middleware
            let middlewareIndex = 0;
            const next = async () => {
                if (middlewareIndex < this.middleware.length) {
                    const middleware = this.middleware[middlewareIndex++];
                    await middleware(ws, message, next);
                } else {
                    // Route to handler
                    await this.routeMessage(ws, message);
                }
            };

            await next();

        } catch (error) {
            console.error('[MESSAGE-ROUTER] Error handling message:', error);
            sendError(ws, 'Invalid message format');
        }
    }

    /**
     * Route message to appropriate handler
     * @param {WebSocket} ws - WebSocket connection
     * @param {object} message - Parsed message object
     */
    async routeMessage(ws, message) {
        const handler = this.handlers.get(message.type);
        
        if (handler) {
            try {
                await handler(ws, message);
            } catch (error) {
                console.error(`[MESSAGE-ROUTER] Error in handler for ${message.type}:`, error);
                sendError(ws, `Error processing ${message.type}: ${error.message}`);
            }
        } else {
            console.log('[MESSAGE-ROUTER] Unknown message type:', message.type);
            sendError(ws, `Unknown message type: ${message.type}`);
        }
    }

    /**
     * Get statistics about registered handlers
     * @returns {object} Statistics object
     */
    getStats() {
        return {
            handlerCount: this.handlers.size,
            middlewareCount: this.middleware.length,
            connectionCallbackCount: this.onConnectionCallbacks.length,
            disconnectionCallbackCount: this.onDisconnectionCallbacks.length,
            registeredHandlers: Array.from(this.handlers.keys())
        };
    }

    /**
     * Clear all handlers and middleware (useful for testing)
     */
    reset() {
        this.handlers.clear();
        this.middleware = [];
        this.onConnectionCallbacks = [];
        this.onDisconnectionCallbacks = [];
        console.log('[MESSAGE-ROUTER] Reset complete');
    }
}

module.exports = MessageRouter;