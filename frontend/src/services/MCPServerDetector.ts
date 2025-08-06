/**
 * MCP Server Detector
 * Fetches available MCP servers from the backend
 */

export interface MCPServer {
  id: string;
  name: string;
  tools: number;
  enabled: boolean;
}

export interface MCPServersResponse {
  servers: MCPServer[];
  total_tools: number;
}

export class MCPServerDetector {
  private backendUrl: string;

  constructor(backendUrl: string = 'http://localhost:8125') {
    this.backendUrl = backendUrl;
  }

  /**
   * Fetch available MCP servers from the backend
   */
  async getAvailableServers(): Promise<MCPServersResponse> {
    try {
      const response = await fetch(`${this.backendUrl}/mcp-servers`);
      if (!response.ok) {
        throw new Error(`Failed to fetch MCP servers: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
      // Return default servers if backend is not available
      return {
        servers: [
          { id: 'github-official', name: 'GitHub Official', tools: 80, enabled: true },
          { id: 'dockerhub', name: 'Docker Hub', tools: 13, enabled: true },
          { id: 'context7', name: 'Context7', tools: 2, enabled: true },
          { id: 'wikipedia-mcp', name: 'Wikipedia', tools: 9, enabled: true }
        ],
        total_tools: 104
      };
    }
  }

  /**
   * Check if a specific server is available
   */
  async isServerAvailable(serverId: string): Promise<boolean> {
    const { servers } = await this.getAvailableServers();
    return servers.some(server => server.id === serverId && server.enabled);
  }
}

// Export singleton instance
export const mcpServerDetector = new MCPServerDetector();