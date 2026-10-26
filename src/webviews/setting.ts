import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getEnvROOT, readJsonObject, openFolder, writeJsonObject } from '../api';
import { handleEnvMessage } from './settings_env';
import { postMessageExtensionData } from '../extension';

let settingViewPanel: vscode.WebviewPanel | undefined;

function readConfig(): any[] {
    const config = readJsonObject(path.join(getEnvROOT(), 'cfg.json'));
    return Array.isArray(config) ? config : [];
}

function postSettingInfo(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): void {
    panel.webview.postMessage({
        command: 'extensionInfo',
        data: {
            version: context.extension.packageJSON.version,
            env: { path: getEnvROOT() },
            configInfo: readConfig(),
        },
    });
    postMessageExtensionData(context, panel);
}

export async function openSettingWebview(context: vscode.ExtensionContext): Promise<vscode.WebviewPanel | undefined> {
    if (settingViewPanel) {
        settingViewPanel.reveal(vscode.ViewColumn.One);
        return settingViewPanel;
    }

    const rootDir = path.join(context.extensionPath, 'out');
    const panel = vscode.window.createWebviewPanel('webview', 'RT-Thread Setting', vscode.ViewColumn.One, {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(rootDir)],
        retainContextWhenHidden: true,
    });
    settingViewPanel = panel;
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'images', 'RT-Thread.png');
    panel.onDidDispose(() => {
        settingViewPanel = undefined;
    }, undefined, context.subscriptions);

    panel.webview.onDidReceiveMessage(async message => {
        if (handleEnvMessage(panel.webview, message)) {
            return;
        }
        try {
            switch (message.command) {
                case 'getExtensionInfo':
                    postSettingInfo(context, panel);
                    break;
                case 'browseItemFolder': {
                    const defaultPath = message.args?.[0];
                    const folder = await openFolder(typeof defaultPath === 'string' && defaultPath ? defaultPath : undefined);
                    if (folder) {
                        panel.webview.postMessage({ command: 'setItemFolder', data: folder });
                    }
                    break;
                }
                case 'getConfig':
                    panel.webview.postMessage({ command: 'setConfig', data: readConfig() });
                    break;
                case 'setConfig': {
                    const config = message.args?.[0]?.[0];
                    if (!config || config.name !== 'RT-Thread' || typeof config.path !== 'string') {
                        throw new Error('RT-Thread 根目录配置无效。');
                    }
                    if (!fs.existsSync(getEnvROOT())) {
                        throw new Error('请先安装 Env，再保存 RT-Thread 根目录配置。');
                    }
                    const configs = readConfig().filter(item => item.name !== 'RT-Thread');
                    configs.unshift({ name: config.name, path: config.path, description: config.description });
                    writeJsonObject(configs, path.join(getEnvROOT(), 'cfg.json'));
                    panel.webview.postMessage({ command: 'setConfig', data: configs });
                    vscode.window.showInformationMessage('保存路径配置成功');
                    break;
                }
            }
        } catch (error) {
            if (message.command === 'setConfig') {
                panel.webview.postMessage({ command: 'configSaveFailed' });
            }
            vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
        }
    }, undefined, context.subscriptions);

    try {
        const buffer = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(context.extensionUri, 'out', 'setting', 'index.html'));
        if (settingViewPanel === panel) {
            panel.webview.html = buffer.toString().replace(/"[\w\-\.\/]+?\.(?:css|js)"/ig, str => {
                const resource = vscode.Uri.file(path.join(rootDir, str.slice(1, -1)));
                return `"${panel.webview.asWebviewUri(resource).toString()}"`;
            });
        }
    } catch (error) {
        panel.dispose();
        vscode.window.showErrorMessage(`无法打开 RT-Thread Setting：${error instanceof Error ? error.message : String(error)}`);
    }
    return settingViewPanel;
}
