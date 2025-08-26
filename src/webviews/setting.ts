import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { getEnvROOT, getExtensionVersion, installEnv, readJsonObject, openFolder, writeJsonObject } from '../api';
import { handleSDKMessage } from './settings_sdk';
import { checkEnvStatus, handleEnvMessage } from './settings_env';
import { postMessageExtensionData } from '../extension';

let settingViewPanel: vscode.WebviewPanel | null = null;
const name = "setting";
const title = "RT-Thread Setting";

const cfgFn = path.join(os.homedir(), '.env/cfg.json');
const sdkCfgFn = path.join(os.homedir(), '.env/tools/scripts/sdk_cfg.json');

let extensionInfo = {
	version: "0.1.1",
	env: {
		path: "~/.env",
		version: "0.0.1"
	},
	SDKConfig : {},
	configInfo : [{name: "RT-Thread", path: "d:/workspace/rt-thread", description: "RT-Thread主干路径"}]
};

function readReadmeFile(fn: string): string {
	if (fs.existsSync(fn)) {
		let data = fs.readFileSync(fn, 'utf-8');
		return data;
	}

	return "";
}

function readBoardInfoFile() {
    let bi = readJsonObject(path.join('resources', 'bi.json'));

    return ;
}

// Env 相关函数已移动到 settings_env.ts

export function openSettingWebview(context: vscode.ExtensionContext) {
    if (settingViewPanel) {
        settingViewPanel.reveal(vscode.ViewColumn.One);
    }
    else {
        const rootDir = path.join(context.extensionPath, 'out');
        const panel = vscode.window.createWebviewPanel('webview', title, vscode.ViewColumn.One, {
            enableScripts: true, // Enable javascript in the webview
            localResourceRoots: [vscode.Uri.file(rootDir)], // Only allow resources from vue view,
            retainContextWhenHidden: true, // Keep the webview's context when it is hidden
        });
        let localResourceRoots = vscode.Uri.joinPath(context.extensionUri, 'out').toString();
        // console.log(localResourceRoots);

        const iconPath = path.join(context.extensionPath, 'resources', 'images', 'rt-thread.png');
        panel.iconPath = vscode.Uri.file(iconPath);

        // handle close webview event
        panel.onDidDispose(() => {
            settingViewPanel = null;
        });

        // update extensionInfo
		extensionInfo.version = getExtensionVersion();
		extensionInfo.env.path = path.join(os.homedir(), '.env');
        // if .env/tools/script/env.json exist, to read the version of env script
        if (fs.existsSync(path.join(extensionInfo.env.path, 'tools', 'scripts', 'env.json'))) {
            let envInfo = readJsonObject(path.join(extensionInfo.env.path, 'tools', 'scripts', 'env.json'));
            extensionInfo.env.version = envInfo.version;
        }
		extensionInfo.SDKConfig = readJsonObject(sdkCfgFn);
        
        // read RT-Thread folder
        let cfg:any [] = readJsonObject(cfgFn);
        if (cfg.length > 0 && cfg[0].path) {
            extensionInfo.configInfo[0].path = cfg[0].path;
        }
        else {
            // 设置为空字符串而不是字符串'undefined'
            extensionInfo.configInfo[0].path = '';
        }

        // 初始化时检查 Env 状态
        checkEnvStatus().then(envStatus => {
            panel.webview.postMessage({ command: 'envStatus', status: envStatus });
        });

        // 初始化时发送SDK配置
        if (extensionInfo.SDKConfig) {
            panel.webview.postMessage({ command: 'setSDKConfig', data: extensionInfo.SDKConfig });
        }

        // read out/${name}/index.html
        const indexHtmlPath = vscode.Uri.file(context.asAbsolutePath(`out/${name}/index.html`));
        const htmlFolder = vscode.Uri.file(context.asAbsolutePath(`out`));
        const indexHtmlContent = vscode.workspace.fs.readFile(indexHtmlPath).then(buffer => buffer.toString());

        // set html
        indexHtmlContent.then(content => {
            panel.webview.html = content.replace(/"[\w\-\.\/]+?\.(?:css|js)"/ig, (str) => {
                const fileName = str.substr(1, str.length - 2); // remove '"'
                const absPath = htmlFolder.path + '/' + fileName;

                return `"${panel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString()}"`;
            });

            // 在HTML设置完成后延迟发送初始数据
            setTimeout(() => {
                // 发送SDK配置
                if (extensionInfo.SDKConfig) {
                    panel.webview.postMessage({ command: 'setSDKConfig', data: extensionInfo.SDKConfig });
                }
                // 发送扩展信息
                panel.webview.postMessage({command: 'extensionInfo', data: extensionInfo});
            }, 100);
        });
        panel.webview.onDidReceiveMessage(async (message) => {
            // 先尝试使用SDK处理器处理消息
            if (handleSDKMessage(panel.webview, message)) {
                return;
            }
            
            // 尝试使用Env处理器处理消息
            if (handleEnvMessage(panel.webview, message)) {
                return;
            }
            
            let data : any = {};
            let defaultPath:any;

            switch (message.command) {
                case 'getExtensionInfo':
                    panel.webview.postMessage({command: 'extensionInfo', data: extensionInfo});
                    return ;
                case 'browseToolchainFolder':
                    defaultPath = message.args[0];
                    let folder = await openFolder(defaultPath);
                    if (folder) {
                        panel.webview.postMessage({command: 'setToolchainFolder', data: folder});
                    }
                    return;
                case 'browseItemFolder':
                    defaultPath = message.args[0];
                    let itemFolder = await openFolder(defaultPath);
                    if (itemFolder) {
                        panel.webview.postMessage({command: 'setItemFolder', data: itemFolder});
                    }
                    return;

                // configuration for toolchains
                case 'getSDkConfig':
                    data = readJsonObject(sdkCfgFn);
                    if (data) {
                        panel.webview.postMessage({command: 'setSDKConfig', data: data});
                    }
                    return ;
                case 'setSDKConfig':
                    data = message.args[0];
                    writeJsonObject(message.args[0], sdkCfgFn);
                    // 更新内存中的配置
                    extensionInfo.SDKConfig = data;
    
                    vscode.window.showInformationMessage('保存工具链配置成功');
                    return ;
    
                // configuration for RT-Thread folder
                case 'getConfig':
                    data = readJsonObject(cfgFn);
                    if (data) {
                        panel.webview.postMessage({command: 'setConfig', data: data});
                    }
                    return ;
                case 'setConfig':
                    data = message.args[0];
                    writeJsonObject(message.args[0], cfgFn);
    
                    vscode.window.showInformationMessage('保存路径配置成功');
                    // update configData
                    if (data && data.length > 0 && data[0].path) {
                        extensionInfo.configInfo[0].path = data[0].path;
                    } else {
                        extensionInfo.configInfo[0].path = '';
                    }
                    return ;

                case 'getBoardReadme':
                    data = message.args[0];
                    let readme = readReadmeFile('d:/workspace/rt-thread/bsp/qemu-vexpress-a9/README.md');
                    if (readme) {
                        panel.webview.postMessage({command: 'setBoardReadme', data: readme});
                    }
    
                    return ;
                
                case 'showMessage':
                    data = message.args[0];
                    vscode.window.showInformationMessage(data);
                    return ;
            }
        }, undefined, context.subscriptions);
        panel.onDidChangeViewState((e) => {
            if (e.webviewPanel.visible) {
                panel.webview.postMessage({command: 'extensionInfo', data: extensionInfo});
            }
        });
    
        settingViewPanel = panel;
    }

    postMessageExtensionData(context, settingViewPanel);

    return settingViewPanel;
}
