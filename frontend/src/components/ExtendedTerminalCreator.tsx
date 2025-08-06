/**
 * Unified Terminal Creator Component
 * 
 * Simplified terminal creation interface for the Unified Terminal Interface:
 * - Create terminals with full MCP toolkit access
 * - Clean, simple interface focused on terminal creation
 * - Let Claude Code's /agents handle specialization
 */

import React, { useState, useEffect } from 'react';
import styles from './ExtendedTerminalCreator.module.css';

export type ConnectionType = 'ai-single' | 'ai-experiment' | 'ai-custom' | 'local';

export interface AIConnectionConfig {
  aiModel: 'claude-opus' | 'claude-sonnet' | 'gpt4' | 'copilot' | 'gordon' | 'custom';
  apiEndpoint?: string;
  apiKey?: string;
}

export interface ExperimentConfig {
  mode: 'parallel' | 'variations' | 'comparison';
  instanceCount: number;
  basePrompt?: string;
  variations?: {
    type: 'coding-style' | 'framework' | 'performance' | 'features' | 'custom';
    options?: string[];
  };
  useWorktrees: boolean;
}

export interface MCPConfig {
  'github-official'?: boolean;
  dockerhub?: boolean;
  context7?: boolean;
  'wikipedia-mcp'?: boolean;
  customServers?: Array<{
    name: string;
    endpoint: string;
  }>;
}

export interface ExtendedTerminalConfig {
  connectionType: ConnectionType;
  project?: string;
  branch?: string;
  title: string;
  shell: 'powershell' | 'bash' | 'cmd' | 'zsh';
  aiConfig?: AIConnectionConfig;
  experimentConfig?: ExperimentConfig;
  mcpConfig?: MCPConfig;
  prompt?: string;
  launchConfig?: any; // Container launch configuration
  experimentLaunchConfigs?: any[]; // For parallel experiments
}

interface ExtendedTerminalCreatorProps {
  onCreateTerminal: (config: ExtendedTerminalConfig) => void;
  onCancel: () => void;
  isVisible: boolean;
}

// Import MCP Config Manager and Server Detector
import { mcpConfigManager } from '../services/MCPConfigManager';
import { mcpServerDetector, MCPServer } from '../services/MCPServerDetector';

