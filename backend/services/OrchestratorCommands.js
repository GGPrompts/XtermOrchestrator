/**
 * OrchestratorCommands Service
 * Handles all orchestrator-specific commands, agent spawning, and coordination
 * Supports agent handoff system and specialized agent management
 */

const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const {
  sendOrchestratorResponse,
  sendAgentUpdate,
  sendQueueUpdate,
  sendAgentConnected,
  sendAgentOutput,
} = require("../utils/WebSocketUtils");

class OrchestratorCommands {
  constructor(terminalManager, claudeService) {
    this.terminalManager = terminalManager;
    this.claudeService = claudeService;
    this.promptQueue = [];
    this.agentConnections = new Map(); // Track agent WebSocket connections
    this.orchestratorTerminal = null; // Main orchestrator terminal
    this.inputBuffer = ""; // Buffer for accumulating input
    this.claudeSessionActive = false; // Track if Claude session is active

    console.log(
      "[ORCHESTRATOR-COMMANDS] Service initialized with Claude Code CLI integration"
    );
  }

  /**
   * Handle orchestrator initialization
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} message - Init message
   */
  async handleOrchestratorInit(ws, message) {
    console.log("[ORCHESTRATOR-COMMANDS] Initializing orchestrator terminal");

    try {
      // Create orchestrator's own terminal with real PTY for running Claude Code CLI
      const terminalId = `orchestrator-${uuidv4()}`;
      
      // Create a real PTY terminal through TerminalManager
      // First, we need to create the terminal using the standard createTerminal method
      await this.terminalManager.createTerminal(ws, {
        id: terminalId,
        agentType: 'bash',  // Regular bash terminal for orchestrator
        isOrchestrator: true  // This makes it start at /projects (highest level)
      });

      // Now get the terminal from the manager's internal map
      const terminal = this.terminalManager.getTerminal(terminalId);
      
      // If terminal wasn't created with our ID, find it by looking for the latest
      if (!terminal) {
        const terminals = this.terminalManager.getTerminals();
        // Get the most recently created terminal
        const terminalEntries = Array.from(terminals.entries());
        if (terminalEntries.length > 0) {
          const [latestId, latestTerminal] = terminalEntries[terminalEntries.length - 1];
          this.orchestratorTerminal = latestTerminal;
          // Store the actual ID that was created
          this.orchestratorTerminalId = latestId;
        }
      } else {
        // Store the terminal reference with PTY process
        this.orchestratorTerminal = terminal;
        this.orchestratorTerminalId = terminalId;
      }

      // Simple greeting - Claude IS the orchestrator
      const greeting = `🤖 Orchestrator Terminal Ready\r\n═══════════════════════════════════════\r\n\r\n⚠️  This terminal intercepts orchestrator commands automatically!\r\n\r\n📋 Orchestrator Commands (just type them):\r\n  • ohelp         - Show all orchestrator commands\r\n  • status        - Show active agents\r\n  • spawn test    - Create a test agent\r\n  • send test "pwd" - Send command to agent\r\n\r\n🔧 Regular bash commands work too:\r\n  • ls, pwd, cd   - Standard Linux commands\r\n  • claude        - Start Claude Code CLI\r\n\r\n[Orchestrator]$ `;

      // Use the actual terminal ID that was created
      const actualTerminalId = this.orchestratorTerminalId || terminalId;
      sendAgentOutput(ws, actualTerminalId, greeting);

      sendOrchestratorResponse(
        ws,
        "Orchestrator initialized successfully",
        true
      );
    } catch (error) {
      console.error(
        "[ORCHESTRATOR-COMMANDS] Error initializing orchestrator:",
        error
      );
      sendOrchestratorResponse(
        ws,
        `Failed to initialize orchestrator: ${error.message}`,
        false
      );
    }
  }

