/**
 * Agent Preset Configurations
 * Specialized AI agents with optimized MCP configurations
 */

export interface AgentPreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  aiModel: 'claude-opus' | 'claude-sonnet' | 'gpt4' | 'copilot';
  mcpServers: {
    github?: boolean;
    dockerHub?: boolean;
    context7?: boolean;
    wikipedia?: boolean;
    playwright?: boolean;
    webSearch?: boolean;
  };
  systemPrompt?: string;
  suggestedTools?: string[];
}

export const agentPresets: Record<string, AgentPreset> = {
  'code-reviewer': {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    emoji: '🔍',
    description: 'Expert code review specialist with 20+ years experience. Reviews code for quality, security, performance, and maintainability issues.',
    aiModel: 'claude-opus',
    mcpServers: {
      github: true,      // For checking best practices
      webSearch: true,   // For security advisories
      context7: false,
      dockerHub: false,
      wikipedia: false,
      playwright: false
    },
    systemPrompt: `You are an expert code reviewer with 20+ years of experience. 
    Focus on: code quality, security vulnerabilities, performance issues, and maintainability.
    Use GitHub MCP to check similar codebases for patterns.
    Use web search for latest security advisories.`,
    suggestedTools: ['git diff', 'eslint', 'security scanners']
  },

  'debugger': {
    id: 'debugger',
    name: 'Debugger',
    emoji: '🐛',
    description: 'Debugging specialist for errors, test failures, and unexpected behavior. Expert at root cause analysis and systematic troubleshooting.',
    aiModel: 'claude-opus',
    mcpServers: {
      github: true,      // For finding similar issues
      webSearch: true,   // For error messages
      context7: true,    // For framework-specific debugging
      dockerHub: false,
      wikipedia: false,
      playwright: false
    },
    systemPrompt: `You are a debugging specialist with expertise in root cause analysis.
    Systematically troubleshoot issues using scientific method.
    Use GitHub to find similar issues and solutions.
    Use Context7 for framework-specific debugging guides.`,
    suggestedTools: ['debugger', 'console logs', 'stack traces']
  },

  'documentation': {
    id: 'documentation',
    name: 'Documentation Expert',
    emoji: '📝',
    description: 'Technical documentation expert. Creates and maintains clear, comprehensive documentation including READMEs, API docs, guides, and architecture decisions.',
    aiModel: 'claude-opus',
    mcpServers: {
      github: true,      // For documentation examples
      context7: true,    // For documentation standards
      wikipedia: true,   // For technical definitions
      webSearch: false,
      dockerHub: false,
      playwright: false
    },
    systemPrompt: `You are a technical documentation expert.
    Create clear, comprehensive documentation following best practices.
    Use GitHub to find excellent documentation examples.
    Use Wikipedia for accurate technical definitions.`,
    suggestedTools: ['markdown', 'diagrams', 'API specs']
  },

  'prompt-engineer': {
    id: 'prompt-engineer',
    name: 'Prompt Engineer',
    emoji: '💡',
    description: 'Interactive prompt engineering specialist. Transforms vague ideas into precise, optimized prompts through thoughtful questioning and refinement.',
    aiModel: 'claude-opus',
    mcpServers: {
      webSearch: true,   // For prompt engineering techniques
      github: true,      // For prompt examples
      context7: false,
      dockerHub: false,
      wikipedia: false,
      playwright: false
    },
    systemPrompt: `You are an interactive prompt engineering specialist.
    Transform vague ideas into precise, optimized prompts.
    Ask clarifying questions to understand intent.
    Iterate and refine prompts for maximum effectiveness.`,
    suggestedTools: ['prompt templates', 'iteration tracking']
  },

  'visual-designer': {
    id: 'visual-designer',
    name: 'Visual Designer',
    emoji: '🎨',
    description: 'UI/UX design expert specializing in creating beautiful, functional, and accessible interfaces. Expert in CSS, design systems, and modern frontend styling.',
    aiModel: 'claude-opus',
    mcpServers: {
      context7: true,    // For UI framework docs
      github: true,      // For design system examples
      webSearch: true,   // For design trends
      playwright: true,  // For visual testing
      dockerHub: false,
      wikipedia: false
    },
    systemPrompt: `You are a UI/UX design expert specializing in beautiful, accessible interfaces.
    Focus on modern design principles, accessibility, and user experience.
    Use Context7 for framework-specific styling guides.
    Use Playwright for visual regression testing.`,
    suggestedTools: ['CSS', 'design systems', 'Figma']
  },

  'feature-planner': {
    id: 'feature-planner',
    name: 'Feature Planner',
    emoji: '🚀',
    description: 'Feature planning and brainstorming specialist. Helps ideate, plan, and structure new features through collaborative exploration and systematic planning.',
    aiModel: 'claude-opus',
    mcpServers: {
      context7: true,    // For latest tech capabilities
      webSearch: true,   // For market research
      github: true,      // For similar features
      wikipedia: true,   // For technical concepts
      dockerHub: false,
      playwright: false
    },
    systemPrompt: `You are a feature planning specialist focused on modern best practices.
    Research cutting-edge solutions using Context7 for latest framework features.
    Use web search for current trends and user expectations.
    Create detailed, actionable feature plans.`,
    suggestedTools: ['mind maps', 'user stories', 'wireframes']
  },

  'claude-expert': {
    id: 'claude-expert',
    name: 'Claude Code Expert',
    emoji: '📚',
    description: 'Claude Code expert with comprehensive knowledge of commands, settings, features, and best practices. Your go-to agent for Claude Code help.',
    aiModel: 'claude-opus',
    mcpServers: {
      webSearch: true,   // For Claude Code docs
      github: false,
      context7: false,
      dockerHub: false,
      wikipedia: false,
      playwright: false
    },
    systemPrompt: `You are a Claude Code expert with comprehensive knowledge of all features.
    Help users master Claude Code commands, settings, and best practices.
    Use web search to check latest Claude Code documentation.
    Provide practical examples and tips.`,
    suggestedTools: ['claude CLI', 'settings.json', 'keyboard shortcuts']
  },

  'mcp-expert': {
    id: 'mcp-expert',
    name: 'MCP Expert',
    emoji: '🔌',
    description: 'Model Context Protocol (MCP) expert. Specializes in MCP server setup, configuration, troubleshooting, and available MCP servers.',
    aiModel: 'claude-opus',
    mcpServers: {
      github: true,      // For MCP repositories
      dockerHub: true,   // For MCP containers
      webSearch: true,   // For MCP documentation
      context7: false,
      wikipedia: false,
      playwright: false
    },
    systemPrompt: `You are an MCP (Model Context Protocol) expert.
    Help with MCP server setup, configuration, and troubleshooting.
    Use GitHub to find MCP server implementations.
    Use Docker Hub for containerized MCP solutions.`,
    suggestedTools: ['MCP config files', 'stdio transport', 'MCP debugging']
  },

  'hooks-expert': {
    id: 'hooks-expert',
    name: 'Hooks Expert',
    emoji: '⚡',
    description: 'Claude Code hooks configuration expert. Specializes in setting up automated workflows using pre/post hooks for various Claude Code events.',
    aiModel: 'claude-sonnet',
    mcpServers: {
      github: true,      // For hook examples
      webSearch: true,   // For automation patterns
      context7: false,
      dockerHub: false,
      wikipedia: false,
      playwright: false
    },
    systemPrompt: `You are a Claude Code hooks configuration expert.
    Specialize in automated workflows using pre/post hooks.
    Help users create powerful automation with Claude Code events.
    Provide secure and efficient hook implementations.`,
    suggestedTools: ['bash scripts', 'hook events', 'automation patterns']
  },

  // Additional useful presets
  'implementer': {
    id: 'implementer',
    name: 'Implementation Specialist',
    emoji: '🛠️',
    description: 'Focuses on writing clean, efficient code implementations based on specifications.',
    aiModel: 'claude-sonnet',
    mcpServers: {
      github: true,
      dockerHub: true,
      context7: false,
      webSearch: false,
      wikipedia: false,
      playwright: false
    },
    systemPrompt: `You are an implementation specialist focused on writing production-ready code.
    Follow specifications precisely and write clean, maintainable code.
    Use GitHub for code examples and best practices.`
  },

  'tester': {
    id: 'tester',
    name: 'Testing Specialist',
    emoji: '🧪',
    description: 'Writes comprehensive tests including unit, integration, and E2E tests.',
    aiModel: 'claude-sonnet',
    mcpServers: {
      github: true,
      playwright: true,
      context7: false,
      dockerHub: false,
      wikipedia: false,
      webSearch: false
    },
    systemPrompt: `You are a testing specialist focused on comprehensive test coverage.
    Write unit, integration, and E2E tests following best practices.
    Use Playwright for browser automation testing.`
  },

  'devops': {
    id: 'devops',
    name: 'DevOps Engineer',
    emoji: '🚢',
    description: 'Handles deployment, containerization, CI/CD, and infrastructure tasks.',
    aiModel: 'claude-sonnet',
    mcpServers: {
      dockerHub: true,
      github: true,
      webSearch: false,
      context7: false,
      wikipedia: false,
      playwright: false
    },
    systemPrompt: `You are a DevOps engineer specializing in deployment and infrastructure.
    Focus on containerization, CI/CD pipelines, and scalable deployments.
    Use Docker Hub for container management and GitHub for CI/CD configurations.`
  }
};

