/**
 * TerminalManager Service
 * Manages terminal lifecycle, PTY processes, and agent handoffs
 * Supports seamless transitions between different specialized agents
 */

const pty = require("node-pty");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const {
  sendTerminalCreated,
  sendTerminalOutput,
  sendTerminalExit,
  sendTerminalDestroyed,
  sendTerminalsList,
  sendCommandExecuted,
} = require("../utils/WebSocketUtils");

class TerminalManager {
  constructor(claudeService, maxTerminals = 99) {
    this.terminals = new Map();
    this.terminalTimeouts = new Map();
    this.claudeService = claudeService;
    this.maxTerminals = maxTerminals;
    this.agentHandoffs = new Map(); // Track agent handoffs

    console.log(
      "[TERMINAL-MANAGER] Initialized with max terminals:",
      maxTerminals
    );
  }

  /**
   * Create a new terminal (real PTY or Claude pseudo-PTY)
   * @param {WebSocket} clientWs - Client WebSocket connection
   * @param {object} message - Terminal creation message
   */
  async createTerminal(clientWs, message) {
    if (this.terminals.size >= this.maxTerminals) {
      sendTerminalCreated(
        clientWs,
        message.id,
        false,
        {},
        `Maximum number of terminals (${this.maxTerminals}) reached`
      );
      return;
    }

    // Check for extended connection types
    if (message.connectionType && message.connectionType !== "local") {
      sendTerminalCreated(
        clientWs,
        message.id,
        false,
        {},
        `Connection type '${message.connectionType}' not implemented. Only local terminals are supported.`
      );
      return;
    }

    const terminalId = `terminal-${uuidv4()}`;
    const instanceNumber = this.terminals.size + 1;

    try {
      await this._createTerminalProcess(
        clientWs,
        terminalId,
        instanceNumber,
        message
      );
    } catch (error) {
      console.error(`[TERMINAL-MANAGER] Failed to create terminal:`, error);
      sendTerminalCreated(clientWs, message.id, false, {}, error.message);
    }
  }

  /**
   * Handle terminal command execution
   * @param {WebSocket} clientWs - Client WebSocket connection
   * @param {object} message - Command message
   */
  handleTerminalCommand(clientWs, message) {
    const { terminalId, command } = message;

    const terminalInfo = this.terminals.get(terminalId);
    if (!terminalInfo) {
      sendCommandExecuted(
        clientWs,
        message.id,
        terminalId,
        false,
        {},
        "Terminal not found"
      );
      return;
    }

    // Execute command in PTY - full terminal access
    try {
      terminalInfo.ptyProcess.write(command + "\\r");
      sendCommandExecuted(clientWs, message.id, terminalId, true, {
        command: command,
        timestamp: new Date().toISOString(),
      });

      // Reset timeout
      this._resetTerminalTimeout(terminalId);
    } catch (error) {
      sendCommandExecuted(
        clientWs,
        message.id,
        terminalId,
        false,
        {},
        error.message
      );
    }
  }

  /**
   * Handle direct terminal input
   * @param {WebSocket} clientWs - Client WebSocket connection
   * @param {object} message - Input message
   */
  handleTerminalInput(clientWs, message) {
    const terminalInfo = this.terminals.get(message.terminalId);
    if (!terminalInfo) {
      console.error(
        "[TERMINAL-MANAGER] Terminal not found:",
        message.terminalId
      );
      return;
    }

    try {
      terminalInfo.ptyProcess.write(message.data);
      this._resetTerminalTimeout(message.terminalId);
    } catch (error) {
      console.error("[TERMINAL-MANAGER] Error writing to terminal:", error);
    }
  }

  /**
   * Handle terminal resize
   * @param {WebSocket} clientWs - Client WebSocket connection
   * @param {object} message - Resize message
   */
  handleTerminalResize(clientWs, message) {
    const terminalInfo = this.terminals.get(message.terminalId);
    if (!terminalInfo) {
      console.error(
        "[TERMINAL-MANAGER] Terminal not found for resize:",
        message.terminalId
      );
      return;
    }

    try {
      terminalInfo.ptyProcess.resize(message.cols || 80, message.rows || 24);
      console.log(
        `[TERMINAL-MANAGER] Resized terminal ${message.terminalId} to ${message.cols}x${message.rows}`
      );
    } catch (error) {
      console.error("[TERMINAL-MANAGER] Error resizing terminal:", error);
    }
  }

