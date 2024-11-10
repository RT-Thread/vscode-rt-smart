import * as vscode from 'vscode';

export function getMenuItems() {
    const config = vscode.workspace.getConfiguration('smart');
    const menuCommands = config.get('menuCommands') as string[];

    return menuCommands;
}
