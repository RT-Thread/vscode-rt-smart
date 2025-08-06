import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';

// Env 相关函数
export async function checkEnvStatus(): Promise<{ installed: boolean; path: string; envVersion?: string; envGitRev?: string }> {
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

export async function installEnvFunction(webview: vscode.Webview) {
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

export async function updateEnvFunction(webview: vscode.Webview) {
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

export async function deleteEnvFunction(webview: vscode.Webview) {
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

// 处理 Env 相关消息
export function handleEnvMessage(webview: vscode.Webview, message: any): boolean {
    switch (message.command) {
        case 'checkEnvStatus':
            checkEnvStatus().then(envStatus => {
                webview.postMessage({ command: 'envStatus', status: envStatus });
            });
            return true;
        case 'installEnv':
            installEnvFunction(webview);
            return true;
        case 'updateEnv':
            updateEnvFunction(webview);
            return true;
        case 'deleteEnv':
            deleteEnvFunction(webview);
            return true;
    }
    return false;
}