export default function ExtendedTerminalCreator({ 
  onCreateTerminal, 
  onCancel, 
  isVisible 
}: ExtendedTerminalCreatorProps) {
  const [connectionType, setConnectionType] = useState<ConnectionType>('ai-single');
  const [project, setProject] = useState('gg-devhub');
  const [branch, setBranch] = useState('main');
  const [title, setTitle] = useState('');
  const [shell, setShell] = useState<'powershell' | 'bash' | 'cmd' | 'zsh'>('bash');
  const [prompt, setPrompt] = useState('');
  const [availableMCPServers, setAvailableMCPServers] = useState<MCPServer[]>([]);
  const [totalTools, setTotalTools] = useState<number>(0);

  // AI Configuration
  const [aiConfig, setAiConfig] = useState<AIConnectionConfig>({
    aiModel: 'claude-opus'
  });

  // Experiment Configuration
  const [experimentConfig, setExperimentConfig] = useState<ExperimentConfig>({
    mode: 'parallel',
    instanceCount: 4,
    useWorktrees: true,
    variations: {
      type: 'framework'
    }
  });

  // MCP Configuration - Full toolkit access by default
  const [mcpConfig, setMcpConfig] = useState<MCPConfig>({
    'github-official': true,
    dockerhub: true,
    context7: true,
    'wikipedia-mcp': true
  });

  // Fetch available MCP servers when component mounts
  useEffect(() => {
    const fetchMCPServers = async () => {
      const response = await mcpServerDetector.getAvailableServers();
      setAvailableMCPServers(response.servers);
      setTotalTools(response.total_tools);
      
      // Update mcpConfig with available servers
      const newMcpConfig: any = {};
      response.servers.forEach(server => {
        newMcpConfig[server.id] = server.enabled;
      });
      setMcpConfig(newMcpConfig);
    };
    
    if (isVisible) {
      fetchMCPServers();
    }
  }, [isVisible]);

  // Update title when connection type changes
  useEffect(() => {
    if (!title || title.startsWith('AI ')) {
      switch (connectionType) {
        case 'ai-single':
          setTitle(`AI: ${aiConfig.aiModel}`);
          break;
        case 'ai-experiment':
          setTitle(`Experiment: ${experimentConfig.instanceCount} instances`);
          break;
        case 'ai-custom':
          setTitle('Custom AI Configuration');
          break;
        case 'local':
          setTitle('Local Terminal (Legacy)');
          break;
      }
    }
  }, [connectionType, aiConfig.aiModel, experimentConfig.instanceCount]);

  const handleCreate = async () => {
    const config: ExtendedTerminalConfig = {
      connectionType,
      project,
      branch,
      title,
      shell,
      prompt
    };

    // Generate unique instance ID
    const instanceId = `${connectionType}-${Date.now()}`;

    switch (connectionType) {
      case 'ai-single':
      case 'ai-custom':
        config.aiConfig = aiConfig;
        config.mcpConfig = mcpConfig;
        
        // Generate MCP launch configuration
        const enabledServers = Object.entries(mcpConfig)
          .filter(([key, value]) => value === true && key !== 'customServers')
          .map(([key]) => key);
        
        const launchConfig = await mcpConfigManager.createLaunchConfig(
          aiConfig.aiModel,
          enabledServers,
          project,
          branch,
          instanceId
        );
        
        config.launchConfig = launchConfig;
        break;
        
      case 'ai-experiment':
        config.experimentConfig = experimentConfig;
        config.mcpConfig = mcpConfig;
        
        // For experiments, create configs for each instance
        const experimentConfigs = [];
        for (let i = 0; i < experimentConfig.instanceCount; i++) {
          const expInstanceId = `${instanceId}-${i}`;
          const expLaunchConfig = await mcpConfigManager.createLaunchConfig(
            'claude-opus', // Default to Claude for experiments
            Object.entries(mcpConfig)
              .filter(([key, value]) => value === true && key !== 'customServers')
              .map(([key]) => key),
            project,
            `${branch}-experiment-${i}`,
            expInstanceId
          );
          experimentConfigs.push(expLaunchConfig);
        }
        
        config.experimentLaunchConfigs = experimentConfigs;
        break;
    }

    onCreateTerminal(config);
  };

  const isConfigValid = () => {
    switch (connectionType) {
      case 'ai-single':
        return aiConfig.aiModel && title;
      case 'ai-experiment':
        return experimentConfig.instanceCount > 0 && experimentConfig.instanceCount <= 4;
      case 'ai-custom':
        return aiConfig.apiEndpoint && aiConfig.apiKey;
      case 'local':
        return title;
      default:
        return false;
    }
  };

  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>🚀 AI Terminal Launchpad</h2>
          <button className={styles.closeButton} onClick={onCancel}>×</button>
        </div>

        <div className={styles.content}>
          {/* AI Mode Selection */}
          <div className={styles.section}>
            <label className={styles.label}>Launch Mode</label>
            <div className={styles.connectionTypes}>
              <button 
                className={`${styles.connectionType} ${connectionType === 'ai-single' ? styles.active : ''}`}
                onClick={() => setConnectionType('ai-single')}
              >
                🤖 Single AI
              </button>
              <button 
                className={`${styles.connectionType} ${connectionType === 'ai-experiment' ? styles.active : ''}`}
                onClick={() => setConnectionType('ai-experiment')}
              >
                🧪 Experiment
              </button>
              <button 
                className={`${styles.connectionType} ${connectionType === 'ai-custom' ? styles.active : ''}`}
                onClick={() => setConnectionType('ai-custom')}
              >
                ⚙️ Custom
              </button>
              <button 
                className={`${styles.connectionType} ${connectionType === 'local' ? styles.active : ''}`}
                onClick={() => setConnectionType('local')}
              >
                💻 Local
              </button>
            </div>
          </div>

          {/* Project Configuration */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Project</label>
              <select 
                value={project} 
                onChange={(e) => setProject(e.target.value)}
                className={styles.select}
              >
                <option value="gg-devhub">gg-devhub</option>
                <option value="claude-orchestrator">claude-orchestrator</option>
                <option value="multi-terminal">multi-terminal</option>
                <option value="new-project">+ New Project</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className={styles.input}
                placeholder="main"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Terminal Title</label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles.input}
              placeholder={connectionType === 'ai-experiment' ? 'Experiment: Build a chat app' : 'AI: Claude helping with frontend'}
            />
          </div>

          {/* Prompt Input */}
          {(connectionType === 'ai-single' || connectionType === 'ai-experiment') && (
            <div className={styles.field}>
              <label className={styles.label}>Initial Prompt (Optional)</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className={styles.textarea}
                placeholder="What would you like to work on? Use Claude Code's /agents command for specialized assistance."
                rows={3}
              />
              <div className={styles.promptHint}>
                💡 Tip: Once your terminal is created, use <code>/agents</code> to access specialized AI assistants
              </div>
            </div>
          )}

          {/* AI-Specific Configuration */}
          {(connectionType === 'ai-single' || connectionType === 'ai-custom') && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>🤖 AI Model Selection</h3>
              <div className={styles.aiModels}>
                <label className={`${styles.aiModel} ${aiConfig.aiModel === 'claude-opus' ? styles.active : ''}`}>
                  <input
                    type="radio"
                    name="aiModel"
                    value="claude-opus"
                    checked={aiConfig.aiModel === 'claude-opus'}
                    onChange={(e) => setAiConfig({...aiConfig, aiModel: e.target.value as any})}
                  />
                  <div>
                    <strong>Claude Code</strong>
                    <small>🎯 Opus 4 → Sonnet 4 (auto-switch at 50%)</small>
                  </div>
                </label>
                <label className={`${styles.aiModel} ${aiConfig.aiModel === 'gpt4' ? styles.active : ''}`}>
                  <input
                    type="radio"
                    name="aiModel"
                    value="gpt4"
                    checked={aiConfig.aiModel === 'gpt4'}
                    onChange={(e) => setAiConfig({...aiConfig, aiModel: e.target.value as any})}
                  />
                  <div>
                    <strong>GPT-4 (Copilot)</strong>
                    <small>🐙 Via GitHub Copilot integration</small>
                  </div>
                </label>
                <label className={`${styles.aiModel} ${aiConfig.aiModel === 'gordon' ? styles.active : ''}`}>
                  <input
                    type="radio"
                    name="aiModel"
                    value="gordon"
                    checked={aiConfig.aiModel === 'gordon'}
                    onChange={(e) => setAiConfig({...aiConfig, aiModel: e.target.value as any})}
                  />
                  <div>
                    <strong>Gordon</strong>
                    <small>🤖 Co-orchestrator assistant</small>
                  </div>
                </label>
              </div>
              
              {connectionType === 'ai-custom' && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>API Endpoint</label>
                    <input
                      type="text"
                      value={aiConfig.apiEndpoint || ''}
                      onChange={(e) => setAiConfig({...aiConfig, apiEndpoint: e.target.value})}
                      className={styles.input}
                      placeholder="https://api.example.com/v1/chat"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>API Key</label>
                    <input
                      type="password"
                      value={aiConfig.apiKey || ''}
                      onChange={(e) => setAiConfig({...aiConfig, apiKey: e.target.value})}
                      className={styles.input}
                      placeholder="sk-..."
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {connectionType === 'ai-experiment' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>🧪 Experiment Configuration</h3>
              <div className={styles.field}>
                <label className={styles.label}>Number of Instances</label>
                <input
                  type="range"
                  min="2"
                  max="4"
                  value={experimentConfig.instanceCount}
                  onChange={(e) => setExperimentConfig({...experimentConfig, instanceCount: parseInt(e.target.value)})}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{experimentConfig.instanceCount}</span>
              </div>
              
              <div className={styles.field}>
                <label className={styles.label}>Variation Type</label>
                <select
                  value={experimentConfig.variations?.type}
                  onChange={(e) => setExperimentConfig({
                    ...experimentConfig,
                    variations: { ...experimentConfig.variations, type: e.target.value as any }
                  })}
                  className={styles.select}
                >
                  <option value="coding-style">Coding Styles (minimal/verbose/functional/OOP)</option>
                  <option value="framework">Frameworks (React/Vue/Svelte/Vanilla)</option>
                  <option value="performance">Performance Focus (speed/memory/readability)</option>
                  <option value="features">Feature Sets (MVP/standard/premium)</option>
                  <option value="custom">Custom Variations</option>
                </select>
              </div>
              
              <div className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={experimentConfig.useWorktrees}
                  onChange={(e) => setExperimentConfig({...experimentConfig, useWorktrees: e.target.checked})}
                />
                <label>Use Git Worktrees (Crystal-style isolation)</label>
              </div>
            </div>
          )}

          {/* MCP Configuration */}
          {(connectionType !== 'local') && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                🔗 MCP Servers {totalTools > 0 && <span className={styles.toolCount}>({totalTools} tools total)</span>}
              </h3>
              <div className={styles.mcpServers}>
                {availableMCPServers.map(server => (
                  <label key={server.id} className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={mcpConfig[server.id] || false}
                      onChange={(e) => setMcpConfig({...mcpConfig, [server.id]: e.target.checked})}
                    />
                    <span>
                      {server.id === 'github-official' && '☑ '}
                      {server.id === 'dockerhub' && '🐳 '}
                      {server.id === 'context7' && '📚 '}
                      {server.id === 'wikipedia-mcp' && '🌐 '}
                      {server.name} ({server.tools} tools)
                    </span>
                  </label>
                ))}
                {availableMCPServers.length === 0 && (
                  <div className={styles.loadingMessage}>
                    Loading available MCP servers...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button 
            className={styles.createButton} 
            onClick={handleCreate}
            disabled={!isConfigValid()}
          >
            {connectionType === 'ai-experiment' ? '🚀 Launch Experiment' : '🤖 Launch AI'}
          </button>
        </div>
      </div>
    </div>
  );
}