  /**
   * Handle orchestrator commands
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} message - Command message
   */
  async handleOrchestratorCommand(ws, message) {
    const { command, terminalId, action, subtype, data, targets } = message;

    try {
      // Handle different message formats from chat interface
      if (action === "send-to-agents" && targets && command) {
        // Handle chat interface sending to multiple agents
        await this._handleChatBroadcast(ws, command, targets);
        return;
      }

      if (subtype === "terminal-input" && data) {
        // Handle direct terminal input to orchestrator with proper buffering
        await this._handleTerminalInput(ws, data);
        return;
      }

      if (!command) {
        console.log("[ORCHESTRATOR-COMMANDS] No command provided in message");
        return;
      }

      // Parse command
      const args = command.trim().split(/\\s+/);
      const cmd = args[0].toLowerCase();

      console.log(`[ORCHESTRATOR-COMMANDS] Processing command: ${cmd}`);

      switch (cmd) {
        case "spawn":
          await this._handleSpawn(ws, args.slice(1));
          break;

        case "spawn-claude":
          await this._handleSpawnClaude(ws, args.slice(1));
          break;

        case "spawn-hidden":
          await this._handleSpawnHidden(ws, args.slice(1));
          break;

        case "status":
          await this._handleStatus(ws);
          break;

        case "send":
          await this._handleSendToAgent(ws, args.slice(1));
          break;

        case "agent-comm":
          await this._handleAgentToAgentComm(ws, args.slice(1));
          break;

        case "broadcast":
          await this._handleBroadcast(ws, args.slice(1));
          break;

        case "logs":
          await this._handleLogs(ws, args.slice(1));
          break;

        case "handoff":
          await this._handleAgentHandoff(ws, args.slice(1));
          break;

        case "queue":
          await this._handleQueue(ws, args.slice(1));
          break;

        case "ohelp":
        case "help":
          this._sendOrchestratorHelp(ws);
          break;

        case "claude":
          await this._handleClaudeCommand(ws, args.slice(1));
          break;

        case "gordon":
        case "gordon-consult":
          await this._handleGordonConsult(ws, args.slice(1));
          break;

        default:
          // Not an orchestrator command - pass through to terminal
          await this._passCommandToTerminal(ws, command);
          break;
      }
    } catch (error) {
      console.error("[ORCHESTRATOR-COMMANDS] Error processing command:", error);
      sendOrchestratorResponse(ws, `Error: ${error.message}`, false);
    }
  }

  /**
   * Handle spawn command
   * @private
   */
  async _handleSpawn(ws, args) {
    if (args.length === 0) {
      sendOrchestratorResponse(
        ws,
        "Usage: spawn <agent-name> [--dir <directory>] [--project <project-name>]",
        false
      );
      return;
    }

    const agentName = args[0];
    const options = this._parseSpawnOptions(args.slice(1));

    await this._spawnAgent(ws, agentName, options);
  }

  /**
   * Handle spawn-claude command
   * @private
   */
  async _handleSpawnClaude(ws, args) {
    if (args.length === 0) {
      sendOrchestratorResponse(
        ws,
        "Usage: spawn-claude <agent-name> [--mcp-servers <servers>] [--system-prompt <prompt>]",
        false
      );
      return;
    }

    const agentName = args[0];
    const options = this._parseSpawnOptions(args.slice(1));
    options.agentType = "claude";

    await this._spawnClaudeAgent(ws, agentName, options);
  }

  /**
   * Handle spawn-hidden command
   * @private
   */
  async _handleSpawnHidden(ws, args) {
    if (args.length === 0) {
      sendOrchestratorResponse(
        ws,
        "Usage: spawn-hidden <agent-name> [options]",
        false
      );
      return;
    }

    const agentName = args[0];
    const options = this._parseSpawnOptions(args.slice(1));
    options.hidden = true;

    await this._spawnAgent(ws, agentName, options);
  }

