import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
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

// Env 相关函数
async function checkEnvStatus(): Promise<{ installed: boolean; path: string; envVersion?: string; envGitRev?: string }> {
    const homeDir = os.homedir();
    const envPath = path.join(homeDir, '.env');
    const installed = fs.existsSync(envPath);
    let envVersion: string | undefined = undefined;
    let envGitRev: string | undefined = undefined;
    if (installed) {
        // 读取env.json
        try {
            const envJsonPath = path.join(envPath, 'tools', 'scripts', 'env.json');
            if (fs.existsSync(envJsonPath)) {
                const envJson = JSON.parse(fs.readFileSync(envJsonPath, 'utf-8'));
                envVersion = envJson.version;
            }
        } catch {}
        // 获取git修订
        try {
            const { spawnSync } = require('child_process');
            const result = spawnSync('git', ['-C', path.join(envPath, 'tools', 'scripts'), 'rev-parse', 'HEAD']);
            if (result.status === 0 && result.stdout) {
                envGitRev = result.stdout.toString().trim();
            }
        } catch {}
    }
    return { installed, path: envPath, envVersion, envGitRev };
}

async function installEnvFunction(webview: vscode.Webview) {
    // 清除之前的进度日志
    webview.postMessage({ command: 'clearProgress' });
    
    const platform = process.platform;
    if (platform === 'win32') {
        await installWindowsEnv(webview);
    } else {
        await installLinuxEnv(webview);
    }
}

async function installLinuxEnv(webview: vscode.Webview) {
    const homeDir = os.homedir();
    const envPath = path.join(homeDir, '.env');

    if (fs.existsSync(envPath)) {
        webview.postMessage({ 
            command: 'installProgress', 
            type: 'error', 
            message: 'Env already installed at ' + envPath 
        });
        return;
    }

    // 判断地理位置
    const location = await getLocation();
    const giteeArg = location === 'CN' ? ' --gitee' : '';
    const installScriptUrl = location === 'CN'
        ? 'https://gitee.com/RT-Thread-Mirror/env/raw/master/install_ubuntu.sh'
        : 'https://raw.githubusercontent.com/RT-Thread/env/master/install_ubuntu.sh';
    const scriptPath = path.join(os.tmpdir(), 'install_ubuntu.sh');

    try {
        webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: '正在下载安装脚本...' 
        });
        await executeCommand(`wget "${installScriptUrl}" -O "${scriptPath}"`, webview);

        webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: '赋予安装脚本执行权限...' 
        });
        await executeCommand(`chmod 777 "${scriptPath}"`, webview);

        webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: `正在执行安装脚本${giteeArg ? '（--gitee）' : ''}...` 
        });
        await executeCommand(`${scriptPath}${giteeArg}`, webview);

        webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: '清理安装脚本...' 
        });
        await executeCommand(`rm "${scriptPath}"`, webview);

        webview.postMessage({ 
            command: 'installProgress', 
            type: 'success', 
            message: 'RT-Thread Env 安装成功！' 
        });

        const envStatus = await checkEnvStatus();
        webview.postMessage({ command: 'envStatus', status: envStatus });

    } catch (error) {
        webview.postMessage({ 
            command: 'installProgress', 
            type: 'error', 
            message: `Installation failed: ${error}` 
        });
    }
}

async function installWindowsEnv(webview: vscode.Webview) {
    const homeDir = os.homedir();
    const envPath = path.join(homeDir, '.env');

    if (fs.existsSync(envPath)) {
        webview.postMessage({ 
            command: 'installProgress', 
            type: 'error', 
            message: 'Env already installed at ' + envPath 
        });
        return;
    }

    // 判断地理位置
    const location = await getLocation();
    const giteeArg = location === 'CN' ? ' --gitee' : '';
    const installScriptUrl = location === 'CN'
        ? 'https://gitee.com/RT-Thread-Mirror/env/raw/master/install_windows.ps1'
        : 'https://raw.githubusercontent.com/RT-Thread/env/master/install_windows.ps1';
    const scriptPath = path.join(os.tmpdir(), 'install_windows.ps1');

    try {
        webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: '正在下载安装脚本...' 
        });
        await executeCommand(`wget "${installScriptUrl}" -O "${scriptPath}"`, webview);

        webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: '设置 PowerShell 执行策略...' 
        });
        await executeCommand(`powershell -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"`, webview);

        webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: `正在执行安装脚本${giteeArg ? '（--gitee）' : ''}...` 
        });
        await executeCommand(`powershell -ExecutionPolicy RemoteSigned -File "${scriptPath}"${giteeArg}`, webview);

        webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: '清理安装脚本...' 
        });
        await executeCommand(`del "${scriptPath}"`, webview);

        webview.postMessage({ 
            command: 'installProgress', 
            type: 'success', 
            message: 'RT-Thread Env 安装成功！' 
        });

        const envStatus = await checkEnvStatus();
        webview.postMessage({ command: 'envStatus', status: envStatus });

    } catch (error) {
        webview.postMessage({ 
            command: 'installProgress', 
            type: 'error', 
            message: `Installation failed: ${error}` 
        });
    }
}

