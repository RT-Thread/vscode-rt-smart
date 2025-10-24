import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';

import { getWorkspaceFolder } from '../api';
import { executeCommand } from '../terminal';
import { readWorkspaceJson, writeWorkspaceJson } from '../webviews/project';

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

export function configProject(arg: any) {
    if (arg) {
        let cmd = 'scons -C ' + arg.fn + ' --menuconfig';

        executeCommand(cmd);
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