  /**
   * Destroy a terminal
   * @param {WebSocket} clientWs - Client WebSocket connection
   * @param {object} message - Destroy message
   */
  handleDestroyTerminal(clientWs, message) {
    const terminalId = message.terminalId;
    const terminalInfo = this.terminals.get(terminalId);

    if (!terminalInfo) {
      sendTerminalDestroyed(
        clientWs,
        message.id,
        terminalId,
        false,
        "Terminal not found"
      );
      return;
    }

    try {
      // Kill the PTY process
      terminalInfo.ptyProcess.kill();

      // Clean up
      this.terminals.delete(terminalId);
      clearTimeout(this.terminalTimeouts.get(terminalId));
      this.terminalTimeouts.delete(terminalId);

      // Clean up agent handoff tracking
      this.agentHandoffs.delete(terminalId);

      sendTerminalDestroyed(
        clientWs,
        message.id,
        terminalId,
        true,
        "Terminal destroyed successfully"
      );
      console.log(`[TERMINAL-MANAGER] Destroyed terminal: ${terminalId}`);
    } catch (error) {
      console.error("[TERMINAL-MANAGER] Error destroying terminal:", error);
      sendTerminalDestroyed(
        clientWs,
        message.id,
        terminalId,
        false,
        error.message
      );
    }
  }

  /**
   * List all terminals
   * @param {WebSocket} clientWs - Client WebSocket connection
   * @param {object} message - List message
   */
  handleListTerminals(clientWs, message) {
    const terminalList = Array.from(this.terminals.entries()).map(
      ([id, info]) => ({
        id: id,
        instanceNumber: info.instanceNumber,
        agentName: info.agentName || "bash",
        status:
          info.ptyProcess && !info.ptyProcess.killed ? "active" : "inactive",
        created: info.created,
        lastActivity: info.lastActivity,
        currentAgent: this.agentHandoffs.get(id)?.currentAgent || null,
        handoffHistory: this.agentHandoffs.get(id)?.history || [],
      })
    );

    sendTerminalsList(clientWs, message.id, true, { terminals: terminalList });
  }

  /**
   * Agent Handoff System - Transfer terminal control to different agent
   * @param {string} terminalId - Terminal ID
   * @param {string} newAgentName - Name of new agent to hand off to
   * @param {object} context - Context to pass to new agent
   */
  async handoffToAgent(terminalId, newAgentName, context = {}) {
    const terminalInfo = this.terminals.get(terminalId);
    if (!terminalInfo) {
      throw new Error(`Terminal ${terminalId} not found for handoff`);
    }

    // Initialize handoff tracking if not exists
    if (!this.agentHandoffs.has(terminalId)) {
      this.agentHandoffs.set(terminalId, {
        currentAgent: terminalInfo.agentName || "bash",
        history: [],
      });
    }

    const handoffInfo = this.agentHandoffs.get(terminalId);
    const previousAgent = handoffInfo.currentAgent;

    // Record the handoff
    handoffInfo.history.push({
      timestamp: new Date().toISOString(),
      fromAgent: previousAgent,
      toAgent: newAgentName,
      context: context,
      reason: context.reason || "Manual handoff",
    });

    // Update current agent
    handoffInfo.currentAgent = newAgentName;
    terminalInfo.agentName = newAgentName;

    // Send handoff notification to terminal
    terminalInfo.ptyProcess.write(
      `\r\n🔄 Agent handoff: ${previousAgent} → ${newAgentName}\r\n`
    );
    if (context.message) {
      terminalInfo.ptyProcess.write(`📝 Context: ${context.message}\r\n`);
    }
    terminalInfo.ptyProcess.write(`\r\n`);

    console.log(
      `[TERMINAL-MANAGER] Agent handoff completed: ${previousAgent} → ${newAgentName} for terminal ${terminalId}`
    );

    return {
      terminalId,
      previousAgent,
      newAgent: newAgentName,
      handoffTime: new Date().toISOString(),
      context,
    };
  }

  /**
   * Get agent handoff history for a terminal
   * @param {string} terminalId - Terminal ID
   * @returns {object} Handoff information
   */
  getHandoffHistory(terminalId) {
    const handoffInfo = this.agentHandoffs.get(terminalId);
    if (!handoffInfo) {
      return { currentAgent: null, history: [] };
    }
    return handoffInfo;
  }

