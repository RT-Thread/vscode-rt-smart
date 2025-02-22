// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { openHomeWebview } from './webviews/home';
import { openAboutWebview } from './webviews/about';
import { initOnDidChangeListener } from './listener';
import { executeCommand, initTerminal } from './terminal';
import { getMenuItems, getParallelBuildNumber } from './smart';
import { initDockView } from './dock';
import { setupVEnv } from './venv';
import { initAPI } from './api';

let _context: vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext) {
    let isRTThread: boolean = false;
    const workspaceFolders = vscode.workspace.workspaceFolders;

    _context = context;
    if (workspaceFolders) {
        const workspacePath = workspaceFolders[0].uri.fsPath;
        // check rtconfig.h exists
        const rtconfigPath = path.join(workspacePath, 'rtconfig.h');
        if (fs.existsSync(rtconfigPath)) {
            /* The workspace is a RT-Thread Project*/
            isRTThread = true;
            initAPI(context, isRTThread);
            vscode.commands.executeCommand('setContext', 'isRTThread', true);

            // if it's Windows system
            if (os.platform() === 'win32') {
                await setupVEnv();
            }

            initTerminal();
            setupStatusBarItems(context);
            initOnDidChangeListener(context);

            // register commands
            vscode.commands.registerCommand('extension.showAbout', () => {
                openAboutWebview(context);
            });            
            vscode.commands.registerCommand('extension.executeCommand', (arg1, arg2) => {
                if (arg1)
                {
                    executeCommand(arg1);
                }
                if (arg2)
                {
                    executeCommand(arg2);
                }
            });
            vscode.commands.registerCommand('extension.clickProject', (arg) => {
                if (arg) {
                    // open file
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.file(arg.fn));
                }
            })
        }
        else {
            isRTThread = false;
            vscode.commands.executeCommand('setContext', 'isRTThread', false);
            initAPI(context, isRTThread);
        }
    }
    else {
        initAPI(context, isRTThread);
    }

    vscode.commands.registerCommand('extension.showHome', () => {
        openHomeWebview(context);
    });
    /* initialize dock view always */
    initDockView(context);
}

function setupStatusBarItems(context: vscode.ExtensionContext) {
    const buildIcon = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
    buildIcon.text = '$(github-action) 构建';
    buildIcon.tooltip = 'Build RT-Thread Kernel';
    buildIcon.command = 'extension.buildProject';
    buildIcon.show();
    vscode.commands.registerCommand('extension.buildProject', () => {
        const buildNumber = getParallelBuildNumber();

        if (buildNumber > 1) {
            executeCommand(`scons -j${buildNumber}`);
        }
        else {
            executeCommand('scons');
        }
    });

    let menuItems = getMenuItems();
    if (menuItems && menuItems.length > 0) {
        const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusItem.text = '$(menu) 自定义构建...';
        statusItem.tooltip = 'build with custom commands';
        statusItem.command = 'extension.openMenu';
        statusItem.show();

        context.subscriptions.push(statusItem);

        let disposable = vscode.commands.registerCommand('extension.openMenu', () => {
            const items = getMenuItems();
            vscode.window.showQuickPick(items).then(selectedItem => {
                if (selectedItem) {
                    executeCommand(selectedItem);
                }
            });
        });

        context.subscriptions.push(disposable);
    }
}

export function deactivate() { }
