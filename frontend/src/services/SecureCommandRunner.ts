import * as path from 'path';

/**
 * Security configuration shared between React app and standalone backend
 */
export const SHARED_SECURITY_CONFIG = {
    ALLOWED_COMMANDS: [
        'cd', 'ls', 'dir', 'pwd', 'echo', 'cat', 'type', 'find', 'grep', 'head', 'tail',
        'npm', 'node', 'yarn', 'pnpm', 'git', 'python', 'python3', 'pip', 'pip3',
        'mvn', 'gradle', 'cargo', 'go', 'rustc', 'javac', 'gcc', 'clang',
        'code', 'vim', 'nano', 'emacs', 'notepad', 'clear', 'cls', 'help', 'claude',
        'whoami', 'date', 'time', 'hostname', 'uname', 'which', 'where',
        'ps', 'top', 'htop', 'jobs', 'kill', 'killall', 'pkill',
        'curl', 'wget', 'ping', 'telnet', 'ssh', 'scp', 'rsync',
        'tar', 'zip', 'unzip', 'gzip', 'gunzip',
        'docker', 'docker-compose', 'kubectl',
        'make', 'cmake', 'configure', 'autoconf', 'automake',
        'powershell', 'pwsh', 'cmd', 'bash', 'zsh', 'fish', 'sh',
        // Diagnostic and system information commands
        'netstat', 'tasklist', 'systeminfo', 'ipconfig', 'arp', 'route', 'tracert', 'nslookup',
        'findstr', 'sort', 'more', 'tree', 'ver', 'set', 'wmic'
    ],
    
    ALLOWED_NPM_SCRIPTS: [
        'start', 'dev', 'build', 'test', 'lint', 'format', 'clean',
        'install', 'ci', 'update', 'outdated', 'audit', 'run',
        'serve', 'preview', 'deploy', 'storybook', 'docs'
    ],
    
    DANGEROUS_PATTERNS: [
        /[;&`(){}[\]\\]|\$\(/,  // Command injection characters - allows | pipes and $var but blocks $() substitution
        /\.\./,               // Path traversal
        /rm\s+-rf/i,         // Dangerous rm commands
        /del\s+\/[sq]/i,     // Dangerous Windows del commands
        /format\s+c:/i,      // Format commands
        /shutdown/i,         // System shutdown
        /reboot/i,           // System reboot
        /halt/i,             // System halt
        /eval\s*\(/i,        // Code evaluation
        /exec\s*\(/i,        // Code execution
        /system\s*\(/i,      // System calls
        /\<script\>/i,       // Script tags
        /javascript:/i,      // JavaScript protocol
        /vbscript:/i,        // VBScript protocol
        /data:/i,            // Data protocol
        /file:/i             // File protocol
    ],
    
    ALLOWED_EXTENSIONS: [
        '', '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', '.yml', '.yaml',
        '.css', '.scss', '.sass', '.less', '.html', '.htm', '.xml', '.svg',
        '.py', '.rb', '.php', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
        '.sh', '.bat', '.ps1', '.cmd', '.dockerfile', '.gitignore', '.env'
    ],
    
    SAFE_COMMAND_PATTERNS: [
        /^npm\s+(start|dev|build|test|run\s+\w+)$/i,
        /^cd\s+"[A-Za-z]:[\\\/][\w\-\.\s\/\\:()]+"\s*$/,  // Quoted Windows paths
        /^cd\s+[A-Za-z]:[\\\/][\w\-\.\s\/\\:()]+$/,   // Unquoted Windows paths  
        /^cd\s+"[\w\-\.\s\/\\~()]+"\s*$/,             // Quoted Unix-style paths
        /^cd\s+[\w\-\.\/\\~]+$/,                      // Simple unquoted paths
        /^claude\s+(--version|--help|-v|-h)$/,        // Safe Claude info commands
        /^claude\s*$/,                                // Basic Claude command (interactive mode)
        /^ls(\s+-[alh]+)?(\s+[\w\-\.\/\\]+)?$/,
        /^dir(\s+[\w\-\.\/\\]+)?$/i,
        /^git\s+(status|log|diff|branch|checkout|pull|push|add|commit|clone)(\s+[\w\-\.\/\\]+)*$/i,
        /^code\s+[\w\-\.\/\\]+$/,
        /^python\s+[\w\-\.\/\\]+\.py$/i,
        /^node\s+[\w\-\.\/\\]+\.js$/i,
        // Quick Commands patterns
        /^echo\s+"[^"]*"$/,                          // Quoted echo statements
        /^echo\s+[^\s;&|`(){}[\]\\$]+$/,             // Simple echo statements
        /^npm\s+--version$/i,                        // npm version check
        /^node\s+--version$/i,                       // node version check
        /^git\s+status$/i,                           // git status
        /^netstat\s+-ano\s*\|\s*findstr\s+:[0-9]+$/, // netstat with port filter
        /^netstat\s+-ano$/,                          // basic netstat
        /^findstr\s+\w+$/,                           // basic findstr
        /^pwd$/,                                     // print working directory
        /^whoami$/,                                  // current user
        /^clear$/,                                   // clear screen
        /^dir$/i                                     // directory listing
    ],
    
    SAFE_POWERSHELL_PATTERNS: [
        /^Get-Process(\s+-Name\s+\w+)?$/i,
        /^Stop-Process(\s+-Name\s+\w+|\s+-Id\s+\d+)(\s+-Force)?$/i,
        /^Get-ChildItem(\s+[\w\-\.\/\\]+)?$/i,
        /^Set-Location\s+[\w\-\.\/\\]+$/i,
        /^\.\s*\\scripts\\[\w\-]+\.ps1$/i
    ]
};