  /**
   * Create the actual terminal process (PTY or Claude pseudo-PTY)
   * @private
   */
  async _createTerminalProcess(clientWs, terminalId, instanceNumber, message) {
    // Determine if this should be a Claude agent or regular terminal
    const isClaudeAgent = message.agentType === "claude" || message.mcpServers;
    let ptyProcess;

    if (isClaudeAgent) {
      // Create real PTY running Claude CLI for agents
      const agentWorkspace = `/workspaces/agent-${instanceNumber}`;
      const agentName = message.agentName || `claude-agent-${instanceNumber}`;
      
      // Ensure workspace exists
      fs.mkdirSync(agentWorkspace, { recursive: true });

      // Build Claude CLI command with MCP servers and system prompt
      let claudeArgs = [];
      if (message.mcpServers && message.mcpServers.length > 0) {
        claudeArgs.push("--mcp-servers", message.mcpServers.join(","));
      }
      if (message.systemPrompt) {
        claudeArgs.push("--append-system-prompt", message.systemPrompt);
      }
      if (message.maxTurns) {
        claudeArgs.push("--max-turns", message.maxTurns.toString());
      }

      ptyProcess = pty.spawn("claude", claudeArgs, {
        name: "xterm-color", 
        cols: 80,
        rows: 24,
        cwd: agentWorkspace,
        env: {
          ...process.env,
          PATH: "/usr/local/bin:" + process.env.PATH,
          TERM: "xterm-256color",
          WORKSPACE_DIR: agentWorkspace,
          AGENT_NAME: agentName,
          CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
        },
      });
    } else {
      // Create real PTY process
      // Check if a custom working directory was specified
      let workingDir;
      if (message.isOrchestrator) {
        // Orchestrator starts at root to see all mounted directories
        // From here they can access:
        // /app - ai-orchestrator backend
        // /projects - gg-projects 
        // /shared - shared resources
        // /workspaces - agent workspaces
        workingDir = '/';  // Root of container to see all mounts
      } else if (message.directory) {
        // Direct directory path specified with --dir
        workingDir = message.directory;
      } else if (message.project) {
        // Project name specified with --project
        // Map to /projects/<project-name> which is /home/matt/projects/gg-projects/<project-name>
        workingDir = `/projects/${message.project}`;
      } else if (message.cwd) {
        // Custom directory specified (legacy support)
        workingDir = message.cwd;
      } else {
        // Default agent workspace
        workingDir = `/workspaces/agent-${instanceNumber}`;
        // Ensure workspace exists
        fs.mkdirSync(workingDir, { recursive: true });
      }

      ptyProcess = pty.spawn("bash", ["--login"], {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: workingDir,
        env: {
          ...process.env,
          PATH: `/home/node/bin:/home/node/node_modules/.bin:${process.env.PATH}`,
          TERM: "xterm-color",
          AGENT_WORKSPACE: agentWorkspace,
          AGENT_ID: instanceNumber.toString(),
        },
      });
    }

    // Store terminal info
    const terminalInfo = {
      terminalId: terminalId,
      instanceNumber: instanceNumber,
      ptyProcess: ptyProcess,
      clientWs: clientWs,
      agentName:
        message.agentName ||
        (isClaudeAgent
          ? `claude-agent-${instanceNumber}`
          : `agent-${instanceNumber}`),
      created: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      outputBuffer: [],
      isClaudeAgent: isClaudeAgent,
    };

    this.terminals.set(terminalId, terminalInfo);

    // Set up PTY event handlers
    this._setupTerminalEventHandlers(terminalId, terminalInfo);

    // Set up timeout
    this._resetTerminalTimeout(terminalId);

    // Send initial setup commands for regular terminals
    if (!isClaudeAgent) {
      ptyProcess.write(
        `# Agent ${instanceNumber} Workspace: ${terminalInfo.ptyProcess.options?.cwd}\r\n`
      );
      ptyProcess.write(
        `# You are restricted to: ${terminalInfo.ptyProcess.options?.cwd}\r\n`
      );
      ptyProcess.write(
        `# Claude will not be able to access files outside this directory.\r\n`
      );
      ptyProcess.write(`# Type 'claude' to start AI assistance.\r\n`);
      ptyProcess.write(
        `# Terminal ${instanceNumber} ready. Isolated environment active.\r\n\r\n`
      );
    }

    // Send success response
    sendTerminalCreated(clientWs, message.id, true, {
      terminalId: terminalId,
      data: {
        instanceNumber: instanceNumber,
        cols: 80,
        rows: 24,
        agentName: terminalInfo.agentName,
        isClaudeAgent: isClaudeAgent,
      },
    });
  }

