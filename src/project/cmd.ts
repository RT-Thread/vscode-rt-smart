import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';

import { getWorkspaceFolder } from '../api';
import { executeCommand } from '../terminal';
import { readWorkspaceJson, writeWorkspaceJson } from '../webviews/project';
import { getMenuconfigMethod, MENUCONFIG_COMMANDS } from '../smart';

let _currentProject: string = '';

export function initCurrentProject(projectPath: string) {
    if (projectPath) {
        _currentProject = projectPath;
    }
}

export function fastBuildProject(arg: any) {
    if (arg) {
        const cpus = os.cpus().length;
        let cmd = 'scons -C ' + arg.fn + ' -j ' + cpus.toString();

        executeCommand(cmd);
    }

    return;
}

/**
 * Helper function to execute terminal-based menuconfig for a BSP project
 * @param bspPath The path to the BSP project
 */
function executeTerminalMenuconfig(bspPath: string) {
    let cmd = 'scons -C ' + bspPath + ' --menuconfig';
    executeCommand(cmd);
}

export function configProject(arg: any) {
    if (arg) {
        const menuconfigMethod = getMenuconfigMethod();
        
        if (menuconfigMethod.type === 'extension') {
            // For rt-thread-kconfig extension, it handles multi-BSP scenarios automatically
            if (menuconfigMethod.command === MENUCONFIG_COMMANDS.RT_THREAD_KCONFIG) {
                // Change to the BSP directory first
                executeCommand('cd ' + arg.fn);
                // Execute the extension command
                vscode.commands.executeCommand(menuconfigMethod.command);
            } 
            // For vscode-kconfig-visual-editor, we need to open the Kconfig file explicitly
            else if (menuconfigMethod.command === MENUCONFIG_COMMANDS.KCONFIG_VISUAL_EDITOR) {
                const kconfigPath = path.join(arg.fn, 'Kconfig');
                if (fs.existsSync(kconfigPath)) {
                    // Open the Kconfig file with the visual editor
                    vscode.workspace.openTextDocument(kconfigPath).then(
                        doc => {
                            vscode.window.showTextDocument(doc);
                        },
                        error => {
                            vscode.window.showErrorMessage(`Failed to open Kconfig file: ${error.message}`);
                            // Fallback to terminal on error
                            executeTerminalMenuconfig(arg.fn);
                        }
                    );
                } else {
                    // Fallback to terminal if Kconfig doesn't exist
                    executeTerminalMenuconfig(arg.fn);
                }
            }
            else {
                // Generic extension command
                executeCommand('cd ' + arg.fn);
                vscode.commands.executeCommand(menuconfigMethod.command!);
            }
        } else {
            // For terminal-based menuconfig
            executeTerminalMenuconfig(arg.fn);
        }
    }

    return;
}

export function openTerminalProject(arg: any) {
    if (arg) {
        let cmd = 'cd ' + arg.fn;

        executeCommand(cmd);
    }

    return;
}

export function openProjectInNewWindow(arg: any) {
    if (arg && arg.fn) {
        // Open the BSP directory in a new VS Code window
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(arg.fn), true);
    }

    return;
}

export function setCurrentProject(arg: any) {
    if (arg) {
        _currentProject = arg.fn;

        let cmd = 'scons -C ' + arg.fn + ' --target=vsc_workspace';
        executeCommand(cmd);

        // update workspace.json file
        let workspaceJson = readWorkspaceJson();
        if (workspaceJson) {
            const workspaceFolder = getWorkspaceFolder();
            let relativeProject = arg.fn;
            if (workspaceFolder && typeof arg.fn === 'string' && arg.fn.length > 0) {
                if (path.isAbsolute(arg.fn)) {
                    relativeProject = path.relative(workspaceFolder, arg.fn);
                }
            }
            workspaceJson.currentProject = relativeProject;
            writeWorkspaceJson(workspaceJson);
        }
    }

    return;
}

export function getCurrentProject() {
    let rtconfig = getWorkspaceFolder() + '/' + 'rtconfig.h';

    if (fs.existsSync(rtconfig)) {
        return getWorkspaceFolder();
    }

    return _currentProject;
}