  /**
   * Handle status command
   * @private
   */
  async _handleStatus(ws) {
    const terminals = this.terminalManager.getTerminals();
    const terminalList = Array.from(terminals.entries()).map(([id, info]) => {
      const handoffInfo = this.terminalManager.getHandoffHistory(id);
      return {
        id: id,
        name: info.agentName || "bash",
        status:
          info.ptyProcess && !info.ptyProcess.killed ? "active" : "inactive",
        created: info.created,
        currentAgent: handoffInfo.currentAgent,
        handoffs: handoffInfo.history.length,
      };
    });

    let statusMessage = `\r\n📊 Agent Status (${terminalList.length} total)\r\n`;
    statusMessage += "═".repeat(50) + "\r\n";

    if (terminalList.length === 0) {
      statusMessage +=
        'No active agents. Use "spawn <name>" to create one.\r\n';
    } else {
      terminalList.forEach((terminal) => {
        const handoffIndicator =
          terminal.handoffs > 0 ? ` (${terminal.handoffs} handoffs)` : "";
        const currentAgent = terminal.currentAgent
          ? ` [${terminal.currentAgent}]`
          : "";
        statusMessage += `• ${terminal.name}${currentAgent} - ${terminal.status}${handoffIndicator}\r\n`;
      });
    }

    statusMessage +=
      '\r\nUse "send <agent> <command>" to interact with agents.\r\n';
    sendOrchestratorResponse(ws, statusMessage);
  }

  /**
   * Handle send to agent command
   * @private
   */
  async _handleSendToAgent(ws, args) {
    if (args.length < 2) {
      sendOrchestratorResponse(ws, "Usage: send <agent-id> <command>", false);
      return;
    }

    const agentId = args[0];
    const command = args.slice(1).join(" ");

    // Find terminal by agent name or ID
    const terminals = this.terminalManager.getTerminals();
    let targetTerminal = null;

    for (const [terminalId, terminal] of terminals) {
      if (terminal.agentName === agentId || terminalId.includes(agentId)) {
        targetTerminal = { terminalId, ...terminal };
        break;
      }
    }

    if (!targetTerminal) {
      sendOrchestratorResponse(
        ws,
        `Agent '${agentId}' not found. Use 'status' to see active agents.`,
        false
      );
      return;
    }

    try {
      targetTerminal.ptyProcess.write(command + "\r");
      sendOrchestratorResponse(ws, `✓ Sent to ${agentId}: ${command}`);
    } catch (error) {
      sendOrchestratorResponse(
        ws,
        `Failed to send to ${agentId}: ${error.message}`,
        false
      );
    }
  }

  /**
   * Handle broadcast command
   * @private
   */
  async _handleBroadcast(ws, args) {
    if (args.length === 0) {
      sendOrchestratorResponse(ws, "Usage: broadcast <command>", false);
      return;
    }

    const command = args.join(" ");
    const terminals = this.terminalManager.getTerminals();

    if (terminals.size === 0) {
      sendOrchestratorResponse(ws, "No active agents to broadcast to.", false);
      return;
    }

    let successCount = 0;
    for (const [terminalId, terminal] of terminals) {
      try {
        terminal.ptyProcess.write(command + "\r");
        successCount++;
      } catch (error) {
        console.error(
          `[ORCHESTRATOR-COMMANDS] Failed to broadcast to ${terminal.agentName}:`,
          error
        );
      }
    }

    sendOrchestratorResponse(
      ws,
      `✓ Broadcast to ${successCount}/${terminals.size} agents: ${command}`
    );
  }

