import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { getExtensionPath, isRTThreadWorksapce } from './api';
import { Constants } from './constants';
import { getCurrentProject } from './project/cmd';

let _terminal: vscode.Terminal | undefined;

const Registry = require('winreg');

export function initTerminal() {
    let terminal = vscode.window.activeTerminal;

    if (terminal) {
        _terminal = terminal;
        let name = Constants.TERMINAL_LABLE;
        vscode.commands.executeCommand("workbench.action.terminal.renameWithArg", { name });
    }

    if (os.platform() === 'win32') {
        const regKey = new Registry({
            hive: Registry.HKCR,
            key: '\\*\\shell\\ConEmu Here'
        });
        regKey.get('Icon', async function (err: any, item: any) {
            if (!err && item && item.value) {
                let conEmuPath = item.value.replace(/"/g, '').split(',')[0];
                let conEmuDir = path.dirname(conEmuPath);
                let conEmuBaseDir = path.join(conEmuDir, 'ConEmu');
                let venvPath = path.join(conEmuDir, '..', '.venv');
                venvPath = path.resolve(venvPath);

                vscode.workspace.getConfiguration('terminal').update(
                    'integrated.env.windows',
                    { 'VIRTUAL_ENV': venvPath, 'PATH': `${venvPath}\\Scripts;${process.env.PATH}` },
                    vscode.ConfigurationTarget.Workspace
                );
                let conEmuInitCmd = `cmd.exe /k ""${conEmuBaseDir}\\CmdInit.cmd" "${conEmuBaseDir}\\..\\..\\bin\\env-init.bat""`;

                let terminal = vscode.window.activeTerminal;
                if (terminal) {
                    _terminal = terminal;
                    vscode.commands.executeCommand("workbench.action.terminal.renameWithArg", { name: Constants.TERMINAL_LABLE });
                    _terminal.sendText(conEmuInitCmd, true);
                    _terminal.show();
                }else{
                    _terminal = terminal;
                    let extensionPath = getExtensionPath();
                    let iconPath: vscode.Uri | vscode.ThemeIcon | undefined;
                    if (extensionPath) {
                        iconPath = vscode.Uri.file(path.join(extensionPath, 'resources', "images", "rt-thread.png"));
                    }
                    const options: vscode.TerminalOptions = {
                        name: Constants.TERMINAL_LABLE,
                        iconPath: iconPath,
                        message: Constants.TERMINAL_LOGO,
                    };
                    _terminal = vscode.window.createTerminal(options);
                    _terminal.sendText(conEmuInitCmd, true);
                    _terminal.show();
                }
            } else {
                vscode.window.showErrorMessage('无法获取 ConEmu 路径，请确保已安装 ConEmu 并正确注册。');
            }
        });
    }else {
        let terminal = vscode.window.activeTerminal;
        if (terminal) {
            _terminal = terminal;
            vscode.commands.executeCommand("workbench.action.terminal.renameWithArg", { name: Constants.TERMINAL_LABLE });
            _terminal.show();
        }else{
            _terminal = terminal;
            let extensionPath = getExtensionPath();
            let iconPath: vscode.Uri | vscode.ThemeIcon | undefined;
            if (extensionPath) {
                iconPath = vscode.Uri.file(path.join(extensionPath, 'resources', "images", "rt-thread.png"));
            }
            const options: vscode.TerminalOptions = {
                name: Constants.TERMINAL_LABLE,
                iconPath: iconPath,
                message: Constants.TERMINAL_LOGO,
            };
            _terminal = vscode.window.createTerminal(options);
            _terminal.show();
        }
    }
}
    


export function getTerminal(): vscode.Terminal | undefined {
    if (!_terminal) {
        initTerminal()
    }
    return _terminal;
}

export function executeCommand(command: string) {
    let terminal = getTerminal();
    if (terminal) {
        terminal.show();

        if (command.includes('scons') && isRTThreadWorksapce()) {
            if (!command.includes('-C')) {
                command = command.replace('scons', 'scons -C ' + getCurrentProject() + ' ');
            }
        }

        terminal.sendText(command, true);
    }
}

export function resetTerminal() {
    _terminal = undefined;
}