  /**
   * Set up event handlers for a terminal
   * @private
   */
  _setupTerminalEventHandlers(terminalId, terminalInfo) {
    const { ptyProcess, clientWs } = terminalInfo;

    // Handle PTY output
    ptyProcess.on("data", (data) => {
      // Monitor and log output
      this._monitorAgentOutput(terminalId, data);

      // Send to client
      sendTerminalOutput(clientWs, terminalId, data);

      // Buffer for potential monitoring
      terminalInfo.outputBuffer.push({
        timestamp: new Date(),
        data: data,
      });

      // Keep buffer size reasonable
      if (terminalInfo.outputBuffer.length > 1000) {
        terminalInfo.outputBuffer.shift();
      }

      // Update last activity
      terminalInfo.lastActivity = new Date().toISOString();
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(
        `[TERMINAL-MANAGER] Terminal ${terminalId} exited with code ${exitCode}`
      );
      sendTerminalExit(clientWs, terminalId, exitCode, signal);
      this.terminals.delete(terminalId);
      clearTimeout(this.terminalTimeouts.get(terminalId));
      this.terminalTimeouts.delete(terminalId);
      this.agentHandoffs.delete(terminalId);
    });
  }

  /**
   * Reset terminal timeout
   * @private
   */
  _resetTerminalTimeout(terminalId) {
    // Clear existing timeout
    const existingTimeout = this.terminalTimeouts.get(terminalId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new 30-minute timeout
    const timeout = setTimeout(() => {
      console.log(
        `[TERMINAL-MANAGER] Terminal ${terminalId} timed out due to inactivity`
      );
      const terminalInfo = this.terminals.get(terminalId);
      if (terminalInfo) {
        terminalInfo.ptyProcess.kill();
        this.terminals.delete(terminalId);
        this.terminalTimeouts.delete(terminalId);
        this.agentHandoffs.delete(terminalId);
      }
    }, 30 * 60 * 1000); // 30 minutes

    this.terminalTimeouts.set(terminalId, timeout);
  }

  /**
   * Log terminal output to file
   * @private
   */
  _logTerminalOutput(terminalId, data) {
    try {
      const logDir = path.join(__dirname, "..", "logs", terminalId);
      fs.mkdirSync(logDir, { recursive: true });

      const logFile = path.join(logDir, "recent.log");
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${data}`;

      fs.appendFileSync(logFile, logEntry);

      // Also create daily log files
      const dailyLogDir = path.join(logDir, "outputs");
      fs.mkdirSync(dailyLogDir, { recursive: true });

      const today = new Date().toISOString().split("T")[0];
      const dailyLogFile = path.join(dailyLogDir, `${today}.log`);
      fs.appendFileSync(dailyLogFile, logEntry);
    } catch (error) {
      console.error("[TERMINAL-MANAGER] Error logging terminal output:", error);
    }
  }

  /**
   * Monitor agent output for special patterns or commands
   * @private
   */
  _monitorAgentOutput(terminalId, data) {
    // Log the output
    this._logTerminalOutput(terminalId, data);

    // Check for agent handoff requests
    const handoffPattern = /handoff-to:(\w+)(?:\s+(.+))?/i;
    const match = data.toString().match(handoffPattern);

    if (match) {
      const newAgentName = match[1];
      const context = {
        reason: "Agent requested handoff",
        message: match[2] || "No context provided",
      };

      this.handoffToAgent(terminalId, newAgentName, context).catch((error) => {
        console.error("[TERMINAL-MANAGER] Error in agent handoff:", error);
      });
    }
  }

  /**
   * Get all terminals
   * @returns {Map} Map of terminal ID to terminal info
   */
  getTerminals() {
    return this.terminals;
  }

  /**
   * Get terminal by ID
   * @param {string} terminalId - Terminal ID
   * @returns {object} Terminal info or null
   */
  getTerminal(terminalId) {
    return this.terminals.get(terminalId) || null;
  }

  /**
   * Get terminal manager statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      totalTerminals: this.terminals.size,
      maxTerminals: this.maxTerminals,
      activeHandoffs: this.agentHandoffs.size,
      terminalsWithHandoffs: Array.from(this.agentHandoffs.keys()).length,
    };
  }
}

module.exports = TerminalManager;