  /**
   * Handle logs command
   * @private
   */
  async _handleLogs(ws, args) {
    if (args.length === 0) {
      sendOrchestratorResponse(ws, "Usage: logs <agent-id> [lines]", false);
      return;
    }

    const agentId = args[0];
    const lines = parseInt(args[1]) || 50;

    // Find terminal by agent name or ID
    const terminals = this.terminalManager.getTerminals();
    let targetTerminal = null;

    for (const [terminalId, terminal] of terminals) {
      if (terminal.agentName === agentId || terminalId.includes(agentId)) {
        targetTerminal = { terminalId, ...terminal };
        break;
      }
    }

    if (!targetTerminal) {
      sendOrchestratorResponse(ws, `Agent '${agentId}' not found.`, false);
      return;
    }

    // Get recent output from buffer
    const recentOutput = targetTerminal.outputBuffer
      .slice(-lines)
      .map((entry) => `[${entry.timestamp.toISOString()}] ${entry.data}`)
      .join("");

    sendOrchestratorResponse(
      ws,
      `\r\n📋 Recent logs for ${agentId} (last ${lines} lines):\r\n${"═".repeat(
        50
      )}\r\n${recentOutput}`
    );
  }

  /**
   * Handle agent handoff command
   * @private
   */
  async _handleAgentHandoff(ws, args) {
    if (args.length < 2) {
      sendOrchestratorResponse(
        ws,
        "Usage: handoff <from-agent> <to-agent> [context-message]",
        false
      );
      return;
    }

    const fromAgent = args[0];
    const toAgent = args[1];
    const contextMessage =
      args.slice(2).join(" ") || "Manual handoff via orchestrator";

    // Find the terminal
    const terminals = this.terminalManager.getTerminals();
    let targetTerminalId = null;

    for (const [terminalId, terminal] of terminals) {
      if (terminal.agentName === fromAgent || terminalId.includes(fromAgent)) {
        targetTerminalId = terminalId;
        break;
      }
    }

    if (!targetTerminalId) {
      sendOrchestratorResponse(ws, `Agent '${fromAgent}' not found.`, false);
      return;
    }

    try {
      const handoffResult = await this.terminalManager.handoffToAgent(
        targetTerminalId,
        toAgent,
        {
          reason: "Orchestrator-initiated handoff",
          message: contextMessage,
        }
      );

      sendOrchestratorResponse(
        ws,
        `✓ Agent handoff completed: ${fromAgent} → ${toAgent}\\nContext: ${contextMessage}`
      );
    } catch (error) {
      sendOrchestratorResponse(
        ws,
        `Failed to handoff from ${fromAgent} to ${toAgent}: ${error.message}`,
        false
      );
    }
  }

  /**
   * Handle queue command
   * @private
   */
  async _handleQueue(ws, args) {
    if (args.length === 0) {
      // Show queue status
      sendQueueUpdate(
        ws,
        "orchestrator",
        this.promptQueue.length,
        this.promptQueue
      );
      return;
    }

    const subCommand = args[0].toLowerCase();
    if (subCommand === "clear") {
      this.promptQueue = [];
      sendOrchestratorResponse(ws, "Prompt queue cleared.");
    } else {
      // Add to queue
      const prompt = args.join(" ");
      this._queuePrompt(ws, prompt);
    }
  }

