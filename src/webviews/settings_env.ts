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
            message: 'Env 已安装在 ' + envPath 
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
            message: `安装失败: ${error}` 
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
            message: 'Env 已安装在 ' + envPath 
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
        // Show info message
        webview.postMessage({ 
        command: 'installProgress', 
        type: 'info', 
        message: '开始安装 RT-Thread Env...' 
        });

        try {
            // Step 1: Download installation script
            webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: '步骤 1: 正在下载安装脚本...' 
            });
            await executeCommand(
                `powershell -Command wget "${installScriptUrl}" -O install_windows.ps1`,
                webview
            );

            // Step 2: Set execution policy
            webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: '步骤 2: 正在设置执行策略...' 
            });
            await executeCommand(
                'powershell -Command Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force',
                webview
            );

            // Step 3: Run installation script
            webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: '步骤 3: 正在运行安装脚本（自动模式）...' 
            });
            await executeCommand(
                `powershell -Command .\\install_windows.ps1 ${giteeArg} -y`,
                webview
            );

            // Step 4: Activate virtual environment
            webview.postMessage({ 
            command: 'installProgress', 
            type: 'info', 
            message: '步骤 4: 正在激活虚拟环境...' 
            });
            await executeCommand(
                `powershell -Command ~\\.env\\env.ps1`,
                webview
            );

            // Step 5: Clean up installation script
            webview.postMessage({ 
                command: 'installProgress', 
                type: 'info', 
                message: '步骤 5: 正在清理安装脚本...' 
            });
            await executeCommand(`powershell -Command del .\\install_windows.ps1`, webview);

            webview.postMessage({ 
                command: 'installProgress', 
                type: 'success', 
                message: 'RT-Thread Env 安装成功完成！' 
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            // vscode.window.showErrorMessage(`RT-Thread Env installation failed: ${errorMessage}`);

            webview.postMessage({ 
                command: 'installProgress', 
                type: 'error', 
                message: `RT-Thread Env 安装失败: ${errorMessage}` 
            });
        }

        const envStatus = await checkEnvStatus();
        webview.postMessage({ command: 'envStatus', status: envStatus });
    } catch (error) {
        webview.postMessage({ 
            command: 'installProgress', 
            type: 'error', 
            message: `安装失败: ${error}` 
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

        webview.postMessage({ command: 'installProgress', type: 'info', message: command });
        proc.stdout.on('data', (data: Buffer) => {
            webview.postMessage({ command: 'installProgress', type: 'info', message: data.toString() });
        });
        proc.stderr.on('data', (data: Buffer) => {
            const msg = data.toString();
            webview.postMessage({ command: 'installProgress', type: 'warning', message: msg });
        });
        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                webview.postMessage({ command: 'installProgress', type: 'error', message: `命令执行失败，退出代码 ${code}` });
                reject(new Error(`Command exited with code ${code}`));
            }
        });
        proc.on('error', (err) => {
            webview.postMessage({ command: 'installProgress', type: 'error', message: `命令执行失败: ${err.message}` });
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