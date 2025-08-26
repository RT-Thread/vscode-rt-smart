import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getEnvROOT, getExtensionVersion, createProject, readJsonObject, getBoardInfo } from '../api';
import { postMessageExtensionData } from '../extension';

let createProjectViewPanel: vscode.WebviewPanel | null = null;
const name = "create-project";
const title = "RT-Thread Create Project";

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
	SDKConfig: {},
	configInfo: [{ name: "RT-Thread", path: "d:/workspace/rt-thread", description: "RT-Thread主干路径" }]
};

function readReadmeFile(fn: string): string {
	if (fs.existsSync(fn)) {
		let data = fs.readFileSync(fn, 'utf-8');
		return data;
	}

	return "";
}

export function openCreateProjectWebview(context: vscode.ExtensionContext) {
	if (createProjectViewPanel) {
		createProjectViewPanel.reveal(vscode.ViewColumn.One);
	}
	else {
		const rootDir = path.join(context.extensionPath, 'out');
		const panel = vscode.window.createWebviewPanel('webview', title, vscode.ViewColumn.One, {
			enableScripts: true, // Enable javascript in the webview
			retainContextWhenHidden: true, // Keep the webview's context when it is hidden
			localResourceRoots: [vscode.Uri.file(rootDir)] // Only allow resources from vue view
		});

		// 更新扩展版本信息
		extensionInfo.version = getExtensionVersion();

		// 更新配置信息
		let cfgObj = readJsonObject(cfgFn);
		if (cfgObj) {
			extensionInfo.configInfo = cfgObj.RTThreadConfig;
		}

		// 更新SDK相关信息
		let sdkCfgObj = readJsonObject(sdkCfgFn);
		if (sdkCfgObj) {
			extensionInfo.SDKConfig = sdkCfgObj;
		}

		// And set its HTML content
		// read out/${name}/index.html
		const indexHtmlPath = vscode.Uri.file(context.asAbsolutePath(`out/${name}/index.html`));
		const htmlFolder = vscode.Uri.file(context.asAbsolutePath(`out`));
		const indexHtmlContent = vscode.workspace.fs.readFile(indexHtmlPath).then(buffer => buffer.toString());

		// set html
		indexHtmlContent.then(content => {
			panel.webview.html = content.replace(/"[\w\-\.\/]+?\.(?:css|js)"/ig, (str) => {
				const fileName = str.substr(1, str.length - 2); // remove '"'
				const absPath = htmlFolder.path + '/' + fileName;
				const uri = vscode.Uri.file(absPath);
				return '"' + panel.webview.asWebviewUri(uri).toString() + '"';
			});
		});
		createProjectViewPanel = panel;

		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'getExtensionInfo':
						// 尝试读取env环境变量信息并获取各种路径信息
						let envRoot = getEnvROOT();
						extensionInfo.env.path = envRoot;

						// 更新环境版本信息
						if (fs.existsSync(path.join(extensionInfo.env.path, 'tools', 'scripts', 'env.json'))) {
							let envInfo = readJsonObject(path.join(extensionInfo.env.path, 'tools', 'scripts', 'env.json'));
							if (envInfo) {
								extensionInfo.env.version = envInfo.version;
							}
						}

						let workspace = vscode.workspace.workspaceFolders?.[0];
						// 获取BSP工程信息
						if (workspace) {
							const rtthreadFn = path.join(workspace.uri.fsPath, '.vscode', 'rtthread.json');
							if (fs.existsSync(rtthreadFn)) {
								let rtthreadObj = readJsonObject(rtthreadFn);
								if (rtthreadObj && rtthreadObj.board_info) {
									extensionInfo.projectList = getBoardInfo();
								}
							}
						}

						// 如果没有从workspace获取到projectList，则使用默认值
						if (!extensionInfo.projectList || extensionInfo.projectList.length === 0) {
							extensionInfo.projectList = [
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
							];
						}

						panel.webview.postMessage({ command: 'extensionInfo', data: extensionInfo });
						return;

					case 'createProject':
						if (message.args && message.args.length > 0) {
							const project = message.args[0];

							// 调用创建工程的API - 参数顺序: folder, projectInfo
							createProject(project.folder, project);
						}
						return;

					case 'browseProjectFolder':
						const defaultPath = message.args && message.args.length > 0 ? message.args[0] : undefined;
						vscode.window.showOpenDialog({
							canSelectFolders: true,
							canSelectFiles: false,
							canSelectMany: false,
							defaultUri: defaultPath ? vscode.Uri.file(defaultPath) : undefined,
							openLabel: '选择文件夹'
						}).then(result => {
							if (result && result.length > 0) {
								const selectedPath = result[0].fsPath;
								panel.webview.postMessage({ command: 'setProjectFolder', data: selectedPath });
							}
						});
						return;
				}
			},
			undefined,
			context.subscriptions
		);

		// 当webview被关闭时，重置panel引用
		panel.onDidDispose(() => {
			createProjectViewPanel = null;
		}, null, context.subscriptions);
	}

	postMessageExtensionData(context, createProjectViewPanel);
}

export function isCreateProjectWebviewActive(): boolean {
	return createProjectViewPanel !== null;
}

export function disposeCreateProjectWebview() {
	if (createProjectViewPanel) {
		createProjectViewPanel.dispose();
		createProjectViewPanel = null;
	}
}