  /**
   * Handle Gordon consultation command
   * @private
   */
  async _handleGordonConsult(ws, args) {
    if (args.length === 0) {
      sendOrchestratorResponse(
        ws,
        'Usage: gordon <prompt-for-gordon>\nExample: gordon "How should I configure containers for 5 parallel agents?"',
        false
      );
      return;
    }

    const prompt = args.join(" ");

    try {
      sendOrchestratorResponse(
        ws,
        `🐳 Consulting Gordon (Docker AI) about: "${prompt}"`
      );

      // Execute Gordon consultation using docker.exe ai command
      const { spawn } = require("child_process");

      const gordonProcess = spawn("docker.exe", ["ai", "/new", prompt], {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let gordonResponse = "";
      let errorOutput = "";

      gordonProcess.stdout.on("data", (data) => {
        gordonResponse += data.toString();
      });

      gordonProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      gordonProcess.on("close", (code) => {
        if (code === 0 && gordonResponse.trim()) {
          sendOrchestratorResponse(
            ws,
            `\r\n🐳 Gordon's Response:\r\n${"═".repeat(
              50
            )}\r\n${gordonResponse.trim()}\r\n${"═".repeat(50)}\r\n`
          );
        } else {
          sendOrchestratorResponse(
            ws,
            `❌ Gordon consultation failed (code: ${code})\r\n${
              errorOutput || "No response from Gordon"
            }`,
            false
          );
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!gordonProcess.killed) {
          gordonProcess.kill();
          sendOrchestratorResponse(
            ws,
            "⏰ Gordon consultation timed out after 30 seconds",
            false
          );
        }
      }, 30000);
    } catch (error) {
      console.error("[ORCHESTRATOR-COMMANDS] Error consulting Gordon:", error);
      sendOrchestratorResponse(
        ws,
        `Failed to consult Gordon: ${error.message}`,
        false
      );
    }
  }

  /**
   * Handle claude command to start Claude Code CLI session
   * @private
   */
  async _handleClaudeCommand(ws, args) {
    try {
      // Claude CLI should always be available regardless of SDK initialization
      // This starts Claude Code CLI, not the SDK

      // If there are arguments, run claude with args in bash terminal
      if (args.length > 0) {
        sendOrchestratorResponse(ws, `🤖 Running: claude ${args.join(' ')}\r\n`);
        if (this.orchestratorTerminal && this.orchestratorTerminal.ptyProcess) {
          this.orchestratorTerminal.ptyProcess.write(`claude ${args.join(' ')}\r`);
        }
        return;
      }

      // No arguments - start interactive Claude session by running claude in bash
      sendOrchestratorResponse(ws, "🤖 Starting Claude Code CLI...\r\n");
      
      // Send claude command directly to the bash terminal
      if (this.orchestratorTerminal && this.orchestratorTerminal.ptyProcess) {
        this.orchestratorTerminal.ptyProcess.write("claude\r");
        this.claudeSessionActive = true;
        console.log("[ORCHESTRATOR-COMMANDS] Claude command sent to bash terminal");
      } else {
        sendOrchestratorResponse(ws, "Error: Orchestrator terminal not available", false);
      }
    } catch (error) {
      console.error(
        "[ORCHESTRATOR-COMMANDS] Error starting Claude session:",
        error
      );
      sendOrchestratorResponse(
        ws,
        `Failed to start Claude session: ${error.message}`,
        false
      );
    }
  }

  /**
   * Pass non-orchestrator commands to the underlying terminal
   * @private
   */
  async _passCommandToTerminal(ws, command) {
    // Show that command is not recognized in this tool interface
    sendOrchestratorResponse(
      ws,
      `Command not recognized: "${command}". This is a specialized orchestrator terminal.
Available commands: spawn, spawn-claude, status, send, agent-comm, broadcast, logs, handoff, queue, claude, gordon, ohelp
Use 'ohelp' for detailed command reference.`,
      false
    );
  }

  /**
   * Spawn a regular bash agent
   * @private
   */
  async _spawnAgent(ws, agentName, options = {}) {
    const terminals = this.terminalManager.getTerminals();

    if (terminals.size >= this.terminalManager.maxTerminals) {
      sendOrchestratorResponse(
        ws,
        `Cannot spawn agent: Maximum terminals (${this.terminalManager.maxTerminals}) reached.`,
        false
      );
      return;
    }

    try {
      const message = {
        id: uuidv4(),
        agentName: agentName,
        connectionType: "local",
        ...options,
      };

      await this.terminalManager.createTerminal(ws, message);

      // Send agent update
      sendAgentUpdate(ws, {
        id: agentName,
        name: agentName,
        status: "spawning",
        lastUpdate: new Date().toISOString(),
      });

      sendOrchestratorResponse(ws, `✓ Spawning agent: ${agentName}`);
    } catch (error) {
      console.error("[ORCHESTRATOR-COMMANDS] Error spawning agent:", error);
      sendOrchestratorResponse(
        ws,
        `Failed to spawn agent ${agentName}: ${error.message}`,
        false
      );
    }
  }

  /**
   * Handle agent-to-agent communication using fast SDK
   * @private
   */
  async _handleAgentToAgentComm(ws, args) {
    if (args.length < 3) {
      sendOrchestratorResponse(
        ws,
        "Usage: agent-comm <from-agent> <to-agent> <message>",
        false
      );
      return;
    }

    const fromAgent = args[0];
    const toAgent = args[1];
    const message = args.slice(2).join(" ");

    try {
      sendOrchestratorResponse(
        ws,
        `🚀 Fast SDK communication: ${fromAgent} → ${toAgent}`
      );

      const response = await this.claudeService.agentToAgentCommunication(
        fromAgent,
        toAgent,
        message,
        {
          timestamp: new Date().toISOString(),
          communicationType: "sdk-fast",
        }
      );

      sendOrchestratorResponse(
        ws,
        `✓ Agent communication completed: ${response.sessionId || "success"}`
      );
    } catch (error) {
      console.error(
        "[ORCHESTRATOR-COMMANDS] Agent communication failed:",
        error
      );
      sendOrchestratorResponse(
        ws,
        `Failed to communicate between agents: ${error.message}`,
        false
      );
    }
  }

  /**
   * Spawn a Claude AI agent
   * @private
   */
  async _spawnClaudeAgent(ws, agentName, options = {}) {
    const terminals = this.terminalManager.getTerminals();

    if (terminals.size >= this.terminalManager.maxTerminals) {
      sendOrchestratorResponse(
        ws,
        `Cannot spawn Claude agent: Maximum terminals (${this.terminalManager.maxTerminals}) reached.`,
        false
      );
      return;
    }

    try {
      // Validate MCP servers
      const mcpServers = options.mcpServers
        ? this.claudeService.validateMCPServers(options.mcpServers.split(","))
        : [];

      const message = {
        id: uuidv4(),
        agentName: agentName,
        agentType: "claude",
        mcpServers: mcpServers,
        systemPrompt: options.systemPrompt,
        maxTurns: options.maxTurns,
        connectionType: "local",
      };

      await this.terminalManager.createTerminal(ws, message);

      // Send agent update
      sendAgentUpdate(ws, {
        id: agentName,
        name: agentName,
        status: "spawning",
        type: "claude",
        mcpServers: mcpServers,
        lastUpdate: new Date().toISOString(),
      });

      sendOrchestratorResponse(
        ws,
        `✓ Spawning Claude agent: ${agentName} with MCP servers: ${mcpServers.join(
          ", "
        )}`
      );
    } catch (error) {
      console.error(
        "[ORCHESTRATOR-COMMANDS] Error spawning Claude agent:",
        error
      );
      sendOrchestratorResponse(
        ws,
        `Failed to spawn Claude agent ${agentName}: ${error.message}`,
        false
      );
    }
  }

  /**
   * Parse spawn command options
   * @private
   */
  _parseSpawnOptions(args) {
    const options = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === "--dir" && i + 1 < args.length) {
        options.directory = args[i + 1];
        i++; // skip next arg
      } else if (arg === "--project" && i + 1 < args.length) {
        options.project = args[i + 1];
        i++; // skip next arg
      } else if (arg === "--mcp-servers" && i + 1 < args.length) {
        options.mcpServers = args[i + 1];
        i++; // skip next arg
      } else if (arg === "--system-prompt" && i + 1 < args.length) {
        options.systemPrompt = args[i + 1];
        i++; // skip next arg
      } else if (arg === "--max-turns" && i + 1 < args.length) {
        options.maxTurns = parseInt(args[i + 1]);
        i++; // skip next arg
      }
    }

    return options;
  }

