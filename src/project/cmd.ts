import * as os from 'os';
import * as fs from 'fs';

import { getWorkspaceFolder } from '../api';
import { executeCommand } from '../terminal';

let _currentProject: string = '';

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
