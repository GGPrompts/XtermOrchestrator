/**
 * Terminal UI Utilities
 * Provides ANSI-based UI components for interactive terminal interfaces
 */

export const ANSI = {
  // Cursor control
  CLEAR_SCREEN: '\x1b[2J\x1b[H',
  CLEAR_LINE: '\x1b[2K',
  CURSOR_HOME: '\x1b[H',
  CURSOR_SAVE: '\x1b[s',
  CURSOR_RESTORE: '\x1b[u',
  CURSOR_HIDE: '\x1b[?25l',
  CURSOR_SHOW: '\x1b[?25h',
  
  // Movement
  UP: (n = 1) => `\x1b[${n}A`,
  DOWN: (n = 1) => `\x1b[${n}B`,
  RIGHT: (n = 1) => `\x1b[${n}C`,
  LEFT: (n = 1) => `\x1b[${n}D`,
  GOTO: (x: number, y: number) => `\x1b[${y};${x}H`,
  
  // Colors
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  ITALIC: '\x1b[3m',
  UNDERLINE: '\x1b[4m',
  BLINK: '\x1b[5m',
  REVERSE: '\x1b[7m',
  
  // Foreground colors
  BLACK: '\x1b[30m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  
  // Bright foreground colors
  BRIGHT_BLACK: '\x1b[90m',
  BRIGHT_RED: '\x1b[91m',
  BRIGHT_GREEN: '\x1b[92m',
  BRIGHT_YELLOW: '\x1b[93m',
  BRIGHT_BLUE: '\x1b[94m',
  BRIGHT_MAGENTA: '\x1b[95m',
  BRIGHT_CYAN: '\x1b[96m',
  BRIGHT_WHITE: '\x1b[97m',
  
  // Background colors
  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',
};

export interface CheckboxOption {
  label: string;
  value: string;
  checked: boolean;
  description?: string;
}

export interface MenuOption {
  label: string;
  value: string;
  action?: () => void;
  description?: string;
}

export class TerminalUI {
  /**
   * Render a checkbox list
   */
  static renderCheckboxes(options: CheckboxOption[], selectedIndex: number): string {
    let output = '';
    
    options.forEach((option, index) => {
      const isSelected = index === selectedIndex;
      const checkbox = option.checked ? '[✓]' : '[ ]';
      const cursor = isSelected ? '▶ ' : '  ';
      
      if (isSelected) {
        output += ANSI.BRIGHT_CYAN + ANSI.BOLD;
      }
      
      output += `${cursor}${checkbox} ${option.label}`;
      
      if (option.description) {
        output += ANSI.RESET + ANSI.DIM + ` - ${option.description}`;
      }
      
      output += ANSI.RESET + '\n';
    });
    
    return output;
  }

  /**
   * Render a menu list
   */
  static renderMenu(options: MenuOption[], selectedIndex: number): string {
    let output = '';
    
    options.forEach((option, index) => {
      const isSelected = index === selectedIndex;
      const cursor = isSelected ? '▶ ' : '  ';
      
      if (isSelected) {
        output += ANSI.BRIGHT_GREEN + ANSI.BOLD;
      }
      
      output += `${cursor}${option.label}`;
      
      if (option.description) {
        output += ANSI.RESET + ANSI.DIM + ` - ${option.description}`;
      }
      
      output += ANSI.RESET + '\n';
    });
    
    return output;
  }

  /**
   * Create a box with borders
   */
  static createBox(content: string[], title?: string): string {
    const maxLength = Math.max(
      ...(title ? [title.length + 4] : []),
      ...content.map(line => line.length)
    );
    
    const width = maxLength + 4;
    let output = '';
    
    // Top border
    if (title) {
      output += '+-- ' + ANSI.BRIGHT_YELLOW + ANSI.BOLD + title + ANSI.RESET + ' ';
      output += '-'.repeat(Math.max(0, width - title.length - 5)) + '+\n';
    } else {
      output += '+' + '-'.repeat(width - 2) + '+\n';
    }
    
    // Content
    content.forEach(line => {
      const padding = width - line.length - 4;
      output += '| ' + line + ' '.repeat(padding) + ' |\n';
    });
    
    // Bottom border
    output += '+' + '-'.repeat(width - 2) + '+\n';
    
    return output;
  }

  /**
   * Create a progress bar
   */
  static createProgressBar(percentage: number, width: number = 30): string {
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    
    let bar = ANSI.BRIGHT_GREEN;
    bar += '█'.repeat(filled);
    bar += ANSI.DIM + ANSI.WHITE;
    bar += '░'.repeat(empty);
    bar += ANSI.RESET;
    
    return `[${bar}] ${percentage}%`;
  }

  /**
   * Create animated spinner frames
   */
  static getSpinnerFrames(): string[] {
    return ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  }

  /**
   * Create status indicator with emoji
   */
  static createStatusIndicator(status: 'idle' | 'working' | 'success' | 'error'): string {
    const indicators = {
      idle: '⚪ Idle',
      working: '🟡 Working',
      success: '🟢 Success',
      error: '🔴 Error'
    };
    
    return indicators[status] || indicators.idle;
  }

  /**
   * Format a command with syntax highlighting
   */
  static formatCommand(command: string): string {
    const parts = command.split(' ');
    if (parts.length === 0) return command;
    
    // Highlight the main command
    let formatted = ANSI.BRIGHT_CYAN + ANSI.BOLD + parts[0] + ANSI.RESET;
    
    // Format arguments
    if (parts.length > 1) {
      formatted += ' ' + ANSI.BRIGHT_WHITE + parts.slice(1).join(' ') + ANSI.RESET;
    }
    
    return formatted;
  }

  /**
   * Create ASCII art banner
   */
  static createBanner(): string {
    return `${ANSI.BRIGHT_CYAN}+------------------------------------------------------------------+\r
|                                                                  |\r
|            UNIFIED ORCHESTRATOR TERMINAL v2.0                    |\r
|                                                                  |\r
|              Control - Coordinate - Command                      |\r
|                                                                  |\r
+------------------------------------------------------------------+${ANSI.RESET}`;
  }
}