  /**
   * Queue a prompt for later processing
   * @private
   */
  _queuePrompt(ws, prompt) {
    const queueItem = {
      id: uuidv4(),
      prompt: prompt,
      timestamp: new Date().toISOString(),
      ws: ws,
    };

    this.promptQueue.push(queueItem);
    sendQueueUpdate(ws, "orchestrator", this.promptQueue.length, [queueItem]);

    console.log(`[ORCHESTRATOR-COMMANDS] Queued prompt: ${prompt}`);
  }

  /**
   * Send orchestrator help
   * @private
   */
  _sendOrchestratorHelp(ws) {
    const helpText = `\r\n🤖 AI Orchestrator Commands\r\n═══════════════════════════════════════\r\n\r\nAgent Management:\r\n• spawn <name> [--dir <path>] [--project <name>]\r\n  Create a new bash agent terminal\r\n\r\n• spawn-claude <name> [--mcp-servers <list>] [--system-prompt <prompt>]\r\n  Create a new Claude AI agent\r\n\r\n• spawn-hidden <name> [options]\r\n  Create a hidden agent (no UI)\r\n\r\nAgent Coordination:\r\n• status\r\n  Show all active agents and their status\r\n\r\n• send <agent> <command>\r\n  Send command to specific agent\r\n\r\n• broadcast <command>\r\n  Send command to all active agents\r\n\r\n• handoff <from-agent> <to-agent> [context]\r\n  Transfer terminal control between agents\r\n\r\n• logs <agent> [lines]\r\n  View recent output from an agent\r\n\r\nAI Integration:\r\n• claude\r\n  Start Claude Code CLI session for intelligent orchestration\r\n  Type 'exit' to return to orchestrator mode\r\n\r\n• gordon <prompt>\r\n  Consult Gordon (Docker AI) for infrastructure advice\r\n  Example: gordon "Configure containers for 5 parallel agents"\r\n\r\nQueue Management:\r\n• queue\r\n  Show current prompt queue\r\n\r\n• queue clear\r\n  Clear the prompt queue\r\n\r\nClaude Code CLI orchestration with multi-agent coordination!\r\n═══════════════════════════════════════\r\n\r\n`;
    sendOrchestratorResponse(ws, helpText);
  }

