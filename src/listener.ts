import * as vscode from 'vscode';
import { resetTerminal } from './terminal';
import { Constants } from './constants';

export function initOnDidChangeListener(context: vscode.ExtensionContext) {
    vscode.window.onDidCloseTerminal(event => {
        if (event.name === Constants.TERMINAL_LABLE) {
            resetTerminal();
        }
    });
}
