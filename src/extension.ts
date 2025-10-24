// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { openSettingWebview } from './webviews/setting';
import { openAboutWebview } from './webviews/about';
import { openCreateProjectWebview } from './webviews/create-project';
import { openAnalyzeWebview } from './webviews/analyze';
import { initOnDidChangeListener } from './listener';
import { executeCommand, initTerminal } from './terminal';
import { getMenuItems, getParallelBuildNumber } from './smart';
import { initDockView } from './dock';
import { setupVEnv } from './venv';
import { initAPI } from './api';
import { openWorkspaceProjectsWebview } from './webviews/project';
import { initProjectTree, setCurrentSelectedBspItem } from './project/tree';
import { DecorationProvider } from './project/fileDecorationProvider';
import { getCurrentProjectInWorkspace } from './webviews/project';
import { initCurrentProject } from './project/cmd';

let _context: vscode.ExtensionContext;

export function postMessageExtensionData(context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {
    // 获取插件版本号（从 package.json 中读取）
    const extensionVersion = context.extension.packageJSON.version;
    const extensionNaeme = context.extension.packageJSON.name;
    panel.webview.postMessage({ version: extensionVersion, name: extensionNaeme });
}

// 有两种模式
// isRTThreadWorksapce - workspace模式，会定位.vscode/workspace.json文件是否存在，是否启用
// isRTThread - 项目模式，rtconfig.h文件是否存在

export async function activate(context: vscode.ExtensionContext) {
    let isRTThread: boolean = false;
    let isRTThreadWorksapce: boolean = false;

    _context = context;

    // 获取插件版本号（从 package.json 中读取）
    const extensionVersion = context.extension.packageJSON.version;
    // 例如：version 为 "1.0.0"
    console.log('插件版本号：', extensionVersion);

    // init context for isRTThread, isRTThreadWorksapce
    vscode.commands.executeCommand('setContext', 'isRTThread', isRTThread);
    context.workspaceState.update('isRTThread', isRTThread);
    vscode.commands.executeCommand('setContext', 'isRTThreadWorksapce', isRTThreadWorksapce);
    context.workspaceState.update('isRTThreadWorksapce', isRTThreadWorksapce);
    initAPI(context);

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        const workspacePath = workspaceFolders[0].uri.fsPath;

        const rtthreadWorkspace = path.join(workspacePath, '.vscode', 'workspace.json');
        if (fs.existsSync(rtthreadWorkspace)) {
            const json = fs.readFileSync(rtthreadWorkspace, 'utf8');
            const jsonNode = JSON.parse(json);

            if (jsonNode.hasOwnProperty("bsps")) {
                isRTThreadWorksapce = true;
                vscode.commands.executeCommand('setContext', 'isRTThreadWorksapce', true);
                context.workspaceState.update('isRTThreadWorksapce', isRTThreadWorksapce);

                new DecorationProvider(context);

                // get current project from workspace.json file
                let currentProject = getCurrentProjectInWorkspace();
                if (currentProject) {
                    DecorationProvider.getInstance().markFile(vscode.Uri.file(currentProject));
                    // 初始化当前项目到 cmd.ts 的 _currentProject 变量
                    initCurrentProject(currentProject);
                    // 初始化当前选中的BSP项目，以便后续切换时能正确移除标记
                    setCurrentSelectedBspItem(currentProject);
                }
            }
        }
        else {
            // check rtconfig.h exists
            const rtconfigPath = path.join(workspacePath, 'rtconfig.h');
            if (fs.existsSync(rtconfigPath)) {
                /* The workspace is a RT-Thread Project*/
                isRTThread = true;
                vscode.commands.executeCommand('setContext', 'isRTThread', true);
                context.workspaceState.update('isRTThread', isRTThread);
            }
        }

        if (isRTThread || isRTThreadWorksapce) {
            // if it's Windows system
            if (os.platform() === 'win32') {
                await setupVEnv();
            }

            initTerminal();
            setupStatusBarItems(context);
            initOnDidChangeListener(context);

            // register commands
            vscode.commands.registerCommand('extension.executeCommand', (arg1, arg2) => {
                if (arg1) {
                    executeCommand(arg1);
                }
                if (arg2) {
                    executeCommand(arg2);
                }
            });
            vscode.commands.registerCommand('extension.clickProject', (arg) => {
                if (arg) {
                    // open file
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.file(arg.fn));
                }
            });
        }
    }

    vscode.commands.registerCommand('extension.showSetting', () => {
        openSettingWebview(context);
    });
    vscode.commands.registerCommand('extension.showCreateProject', () => {
        openCreateProjectWebview(context);
    });
    vscode.commands.registerCommand('extension.showAbout', () => {
        openAboutWebview(context);
    });
    vscode.commands.registerCommand('extension.showAnalyze', () => {
        openAnalyzeWebview(context);
    });

    if (isRTThreadWorksapce) {
        vscode.commands.registerCommand('extension.showWorkspaceSettings', () => {
            openWorkspaceProjectsWebview(context);
        });
        initProjectTree(context);
    }

    /* initialize dock view always */
    initDockView(context);
    initExperimentStatusBarItem(context);
}

function initExperimentStatusBarItem(context: vscode.ExtensionContext) {
    if (false) {
        const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 5);
        statusItem.text = '$(beaker) 实验性功能';
        statusItem.tooltip = 'Experimental features';
        statusItem.command = 'extension.Experimental';
        statusItem.show();

        vscode.commands.registerCommand('extension.Experimental', () => {
            console.log('Experimental features are not available yet.');
        });
    }
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