export interface ValidationResult {
    valid: boolean;
    reason?: 'invalid-input' | 'empty-command' | 'dangerous-pattern' | 'not-whitelisted' | 'powershell-syntax';
    message?: string;
}

export function getSecurityErrorMessage(command: string, reason: string): string {
    const messages = {
        'invalid-input': 'Invalid command input provided',
        'empty-command': 'Empty command not allowed',
        'dangerous-pattern': `Command blocked - contains dangerous pattern: ${command}`,
        'not-whitelisted': `Command blocked - not in allowed list: ${command}`,
        'powershell-syntax': `PowerShell command blocked - invalid syntax: ${command}`
    };
    return messages[reason as keyof typeof messages] || 'Command blocked for security reasons';
}

/**
 * SecureCommandRunner - Prevents command injection vulnerabilities
 * 
 * This service validates and sanitizes commands before execution to prevent:
 * - Command injection attacks
 * - Path traversal attacks
 * - Execution of dangerous system commands
 */
export class SecureCommandRunner {
    private static readonly ALLOWED_COMMANDS = new Set(SHARED_SECURITY_CONFIG.ALLOWED_COMMANDS);
    private static readonly ALLOWED_NPM_SCRIPTS = new Set(SHARED_SECURITY_CONFIG.ALLOWED_NPM_SCRIPTS);
    private static readonly DANGEROUS_PATTERNS = SHARED_SECURITY_CONFIG.DANGEROUS_PATTERNS;
    private static readonly ALLOWED_EXTENSIONS = new Set(SHARED_SECURITY_CONFIG.ALLOWED_EXTENSIONS);
    private static readonly SAFE_COMMAND_PATTERNS = SHARED_SECURITY_CONFIG.SAFE_COMMAND_PATTERNS;

    /**
     * Validate PowerShell-specific syntax for safe operations
     */
    private static validatePowerShellSyntax(command: string): boolean {
        return SHARED_SECURITY_CONFIG.SAFE_POWERSHELL_PATTERNS.some(pattern => pattern.test(command));
    }

    /**
     * Validates a command for safe execution
     * @param command The command to validate
     * @returns true if the command is safe to execute
     */
    static validateCommand(command: string): boolean {
        if (!command || typeof command !== 'string') {
            return false;
        }

        const trimmedCommand = command.trim();
        if (trimmedCommand.length === 0) {
            return false;
        }

        // 1. Check whitelist first (most permissive)
        if (this.SAFE_COMMAND_PATTERNS.some(pattern => pattern.test(trimmedCommand))) {
            console.log(`Command whitelisted: ${trimmedCommand}`);
            return true;
        }
        
        // 2. Check PowerShell syntax
        if (trimmedCommand.toLowerCase().includes('powershell') || trimmedCommand.includes('$') || 
            trimmedCommand.includes('Get-') || trimmedCommand.includes('Stop-Process')) {
            if (this.validatePowerShellSyntax(trimmedCommand)) {
                console.log(`PowerShell command validated: ${trimmedCommand}`);
                return true;
            }
        }
        
        // 3. Check dangerous patterns (most restrictive)
        if (this.DANGEROUS_PATTERNS.some(pattern => pattern.test(trimmedCommand))) {
            console.warn(`Dangerous pattern detected: ${trimmedCommand}`);
            return false;
        }
        
        // 4. Check base command allowlist
        const baseCommand = trimmedCommand.split(/\s+/)[0].toLowerCase();
        
        // Special handling for npm commands
        if (baseCommand === 'npm') {
            return this.validateNpmCommand(trimmedCommand);
        }

        // Special handling for PowerShell scripts
        if (baseCommand === 'powershell.exe' || baseCommand === 'pwsh.exe' || trimmedCommand.startsWith('.\\scripts\\')) {
            return this.validatePowerShellCommand(trimmedCommand);
        }

        // Check if base command is in allowed list
        const isAllowed = this.ALLOWED_COMMANDS.has(baseCommand) || 
                         this.ALLOWED_COMMANDS.has(baseCommand.replace('.exe', ''));

        if (!isAllowed) {
            console.warn(`Command blocked - not in allowed list: ${baseCommand}`);
            return false;
        }

        return true;
    }

