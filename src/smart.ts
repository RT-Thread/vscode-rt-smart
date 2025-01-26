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
