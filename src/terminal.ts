import * as vscode from 'vscode';
import * as path from 'path';
import { getExtensionPath, getWorkspaceFolder } from './api';
import { Constants } from './constants';

let _terminal: vscode.Terminal | undefined;

export function initTerminal() {
  let terminal = vscode.window.activeTerminal;
  if (terminal) {
    _terminal = terminal;
    // change terminal name to RT-Thread
    let name = Constants.TERMINAL_LABLE;
    vscode.commands.executeCommand("workbench.action.terminal.renameWithArg", { name });
  };
}

export function getTerminal(): vscode.Terminal | undefined {
  if (!_terminal) {
    let extensionPath = getExtensionPath();
    if (extensionPath) {
        let iconPath : vscode.Uri | vscode.ThemeIcon = vscode.Uri.file(path.join(extensionPath, 'resources', "images", "rt-thread.png"));
        const options: vscode.TerminalOptions = {
            name: Constants.TERMINAL_LABLE,
            iconPath: iconPath,
            message: Constants.TERMINAL_LOGO,
        };

        _terminal = vscode.window.createTerminal(options);
    }
  }

  return _terminal;
}

export function executeCommand(command: string) {
    let terminal = getTerminal();
    if (terminal) {
      terminal.show();
      terminal.sendText(command, true);
    }
}

export function resetTerminal() {
    _terminal = undefined;
}