    /**
     * Enhanced validation with detailed error information
     * @param command The command to validate
     * @returns ValidationResult with detailed information
     */
    static validateCommandEnhanced(command: string): ValidationResult {
        if (!command || typeof command !== 'string') {
            return { 
                valid: false, 
                reason: 'invalid-input', 
                message: getSecurityErrorMessage(command || '', 'invalid-input')
            };
        }

        const trimmedCommand = command.trim();
        if (trimmedCommand.length === 0) {
            return { 
                valid: false, 
                reason: 'empty-command', 
                message: getSecurityErrorMessage(trimmedCommand, 'empty-command')
            };
        }

        // 1. Check whitelist first (most permissive)
        if (this.SAFE_COMMAND_PATTERNS.some(pattern => pattern.test(trimmedCommand))) {
            console.log(`Command whitelisted: ${trimmedCommand}`);
            return { valid: true };
        }
        
        // 2. Check PowerShell syntax
        if (trimmedCommand.toLowerCase().includes('powershell') || trimmedCommand.includes('$') || 
            trimmedCommand.includes('Get-') || trimmedCommand.includes('Stop-Process')) {
            if (this.validatePowerShellSyntax(trimmedCommand)) {
                console.log(`PowerShell command validated: ${trimmedCommand}`);
                return { valid: true };
            } else {
                return { 
                    valid: false, 
                    reason: 'powershell-syntax', 
                    message: getSecurityErrorMessage(trimmedCommand, 'powershell-syntax')
                };
            }
        }
        
        // 3. Check dangerous patterns (most restrictive)
        if (this.DANGEROUS_PATTERNS.some(pattern => pattern.test(trimmedCommand))) {
            console.warn(`Dangerous pattern detected: ${trimmedCommand}`);
            return { 
                valid: false, 
                reason: 'dangerous-pattern', 
                message: getSecurityErrorMessage(trimmedCommand, 'dangerous-pattern')
            };
        }
        
        // 4. Check base command allowlist
        const baseCommand = trimmedCommand.split(/\s+/)[0].toLowerCase();
        
        // Special handling for npm commands
        if (baseCommand === 'npm') {
            const isValid = this.validateNpmCommand(trimmedCommand);
            if (!isValid) {
                return { 
                    valid: false, 
                    reason: 'not-whitelisted', 
                    message: getSecurityErrorMessage(trimmedCommand, 'not-whitelisted')
                };
            }
            return { valid: true };
        }

        // Special handling for PowerShell scripts
        if (baseCommand === 'powershell.exe' || baseCommand === 'pwsh.exe' || trimmedCommand.startsWith('.\\scripts\\')) {
            const isValid = this.validatePowerShellCommand(trimmedCommand);
            if (!isValid) {
                return { 
                    valid: false, 
                    reason: 'powershell-syntax', 
                    message: getSecurityErrorMessage(trimmedCommand, 'powershell-syntax')
                };
            }
            return { valid: true };
        }

        // Check if base command is in allowed list
        const isAllowed = this.ALLOWED_COMMANDS.has(baseCommand) || 
                         this.ALLOWED_COMMANDS.has(baseCommand.replace('.exe', ''));

        if (!isAllowed) {
            console.warn(`Command blocked - not in allowed list: ${baseCommand}`);
            return { 
                valid: false, 
                reason: 'not-whitelisted', 
                message: getSecurityErrorMessage(trimmedCommand, 'not-whitelisted')
            };
        }

        return { valid: true };
    }