  /**
   * Get orchestrator statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      promptQueueSize: this.promptQueue.length,
      agentConnections: this.agentConnections.size,
      orchestratorTerminal: !!this.orchestratorTerminal,
      totalCommands: [
        "spawn",
        "spawn-claude",
        "status",
        "send",
        "broadcast",
        "logs",
        "handoff",
        "queue",
        "claude",
        "gordon",
        "help",
      ].length,
    };
  }

  /**
   * Clear prompt queue
   */
  clearQueue() {
    this.promptQueue = [];
  }

  /**
   * Get prompt queue
   * @returns {Array} Current prompt queue
   */
  getQueue() {
    return [...this.promptQueue];
  }

  /**
   * Handle chat interface broadcasting to multiple agents
   * @private
   */
  async _handleChatBroadcast(ws, command, targetIds) {
    const terminals = this.terminalManager.getAllTerminals();
    let successCount = 0;

    console.log(
      `[ORCHESTRATOR-COMMANDS] Chat broadcast to agents: ${targetIds.join(
        ", "
      )}`
    );

    for (const targetId of targetIds) {
      // Find terminal by agent name (targetId)
      const terminal = Array.from(terminals.values()).find(
        (t) => t.agentName === targetId
      );

      if (!terminal) {
        console.warn(
          `[ORCHESTRATOR-COMMANDS] Agent '${targetId}' not found for chat broadcast`
        );
        continue;
      }

      try {
        terminal.ptyProcess.write(command + "\r");
        successCount++;
      } catch (error) {
        console.error(
          `[ORCHESTRATOR-COMMANDS] Failed to send chat message to ${targetId}:`,
          error
        );
      }
    }

    sendOrchestratorResponse(
      ws,
      `✓ Chat sent to ${successCount}/${targetIds.length} agents: ${command}`
    );
  }

