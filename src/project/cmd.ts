import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';

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

export function setCurrentProject(arg: any) {
    if (arg) {
        _currentProject = arg.fn;

        let cmd = 'scons -C ' + arg.fn + ' --target=vsc_workspace';
        executeCommand(cmd);

        // update workspace.json file
        let workspaceJson = readWorkspaceJson();
        if (workspaceJson) {
            workspaceJson.currentProject = arg.fn;
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
