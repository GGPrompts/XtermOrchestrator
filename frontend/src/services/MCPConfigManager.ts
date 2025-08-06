/**
 * MCP Configuration Manager
 * Handles dynamic MCP server configuration for Claude Desktop and other AI systems
 * Browser-safe version - configuration only, no actual MCP execution
 */

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

interface MCPConfiguration {
  mcpServers: Record<string, MCPServerConfig>;
}

export class MCPConfigManager {
  private configPath: string;
  private baseConfig: MCPConfiguration = { mcpServers: {} };

  constructor(configPath: string = '/config/claude_desktop_config.json') {
    this.configPath = configPath;
    // Initialize baseConfig in constructor to avoid process.env in class field
    this.initializeBaseConfig();
  }

  private initializeBaseConfig() {
    // Updated to match Docker MCP gateway servers
    this.baseConfig = {
      mcpServers: {
        'github-official': {
          command: 'docker',
          args: ['mcp', 'client', 'connect', 'github-official'],
          env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}'
          },
          enabled: true
        },
        'dockerhub': {
          command: 'docker',
          args: ['mcp', 'client', 'connect', 'dockerhub'],
          env: {
            HUB_PAT_TOKEN: '${DOCKER_HUB_TOKEN}'
          },
          enabled: true
        },
        'context7': {
          command: 'docker',
          args: ['mcp', 'client', 'connect', 'context7'],
          enabled: true
        },
        'wikipedia-mcp': {
          command: 'docker',
          args: ['mcp', 'client', 'connect', 'wikipedia-mcp'],
          enabled: true
        }
      }
    };
  }

  /**
   * Generate MCP configuration based on user selection
   */
  async generateConfig(selectedServers: string[]): Promise<MCPConfiguration> {
    const config: MCPConfiguration = {
      mcpServers: {}
    };

    // Enable only selected servers
    Object.entries(this.baseConfig.mcpServers).forEach(([name, serverConfig]) => {
      config.mcpServers[name] = {
        ...serverConfig,
        enabled: selectedServers.includes(name)
      };
    });

    return config;
  }

  /**
   * Save configuration to file (via orchestrator)
   * In browser mode, this just returns the config without saving
   */
  async saveConfig(config: MCPConfiguration, instanceId: string): Promise<void> {
    // In browser mode, we don't actually save to file
    // The config will be passed to the backend when creating the terminal
    console.log('MCP Config prepared for instance:', instanceId, config);
    
    // Comment out the actual save for now since we don't have the API endpoint
    /*
    const response = await fetch('/api/mcp-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceId,
        config,
        path: `${this.configPath}.${instanceId}`
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save MCP configuration');
    }
    */
  }

  /**
   * Generate Docker volume mounts for MCP config
   */
  getDockerVolumes(instanceId: string): string[] {
    return [
      // Mount instance-specific config
      `-v ./mcp-configs/${instanceId}/claude_desktop_config.json:/app/config/claude_desktop_config.json:ro`,
      // Mount MCP server binaries (if using local builds)
      `-v ./mcp-servers:/mcp:ro`,
      // Mount tokens/secrets
      `-v ./mcp-secrets:/secrets:ro`
    ];
  }

  /**
   * Get environment variables for container
   */
  getEnvironmentVars(mcpServers: string[]): Record<string, string> {
    const env: Record<string, string> = {
      MCP_ENABLED_SERVERS: mcpServers.join(','),
      MCP_CONFIG_PATH: '/app/config/claude_desktop_config.json'
    };

    // Add specific env vars based on enabled servers
    if (mcpServers.includes('github')) {
      env.GITHUB_TOKEN = '${GITHUB_TOKEN}';
    }
    if (mcpServers.includes('docker-hub')) {
      env.HUB_PAT_TOKEN = '${DOCKER_HUB_TOKEN}';
    }

    return env;
  }

  /**
   * Create launch configuration for orchestrator
   */
  async createLaunchConfig(
    aiModel: string,
    mcpServers: string[],
    project: string,
    branch: string,
    instanceId: string
  ) {
    // Generate and save MCP config
    const mcpConfig = await this.generateConfig(mcpServers);
    await this.saveConfig(mcpConfig, instanceId);

    return {
      container: {
        image: this.getContainerImage(aiModel),
        volumes: [
          `-v ./projects/${project}:/workspace`,
          ...this.getDockerVolumes(instanceId)
        ],
        environment: {
          ...this.getEnvironmentVars(mcpServers),
          AI_MODEL: aiModel,
          PROJECT_PATH: `/workspace`,
          GIT_BRANCH: branch,
          INSTANCE_ID: instanceId
        },
        command: this.getStartCommand(aiModel)
      },
      mcp: {
        configPath: `${this.configPath}.${instanceId}`,
        enabledServers: mcpServers
      }
    };
  }

  private getContainerImage(aiModel: string): string {
    const imageMap: Record<string, string> = {
      'claude-opus': 'claude-dev:latest',
      'claude-sonnet': 'claude-dev:latest',
      'gpt4': 'openai-dev:latest',
      'gordon': 'docker-ai:latest',
      'copilot': 'github-copilot:latest'
    };
    return imageMap[aiModel] || 'ai-dev:latest';
  }

  private getStartCommand(aiModel: string): string {
    const commandMap: Record<string, string> = {
      'claude-opus': 'claude-desktop --config /app/config/claude_desktop_config.json',
      'claude-sonnet': 'claude-desktop --config /app/config/claude_desktop_config.json',
      'gordon': 'docker ai --shell-out',
      'copilot': 'gh copilot'
    };
    return commandMap[aiModel] || 'bash';
  }
}

// Singleton instance
export const mcpConfigManager = new MCPConfigManager();