  /**
   * Handle terminal input - intercept orchestrator commands or pass to PTY
   * @private
   */
  async _handleTerminalInput(ws, data) {
    if (!this.orchestratorTerminal || !this.orchestratorTerminal.ptyProcess) {
      console.warn("[ORCHESTRATOR-COMMANDS] No orchestrator terminal or PTY process available");
      return;
    }

    try {
      // Buffer input to detect complete commands
      if (!this.inputBuffer) {
        this.inputBuffer = '';
      }

      // Add to buffer
      this.inputBuffer += data;

      // Check for Enter key (carriage return)
      if (data.includes('\r') || data.includes('\n')) {
        // Get the complete command
        const fullCommand = this.inputBuffer.trim();
        this.inputBuffer = ''; // Clear buffer

        // Check if this is an orchestrator command
        const orchestratorCommands = [
          'ohelp', 'status', 'spawn', 'spawn-claude', 'spawn-hidden',
          'send', 'broadcast', 'logs', 'destroy', 'handoff', 'queue', 'gordon'
        ];
        
        const firstWord = fullCommand.split(' ')[0].toLowerCase();
        
        if (orchestratorCommands.includes(firstWord)) {
          // This is an orchestrator command - process it
          console.log(`[ORCHESTRATOR-COMMANDS] Intercepted orchestrator command: ${fullCommand}`);
          
          // Echo the command to terminal for visual feedback
          this.orchestratorTerminal.ptyProcess.write(`${fullCommand}\r\n`);
          
          // Process the orchestrator command
          await this.handleOrchestratorCommand(ws, {
            command: fullCommand,
            terminalId: this.orchestratorTerminal.terminalId
          });
          
          // Show prompt after command completes
          this.orchestratorTerminal.ptyProcess.write('[Orchestrator]$ ');
        } else {
          // Not an orchestrator command - pass to PTY as normal
          this.orchestratorTerminal.ptyProcess.write(data);
        }
      } else if (data === '\x7f' || data === '\b') {
        // Handle backspace
        if (this.inputBuffer.length > 0) {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
        }
        // Pass backspace to PTY for visual feedback
        this.orchestratorTerminal.ptyProcess.write(data);
      } else {
        // Regular character - pass to PTY for echo
        this.orchestratorTerminal.ptyProcess.write(data);
      }
    } catch (error) {
      console.error("[ORCHESTRATOR-COMMANDS] Error handling terminal input:", error);
    }
  }

  /**
   * Handle input during Claude Code session
   * @private
   */
  async _handleClaudeSessionInput(ws, command) {
    const { sendTerminalOutput } = require("../utils/WebSocketUtils");

    // Check for exit command
    if (command.toLowerCase() === "exit") {
      this.claudeSessionActive = false;
      sendTerminalOutput(
        ws,
        this.orchestratorTerminal.terminalId,
        `Exiting Claude Code session. Returning to orchestrator mode.\r\n\r\n$ `
      );
      return;
    }

    try {
      // Execute Claude CLI command with the user input
      await this.claudeService._executeClaudeCLI(
        ws,
        this.orchestratorTerminal.terminalId,
        command,
        {
          sessionId: this.claudeService.sessions.get(
            this.orchestratorTerminal.terminalId
          )?.sessionId,
        }
      );

      // Show claude prompt for next input
      sendTerminalOutput(ws, this.orchestratorTerminal.terminalId, `claude> `);
    } catch (error) {
      console.error("[ORCHESTRATOR-COMMANDS] Error in Claude session:", error);
      sendTerminalOutput(
        ws,
        this.orchestratorTerminal.terminalId,
        `Error: ${error.message}\r\n\r\nclaude> `
      );
    }
  }
}

module.exports = OrchestratorCommands;