// Helper function to get agent by task keywords
export function suggestAgentForTask(taskDescription: string): string {
  const keywords: Record<string, string[]> = {
    'code-reviewer': ['review', 'quality', 'security', 'audit', 'check code'],
    'debugger': ['debug', 'error', 'fix', 'broken', 'not working', 'bug'],
    'documentation': ['document', 'readme', 'docs', 'explain', 'guide'],
    'prompt-engineer': ['prompt', 'refine', 'optimize prompt', 'better prompt'],
    'visual-designer': ['design', 'ui', 'ux', 'style', 'css', 'layout', 'beautiful'],
    'feature-planner': ['plan', 'feature', 'brainstorm', 'idea', 'design feature'],
    'claude-expert': ['claude', 'claude code', 'command', 'shortcut'],
    'mcp-expert': ['mcp', 'model context', 'mcp server', 'protocol'],
    'hooks-expert': ['hook', 'automate', 'workflow', 'event', 'trigger'],
    'implementer': ['implement', 'build', 'code', 'create', 'develop'],
    'tester': ['test', 'testing', 'qa', 'quality assurance', 'e2e'],
    'devops': ['deploy', 'docker', 'container', 'ci/cd', 'pipeline']
  };

  const lowerTask = taskDescription.toLowerCase();
  
  for (const [agent, words] of Object.entries(keywords)) {
    if (words.some(word => lowerTask.includes(word))) {
      return agent;
    }
  }
  
  return 'implementer'; // Default to implementer
}

// Get all agents for dropdown
export function getAllAgents(): AgentPreset[] {
  return Object.values(agentPresets);
}

// Get agent by ID
export function getAgentPreset(agentId: string): AgentPreset | null {
  return agentPresets[agentId] || null;
}