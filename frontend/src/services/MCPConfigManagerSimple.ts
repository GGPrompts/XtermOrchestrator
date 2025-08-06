/**
 * Simplified MCP Configuration Manager for browser use
 * No file I/O or environment variables - just configuration generation
 */

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface MCPConfiguration {
  mcpServers: Record<string, MCPServerConfig>;
}

export class MCPConfigManagerSimple {
  /**
   * Generate MCP configuration based on user selection
   */
  static generateConfig(selectedServers: string[]): MCPConfiguration {
    const availableServers: Record<string, MCPServerConfig> = {
      'docker-hub': {
        command: 'node',
        args: ['/mcp/docker-hub-mcp-server/dist/index.js', '--transport=stdio'],
        env: { HUB_PAT_TOKEN: '${DOCKER_HUB_TOKEN}' },
        enabled: false
      },
      'github': {
        command: 'node',
        args: ['/mcp/github-mcp-server/dist/index.js', '--transport=stdio'],
        env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
        enabled: false
      },
      'context7': {
        command: 'node',
        args: ['/mcp/context7-mcp-server/dist/index.js', '--transport=stdio'],
        enabled: false
      },
      'wikipedia': {
        command: 'node',
        args: ['/mcp/wikipedia-mcp-server/dist/index.js', '--transport=stdio'],
        enabled: false
      },
      'playwright': {
        command: 'node',
        args: ['/mcp/playwright-mcp-server/dist/index.js', '--transport=stdio'],
        enabled: false
      }
    };

    const config: MCPConfiguration = { mcpServers: {} };

    // Add only selected servers with enabled: true
    selectedServers.forEach(serverName => {
      if (availableServers[serverName]) {
        config.mcpServers[serverName] = {
          ...availableServers[serverName],
          enabled: true
        };
      }
    });

    return config;
  }

  /**
   * Create launch configuration for orchestrator
   */
  static createLaunchConfig(
    aiModel: string,
    mcpServers: string[],
    project: string,
    branch: string,
    instanceId: string
  ) {
    const mcpConfig = this.generateConfig(mcpServers);
    
    return {
      container: {
        image: this.getContainerImage(aiModel),
        volumes: [
          `-v ./projects/${project}:/workspace`,
          `-v ./mcp-configs/${instanceId}:/config`
        ],
        environment: this.getEnvironmentVars(mcpServers),
        command: this.getStartCommand(aiModel)
      },
      mcp: mcpConfig,
      metadata: {
        aiModel,
        project,
        branch,
        instanceId,
        createdAt: new Date().toISOString()
      }
    };
  }

  private static getContainerImage(aiModel: string): string {
    const imageMap: Record<string, string> = {
      'claude-opus': 'claude-dev:latest',
      'claude-sonnet': 'claude-dev:latest',
      'gpt4': 'openai-dev:latest',
      'gordon': 'docker-ai:latest',
      'copilot': 'github-copilot:latest'
    };
    return imageMap[aiModel] || 'ai-dev:latest';
  }

  private static getEnvironmentVars(mcpServers: string[]): Record<string, string> {
    const env: Record<string, string> = {
      MCP_ENABLED_SERVERS: mcpServers.join(','),
      MCP_CONFIG_PATH: '/config/claude_desktop_config.json'
    };

    if (mcpServers.includes('github')) {
      env.GITHUB_TOKEN = '${GITHUB_TOKEN}';
    }
    if (mcpServers.includes('docker-hub')) {
      env.HUB_PAT_TOKEN = '${DOCKER_HUB_TOKEN}';
    }

    return env;
  }

  private static getStartCommand(aiModel: string): string {
    const commandMap: Record<string, string> = {
      'claude-opus': 'claude-desktop --config /config/claude_desktop_config.json',
      'claude-sonnet': 'claude-desktop --config /config/claude_desktop_config.json',
      'gordon': 'docker ai --shell-out',
      'copilot': 'gh copilot'
    };
    return commandMap[aiModel] || 'bash';
  }
}

// Export a simple function interface for easy use
export const createMCPLaunchConfig = MCPConfigManagerSimple.createLaunchConfig.bind(MCPConfigManagerSimple);
export const generateMCPConfig = MCPConfigManagerSimple.generateConfig.bind(MCPConfigManagerSimple);