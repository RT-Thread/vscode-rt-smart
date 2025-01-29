import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getEnvROOT, getExtensionVersion, installEnv, createProject, readJsonObject, openFolder, writeJsonObject, getBoardInfo } from '../api';

let homeViewPanel: vscode.WebviewPanel | null = null;
const name = "home";
const title = "RT-Thread Home";

const cfgFn = path.join(os.homedir(), '.env/cfg.json');
const sdkCfgFn = path.join(os.homedir(), '.env/tools/scripts/sdk_cfg.json');

let extensionInfo = {
	version: "0.1.1",
	env: {
		path: "~/.env",
		version: "0.0.1"
	},
	projectList: [
		{
			manufacturer: "ST",
			boards: [
				"stm32f412-st-nucleo",
				"stm32f407-rt-spark"
			]
		},
		{
			manufacturer: "QEMU",
			boards: [
				"qemu-vexpress-a9",
				"qemu-virt64-aarch64",
				"qemu-virt64-riscv64"
			]
		}
	],
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

export function openHomeWebview(context: vscode.ExtensionContext) {
    if (homeViewPanel) {
        homeViewPanel.reveal(vscode.ViewColumn.One);
    }
    else {
        const rootDir = path.join(context.extensionPath, 'out');
        const panel = vscode.window.createWebviewPanel('webview', title, vscode.ViewColumn.One, {
            enableScripts: true, // Enable javascript in the webview
            localResourceRoots: [vscode.Uri.file(rootDir)] // Only allow resources from vue view
        });
        let localResourceRoots = vscode.Uri.joinPath(context.extensionUri, 'out').toString();
        // console.log(localResourceRoots);

        const iconPath = path.join(context.extensionPath, 'resources', 'images', 'rt-thread.png');
        panel.iconPath = vscode.Uri.file(iconPath);

        // handle close webview event
        panel.onDidDispose(() => {
            homeViewPanel = null;
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
        extensionInfo.projectList = getBoardInfo();
        // console.log(extensionInfo.projectList);
        // read RT-Thread folder
        let cfg:any [] = readJsonObject(cfgFn);
        if (cfg.length > 0) {
            extensionInfo.configInfo[0].path = cfg[0].path;
        }
        else {
            extensionInfo.configInfo[0].path = 'undefined';
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
        });
        panel.webview.onDidReceiveMessage(async (message) => {
            let data : any = {};
            let defaultPath:any;

            switch (message.command) {
                case 'getExtensionInfo':
                    panel.webview.postMessage({command: 'extensionInfo', data: extensionInfo});
                    return ;
                case 'createProject':
                    let projectInfo = message.args[0];
                    createProject(projectInfo.folder, projectInfo);
                    return;
                case 'browseProjectFolder':
                    defaultPath = message.args[0];
                    let projectFolder = await openFolder(defaultPath);
                    if (projectFolder) {
                        panel.webview.postMessage({command: 'setProjectFolder', data: projectFolder});
                    }
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
                        panel.webview.postMessage({command: 'setConfig', data: data});
                    }
                    return ;
                case 'setSDKConfig':
                    data = message.args[0];
                    writeJsonObject(message.args[0], sdkCfgFn);
    
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
                    extensionInfo.configInfo[0].path = data[0].path;
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
        })
    
        homeViewPanel = panel;
    }

    return homeViewPanel;
}