async function updateEnvFunction(webview: vscode.Webview) {
    // 清除之前的进度日志
    webview.postMessage({ command: 'clearProgress' });
    
    const homeDir = os.homedir();
    const scriptsDir = path.join(homeDir, '.env', 'tools', 'scripts');
    const packagesDir = path.join(homeDir, '.env', 'packages', 'packages');
    const sdkDir = path.join(homeDir, '.env', 'packages', 'sdk');
    try {
        webview.postMessage({ command: 'installProgress', type: 'info', message: '正在更新 ~/.env/tools/scripts ...' });
        await executeCommand('git pull origin', webview, scriptsDir);
        webview.postMessage({ command: 'installProgress', type: 'info', message: '正在更新 ~/.env/packages/packages ...' });
        await executeCommand('git pull origin', webview, packagesDir);
        webview.postMessage({ command: 'installProgress', type: 'info', message: '正在更新 ~/.env/packages/sdk ...' });
        await executeCommand('git pull origin', webview, sdkDir);
        webview.postMessage({ command: 'installProgress', type: 'success', message: 'Env 更新完成！' });
    } catch (error) {
        webview.postMessage({ command: 'installProgress', type: 'error', message: `Env 更新失败: ${error}` });
    }
}

async function deleteEnvFunction(webview: vscode.Webview) {
    // 清除之前的进度日志
    webview.postMessage({ command: 'clearProgress' });
    
    const homeDir = os.homedir();
    const envPath = path.join(homeDir, '.env');
    
    // 检查路径是否存在
    if (!fs.existsSync(envPath)) {
        webview.postMessage({ command: 'installProgress', type: 'warning', message: 'Env 目录不存在，无需删除。' });
        const envStatus = await checkEnvStatus();
        webview.postMessage({ command: 'envStatus', status: envStatus });
        return;
    }
    
    try {
        webview.postMessage({ command: 'installProgress', type: 'info', message: '正在删除 ~/.env ...' });
        await deleteDirRecursive(envPath);
        webview.postMessage({ command: 'installProgress', type: 'success', message: 'Env 已成功删除。' });
        
        // 重新检查状态
        const envStatus = await checkEnvStatus();
        webview.postMessage({ command: 'envStatus', status: envStatus });
    } catch (error) {
        webview.postMessage({ command: 'installProgress', type: 'error', message: `删除失败: ${error}` });
    }
}

async function deleteDirRecursive(dirPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.rm(dirPath, { recursive: true, force: true }, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function executeCommand(command: string, webview: vscode.Webview, cwd?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        const proc = spawn(cmd, args, { shell: true, cwd });
        proc.stdout.on('data', (data) => {
            webview.postMessage({ command: 'installProgress', type: 'info', message: data.toString() });
        });
        proc.stderr.on('data', (data) => {
            webview.postMessage({ command: 'installProgress', type: 'warning', message: data.toString() });
        });
        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                webview.postMessage({ command: 'installProgress', type: 'error', message: `Command exited with code ${code}` });
                reject(new Error(`Command exited with code ${code}`));
            }
        });
        proc.on('error', (err) => {
            webview.postMessage({ command: 'installProgress', type: 'error', message: `Command failed: ${err.message}` });
            reject(err);
        });
    });
}

async function getLocation(): Promise<'CN' | 'GLOBAL'> {
    // 使用ipinfo.io等公共API判断IP归属地
    try {
        const https = require('https');
        return await new Promise((resolve) => {
            https.get('https://ipinfo.io/json', (resp: any) => {
                let data = '';
                resp.on('data', (chunk: any) => { data += chunk; });
                resp.on('end', () => {
                    try {
                        const info = JSON.parse(data);
                        if (info && info.country === 'CN') {
                            resolve('CN');
                        } else {
                            resolve('GLOBAL');
                        }
                    } catch {
                        resolve('GLOBAL');
                    }
                });
            }).on('error', () => {
                resolve('GLOBAL');
            });
        });
    } catch {
        return 'GLOBAL';
    }
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

                // Env 相关命令处理
                case 'checkEnvStatus':
                    const envStatus = await checkEnvStatus();
                    panel.webview.postMessage({ command: 'envStatus', status: envStatus });
                    return;
                case 'installEnv':
                    await installEnvFunction(panel.webview);
                    return;
                case 'updateEnv':
                    await updateEnvFunction(panel.webview);
                    return;
                case 'deleteEnv':
                    await deleteEnvFunction(panel.webview);
                    return;
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
