import * as vscode from 'vscode';

/* get menu items for custom build */
export function getMenuItems() {
    const config = vscode.workspace.getConfiguration('smart');
    const menuCommands = config.get('menuCommands') as string[];

    return menuCommands;
}

/* get parallel build number */
export function getParallelBuildNumber() {
    const config = vscode.workspace.getConfiguration('smart');
    const parallel = config.get('parallelBuidNumber') as number;

    return parallel;
}

/* get whether to use terminal menuconfig only */
export function getUseTerminalMenuconfig() {
    const config = vscode.workspace.getConfiguration('smart');
    const useTerminal = config.get('useTerminalMenuconfig') as boolean;

    return useTerminal;
}

/**
 * Menuconfig method type
 */
export interface MenuconfigMethod {
    type: 'extension' | 'terminal';
    command?: string;  // VS Code command for extension type
    terminal?: string; // Terminal command for terminal type
}

/**
 * Get the appropriate menuconfig method based on installed extensions and configuration
 * Priority:
 * 1. If useTerminalMenuconfig is true, always use terminal
 * 2. Check for rt-thread.rt-thread-kconfig extension
 * 3. Check for ai-embedded.vscode-kconfig-visual-editor extension
 * 4. Fall back to terminal scons --menuconfig
 * 
 * @param kconfigPath Optional Kconfig file path for vscode-kconfig-visual-editor
 * @returns MenuconfigMethod object describing the method to use
 */
export function getMenuconfigMethod(kconfigPath?: string): MenuconfigMethod {
    // Check if user wants to force terminal menuconfig
    if (getUseTerminalMenuconfig()) {
        return {
            type: 'terminal',
            terminal: 'scons --menuconfig'
        };
    }

    // Priority 1: Check for rt-thread-kconfig extension
    const rtThreadKconfig = vscode.extensions.getExtension('rt-thread.rt-thread-kconfig');
    if (rtThreadKconfig !== undefined) {
        return {
            type: 'extension',
            command: 'rt-thread-kconfig.menuconfig.windows'
        };
    }

    // Priority 2: Check for vscode-kconfig-visual-editor extension
    const kconfigVisualEditor = vscode.extensions.getExtension('ai-embedded.vscode-kconfig-visual-editor');
    if (kconfigVisualEditor !== undefined) {
        return {
            type: 'extension',
            command: 'kconfig-visual-editor.open',
        };
    }

    // Priority 3: Fall back to terminal menuconfig
    return {
        type: 'terminal',
        terminal: 'scons --menuconfig'
    };
}
