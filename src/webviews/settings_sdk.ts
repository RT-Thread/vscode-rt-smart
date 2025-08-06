import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// SDK版本信息接口
interface SDKVersion {
    version: string;
    URL: string;
}

// SDK包信息接口
interface SDKPackage {
    name: string;
    description: string;
    site: SDKVersion[];
}

// SDK配置信息接口
interface SDKConfig {
    name: string;
    installed: boolean;
    installedVersion?: string;
    path?: string;
}

// SDK列表项接口
interface SDKListItem {
    name: string;
    description: string;
    versions: string[];
    installedVersion?: string;
    installed: boolean;
    path?: string;
}

// 获取SDK目录路径
function getSDKDirectory(): string {
    const envPath = path.join(os.homedir(), '.env', 'packages', 'sdk');
    const platform = os.platform();
    
    if (platform === 'linux') {
        return path.join(envPath, 'Linux');
    } else if (platform === 'win32') {
        return path.join(envPath, 'Windows');
    }
    
    return envPath;
}

// 获取配置文件路径
function getConfigPath(): string {
    return path.join(os.homedir(), '.env', 'tools', 'scripts', '.config');
}

// 读取SDK包信息
async function readSDKPackage(sdkPath: string): Promise<SDKPackage | null> {
    try {
        const packageJsonPath = path.join(sdkPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            return null;
        }
        
        const content = fs.readFileSync(packageJsonPath, 'utf8');
        const packageData = JSON.parse(content);
        
        return {
            name: packageData.name || path.basename(sdkPath),
            description: packageData.description || '',
            site: packageData.site || []
        };
    } catch (error) {
        console.error(`Failed to read package.json from ${sdkPath}:`, error);
        return null;
    }
}

// 读取.config文件中的SDK配置
function readSDKConfigs(): Map<string, SDKConfig> {
    const configs = new Map<string, SDKConfig>();
    const configPath = getConfigPath();
    
    if (!fs.existsSync(configPath)) {
        return configs;
    }
    
    try {
        const content = fs.readFileSync(configPath, 'utf8');
        const lines = content.split('\n');
        
        // 解析配置文件
        const configData: { [key: string]: string } = {};
        for (const line of lines) {
            const match = line.match(/^(CONFIG_[A-Z0-9_]+)=(.*)$/);
            if (match) {
                const key = match[1];
                const value = match[2].replace(/^"(.*)"$/, '$1'); // 去除引号
                configData[key] = value;
            }
        }
        
        // 查找所有已安装的SDK
        for (const key in configData) {
            if (key.startsWith('CONFIG_PKG_USING_') && configData[key] === 'y') {
                const upperName = key.substring('CONFIG_PKG_USING_'.length);
                // 将下划线转换回连字符，并转为小写
                const sdkName = upperName.replace(/_/g, '-').toLowerCase();
                
                const config: SDKConfig = {
                    name: sdkName,
                    installed: true
                };
                
                // 获取版本
                const versionKey = `CONFIG_PKG_${upperName}_VER`;
                if (configData[versionKey]) {
                    config.installedVersion = configData[versionKey];
                }
                
                // 获取路径
                const pathKey = `CONFIG_PKG_${upperName}_PATH`;
                if (configData[pathKey]) {
                    config.path = configData[pathKey];
                }
                
                configs.set(sdkName, config);
            }
        }
    } catch (error) {
        console.error('Failed to read .config file:', error);
    }
    
    return configs;
}

// 获取SDK列表
export async function getSDKList(): Promise<SDKListItem[]> {
    const sdkDir = getSDKDirectory();
    const sdkList: SDKListItem[] = [];
    
    if (!fs.existsSync(sdkDir)) {
        console.warn(`SDK directory not found: ${sdkDir}`);
        return sdkList;
    }
    
    // 读取已安装的SDK配置
    const installedConfigs = readSDKConfigs();
    
    // 扫描SDK目录
    const sdkDirs = fs.readdirSync(sdkDir).filter(name => {
        const fullPath = path.join(sdkDir, name);
        return fs.statSync(fullPath).isDirectory();
    });
    
    for (const sdkName of sdkDirs) {
        const sdkPath = path.join(sdkDir, sdkName);
        const packageInfo = await readSDKPackage(sdkPath);
        
        if (packageInfo) {
            const config = installedConfigs.get(sdkName.toLowerCase());
            const versions = packageInfo.site.map(s => s.version);
            
            sdkList.push({
                name: sdkName,
                description: packageInfo.description,
                versions: versions,
                installed: config?.installed || false,
                installedVersion: config?.installedVersion,
                path: config?.path
            });
        }
    }
    
    return sdkList;
}

// 更新.config文件
export async function updateSDKConfig(configs: Array<{ name: string; version: string; install: boolean }>): Promise<void> {
    const configPath = getConfigPath();
    let content = '';
    
    // 读取现有配置
    if (fs.existsSync(configPath)) {
        content = fs.readFileSync(configPath, 'utf8');
    } else {
        // 创建默认配置头
        content = 'CONFIG_TARGET_FILE=""\n';
    }
    
    // 更新配置
    for (const config of configs) {
        const upperName = config.name.replace(/-/g, '_').toUpperCase();
        const usingKey = `CONFIG_PKG_USING_${upperName}`;
        const versionKey = `CONFIG_PKG_${upperName}_VER`;
        const pathKey = `CONFIG_PKG_${upperName}_PATH`;
        
        if (config.install) {
            // 添加或更新配置
            content = updateConfigLine(content, usingKey, 'y');
            content = updateConfigLine(content, versionKey, `"${config.version}"`);
            
            // 设置默认路径（可以根据实际需求调整）
            const defaultPath = path.join(os.homedir(), '.env', 'tools', config.name);
            content = updateConfigLine(content, pathKey, `"${defaultPath}"`);
        } else {
            // 移除配置
            content = removeConfigLine(content, usingKey);
            content = removeConfigLine(content, versionKey);
            content = removeConfigLine(content, pathKey);
        }
    }
    
    // 确保目录存在
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    
    // 写入配置文件
    fs.writeFileSync(configPath, content, 'utf8');
}

// 更新配置行
function updateConfigLine(content: string, key: string, value: string): string {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;
    
    if (regex.test(content)) {
        // 更新现有行
        return content.replace(regex, newLine);
    } else {
        // 添加新行
        return content + '\n' + newLine;
    }
}

// 移除配置行
function removeConfigLine(content: string, key: string): string {
    const regex = new RegExp(`^${key}=.*$\\n?`, 'gm');
    return content.replace(regex, '');
}

// 处理SDK相关消息
export function handleSDKMessage(webview: vscode.Webview, message: any): boolean {
    switch (message.command) {
        case 'getSDKList':
            getSDKList().then(sdkList => {
                webview.postMessage({
                    command: 'setSDKList',
                    data: sdkList
                });
            }).catch(error => {
                console.error('Failed to get SDK list:', error);
                webview.postMessage({
                    command: 'sdkConfigError',
                    error: '获取SDK列表失败'
                });
            });
            return true;
            
        case 'applySDKConfig':
            if (message.data && Array.isArray(message.data)) {
                updateSDKConfig(message.data).then(() => {
                    webview.postMessage({
                        command: 'sdkConfigApplied'
                    });
                    
                    // TODO: 触发实际的SDK安装/卸载操作
                    // 这里可以调用env工具的相关命令
                    
                }).catch(error => {
                    console.error('Failed to update SDK config:', error);
                    webview.postMessage({
                        command: 'sdkConfigError',
                        error: '更新SDK配置失败'
                    });
                });
            }
            return true;
    }
    
    return false;
}