import React, { useEffect, useCallback, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { CanvasAddon } from 'xterm-addon-canvas';

interface UnifiedTerminalInterfaceProps {
  websocket: WebSocket;
  onCommand?: (command: string) => void;
}

interface TerminalState {
  mode: 'normal' | 'menu' | 'guide' | 'experiment';
  context: any;
}

export default function UnifiedTerminalInterface({ websocket, onCommand }: UnifiedTerminalInterfaceProps) {
  const [terminal] = useState<Terminal>(new Terminal({
    cursorBlink: true,
    fontSize: 14,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
    },
  }));
  
  const [state, setState] = useState<TerminalState>({
    mode: 'normal',
    context: {}
  });

  // Natural language command patterns
  const commandPatterns = {
    launch: /^(launch|start|create|spin up)\s+(\d+\s+)?(claude|gpt|copilot|gordon|ai)s?\s*(.*)?$/i,
    experiment: /^(experiment|test|compare|a\/b test)\s*(.*)?$/i,
    help: /^(help|guide|how to|explain)\s*(.*)?$/i,
    status: /^(status|check|show|list)\s*(instances|terminals|experiments)?$/i,
    configure: /^(configure|setup|config)\s*(mcp|ai|experiment)?$/i,
  };

  // ASCII UI Components
  const renderMenu = (title: string, options: Array<{key: string, label: string, desc?: string}>) => {
    const width = 55;
    const border = '─'.repeat(width - 2);
    
    let output = `\r\n┌${border}┐\r\n`;
    output += `│ ${title.padEnd(width - 4)} │\r\n`;
    output += `├${border}┤\r\n`;
    
    options.forEach((opt, idx) => {
      const key = `[${opt.key}]`.padEnd(4);
      const label = opt.label.padEnd(20);
      const desc = opt.desc ? `${opt.desc}` : '';
      const line = ` ${key} ${label} ${desc}`;
      output += `│${line.padEnd(width - 2)}│\r\n`;
    });
    
    output += `└${border}┘\r\n`;
    return output;
  };

  // Handle natural language commands
  const processCommand = useCallback((input: string) => {
    const trimmed = input.trim().toLowerCase();
    
    // Check for launch commands
    if (commandPatterns.launch.test(trimmed)) {
      const match = trimmed.match(commandPatterns.launch);
      if (match) {
        const count = match[2] ? parseInt(match[2]) : 1;
        const aiType = match[3];
        showAILaunchMenu(aiType, count);
        return;
      }
    }
    
    // Check for experiment commands
    if (commandPatterns.experiment.test(trimmed)) {
      showExperimentMenu();
      return;
    }
    
    // Check for help commands
    if (commandPatterns.help.test(trimmed)) {
      const match = trimmed.match(commandPatterns.help);
      const topic = match?.[2] || 'general';
      showHelp(topic);
      return;
    }
    
    // Check for status commands
    if (commandPatterns.status.test(trimmed)) {
      showStatus();
      return;
    }
    
    // Default: send to orchestrator
    if (onCommand) {
      onCommand(input);
    }
  }, []);

  // Show AI Launch Menu
  const showAILaunchMenu = (aiType: string, count: number) => {
    setState({ mode: 'menu', context: { aiType, count } });
    
    const menu = renderMenu('🚀 AI LAUNCH CONFIGURATION', [
      { key: '1', label: 'Claude 3 Opus', desc: '💬 Complex tasks' },
      { key: '2', label: 'Claude 3 Sonnet', desc: '⚡ Fast & capable' },
      { key: '3', label: 'GPT-4', desc: '🧠 Alternative' },
      { key: '4', label: 'GitHub Copilot', desc: '💻 Code-focused' },
      { key: '5', label: 'Gordon (Docker)', desc: '🐳 Containers' },
      { key: '6', label: 'Custom AI...', desc: '➕ Add your own' },
    ]);
    
    terminal.write('\r\n' + menu);
    terminal.write('\r\n🎤 Say the number or AI name: ');
  };

  // Show Experiment Menu
  const showExperimentMenu = () => {
    setState({ mode: 'experiment', context: {} });
    
    const menu = renderMenu('🧪 EXPERIMENT CONFIGURATOR', [
      { key: '1', label: 'Coding styles', desc: '(minimal/verbose/functional/OOP)' },
      { key: '2', label: 'Performance', desc: '(speed/memory/readability)' },
      { key: '3', label: 'Frameworks', desc: '(React/Vue/Svelte/vanilla)' },
      { key: '4', label: 'Feature sets', desc: '(MVP/standard/premium)' },
      { key: '5', label: 'Custom...', desc: '(define your own)' },
    ]);
    
    terminal.write('\r\n' + menu);
    terminal.write('\r\nHow many variations? (2-4): ');
  };

  // Show Help
  const showHelp = (topic: string) => {
    const helpText = renderMenu('📚 HELP: ' + topic.toUpperCase(), [
      { key: 'launch', label: 'Launch AI instances' },
      { key: 'experiment', label: 'Run experiments' },
      { key: 'configure', label: 'Configuration options' },
      { key: 'status', label: 'Check status' },
      { key: 'voice', label: 'Voice commands' },
    ]);
    
    terminal.write('\r\n' + helpText);
    terminal.write('\r\nType a topic or say "back" to continue: ');
  };

  // Show Status
  const showStatus = () => {
    websocket.send(JSON.stringify({
      type: 'get-status',
      includeExperiments: true
    }));
  };

  // Voice command integration
  const handleVoiceCommand = useCallback((transcript: string) => {
    terminal.write(`\r\n🎤 "${transcript}"\r\n`);
    processCommand(transcript);
  }, [processCommand]);

  useEffect(() => {
    // Listen for Ctrl+H
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        terminal.write('\r\n🎤 Listening... ');
        // This triggers Windows voice recognition
        // The actual voice handling would be done by the Windows system
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Terminal input handler
    terminal.onData((data) => {
      if (data === '\r') {
        const line = terminal.buffer.active.getLine(terminal.buffer.active.cursorY);
        if (line) {
          const command = line.translateToString(true).split(':').pop()?.trim() || '';
          processCommand(command);
        }
      } else {
        terminal.write(data);
      }
    });
    
    // WebSocket message handler
    websocket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'status-response') {
        const statusDisplay = renderMenu('📊 SYSTEM STATUS', 
          message.instances.map((inst: any) => ({
            key: inst.id,
            label: inst.name,
            desc: inst.status
          }))
        );
        terminal.write('\r\n' + statusDisplay);
      }
    });
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [terminal, websocket, processCommand, handleVoiceCommand]);

  // Welcome message
  useEffect(() => {
    const welcome = `
╔══════════════════════════════════════════════════════╗
║          🚀 Unified AI Terminal Interface            ║
║                                                      ║
║  Voice Commands: Press Ctrl+H to speak              ║
║  Type 'help' for guide or just start talking!       ║
║                                                      ║
║  Examples:                                           ║
║   • "Launch 4 Claudes"                              ║
║   • "Start experiment with different frameworks"     ║
║   • "Show status"                                   ║
║   • "Help me build a chat app"                      ║
╚══════════════════════════════════════════════════════╝

> `;
    
    terminal.write(welcome);
  }, [terminal]);

  return (
    <div 
      ref={(el) => {
        if (el && terminal.element) {
          el.appendChild(terminal.element);
          const fitAddon = new FitAddon();
          terminal.loadAddon(fitAddon);
          fitAddon.fit();
        }
      }}
      style={{ 
        width: '100%', 
        height: '100%',
        backgroundColor: '#1e1e1e'
      }}
    />
  );
}