    /**
     * Validates npm-specific commands
     */
    private static validateNpmCommand(command: string): boolean {
        const parts = command.split(/\s+/);
        if (parts.length < 2) return false;

        const npmSubCommand = parts[1].toLowerCase();
        
        // Handle "npm run script-name"
        if (npmSubCommand === 'run' && parts.length >= 3) {
            const scriptName = parts[2].toLowerCase();
            return this.ALLOWED_NPM_SCRIPTS.has(scriptName);
        }

        return this.ALLOWED_NPM_SCRIPTS.has(npmSubCommand);
    }

    /**
     * Validates PowerShell commands and scripts
     */
    private static validatePowerShellCommand(command: string): boolean {
        // Allow only scripts in the scripts directory
        if (command.startsWith('.\\scripts\\')) {
            const scriptPath = command.split(/\s+/)[0];
            return scriptPath.endsWith('.ps1');
        }

        // For powershell.exe/pwsh.exe commands, only allow specific safe patterns
        if (command.toLowerCase().includes('powershell.exe') || command.toLowerCase().includes('pwsh.exe')) {
            // Allow only execution of .ps1 files with specific flags
            const allowedFlags = ['-ExecutionPolicy', 'Bypass', '-File'];
            const hasOnlyAllowedFlags = allowedFlags.some(flag => 
                command.includes(flag)
            );
            return hasOnlyAllowedFlags && command.includes('.ps1');
        }

        return false;
    }

    /**
     * Sanitizes and validates file paths to prevent path traversal
     * @param filePath The file path to sanitize
     * @param workspaceRoot The workspace root directory
     * @returns Sanitized absolute path
     * @throws Error if path traversal is detected
     */
    static sanitizePath(filePath: string, workspaceRoot: string): string {
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path provided');
        }

        if (!workspaceRoot || typeof workspaceRoot !== 'string') {
            throw new Error('Invalid workspace root provided');
        }

        // Normalize the path to resolve any .. or . components
        const normalized = path.normalize(filePath);
        
        // Resolve to absolute path
        const resolved = path.resolve(workspaceRoot, normalized);
        
        // Ensure the resolved path is within the workspace
        const workspaceAbsolute = path.resolve(workspaceRoot);
        if (!resolved.startsWith(workspaceAbsolute)) {
            throw new Error(`Path traversal detected: ${filePath} resolves outside workspace`);
        }

        return resolved;
    }

    /**
     * Validates file extensions for security
     * @param filePath The file path to check
     * @returns true if the file extension is allowed
     */
    static validateFileExtension(filePath: string): boolean {
        if (!filePath || typeof filePath !== 'string') {
            return false;
        }

        const ext = path.extname(filePath).toLowerCase();
        return this.ALLOWED_EXTENSIONS.has(ext);
    }

    /**
     * Escapes special characters in file paths for safe shell usage
     * @param filePath The file path to escape
     * @returns Escaped file path
     */
    static escapeFilePath(filePath: string): string {
        if (!filePath || typeof filePath !== 'string') {
            return '';
        }

        // For Windows, wrap in quotes if path contains spaces
        if (process.platform === 'win32') {
            return filePath.includes(' ') ? `"${filePath}"` : filePath;
        }

        // For Unix-like systems, escape special characters
        return filePath.replace(/(["\s'$`\\])/g, '\\$1');
    }

    /**
     * Creates a secure command with validated inputs
     * @param baseCommand The base command to execute
     * @param args Array of arguments
     * @param options Optional configuration
     * @returns Validated command string or null if invalid
     */
    static createSecureCommand(
        baseCommand: string, 
        args: string[] = [], 
        options: { workingDir?: string } = {}
    ): string | null {
        if (!this.validateCommand(baseCommand)) {
            return null;
        }

        let command = baseCommand;

        // Add arguments if provided
        if (args.length > 0) {
            const sanitizedArgs = args.map(arg => {
                // Basic argument sanitization
                if (typeof arg !== 'string') return '';
                return arg.replace(/[;&|`$(){}[\]\\]/g, ''); // Remove dangerous characters
            }).filter(arg => arg.length > 0);

            command += ' ' + sanitizedArgs.join(' ');
        }

        // Add working directory if provided
        if (options.workingDir) {
            try {
                const sanitizedDir = this.sanitizePath(options.workingDir, process.cwd());
                command = `cd "${sanitizedDir}" && ${command}`;
            } catch (error) {
                console.error('Invalid working directory:', error);
                return null;
            }
        }

        // Final validation of the complete command
        if (!this.validateCommand(command)) {
            return null;
        }

        return command;
    }
}