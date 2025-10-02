<template>
    <div class="content">
        <div class="body-box">
            <!-- RT-Thread 根目录配置区域 -->
            <div class="rt-config-box">
                <div class="config-card">
                    <div class="card-header">
                        <h3 class="card-title">RT-Thread 根目录配置</h3>
                        <el-button type="primary" plain @click="editRtConfig">编辑</el-button>
                    </div>
                    <div class="config-content">
                        <div class="config-item">
                            <label>名称：</label>
                            <span>RT-Thread</span>
                        </div>
                        <div class="config-item">
                            <label>路径：</label>
                            <span>{{ envInfo.rtConfig.path || '(未设置)' }}</span>
                        </div>
                        <div class="config-item">
                            <label>描述：</label>
                            <span>{{ envInfo.rtConfig.description || 'RT-Thread 主干版本' }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Env 安装状态区域 -->
            <div class="env-status-box">
                <div class="status-header">
                    <div class="info-content">
                        <p class="status-title">RT-Thread Env 状态：</p>
                        <ul class="info-text">
                            <li v-if="envInfo.envStatus.installed" style="color: #67c23a;">
                                ✅ 已安装 - 版本 {{ envInfo.envStatus.envVersion || 'Unknown' }}
                            </li>
                            <li v-else style="color: #e6a23c;">
                                ❌ 未安装
                            </li>
                            <li>安装路径: {{ envInfo.envStatus.path }}</li>
                            <li v-if="envInfo.envStatus.envGitRev">
                                修订: {{ envInfo.envStatus.envGitRev }}
                            </li>
                        </ul>
                    </div>

                    <!-- Env 操作按钮区域 -->
                    <div class="env-actions">
                        <el-button 
                            v-if="!envInfo.envStatus.installed" 
                            type="primary" 
                            :loading="envInfo.isInstalling"
                            @click="installEnvFunction">
                            {{ envInfo.isInstalling ? '安装中...' : '安装 Env' }}
                        </el-button>
                        <template v-else>
                            <el-button 
                                type="primary" 
                                plain 
                                :disabled="envInfo.isInstalling"
                                @click="updateEnvFunction">
                                更新 Env
                            </el-button>
                            <el-button 
                                type="danger" 
                                plain 
                                :disabled="envInfo.isInstalling"
                                @click="deleteEnvFunction">
                                删除 Env
                            </el-button>
                        </template>
                    </div>
                </div>

                <!-- 安装进度日志区域 -->
                <div class="progress-box" v-if="envInfo.isInstalling || envInfo.showProgressLog">
                    <p class="progress-status" v-if="envInfo.isInstalling">{{ envInfo.envStatus.installed ? '更新中...' : '安装中...' }}</p>
                    <div class="progress-log">
                        <div class="log-header">
                            <div class="log-title">执行日志：</div>
                            <div class="log-actions">
                                <el-button 
                                    v-if="envInfo.showForceCloseButton" 
                                    type="danger" 
                                    size="small" 
                                    plain 
                                    @click="forceCloseOperation">
                                    强制关闭
                                </el-button>
                                <el-button 
                                    v-if="!envInfo.isInstalling" 
                                    type="primary" 
                                    size="small" 
                                    plain 
                                    @click="closeProgressLog">
                                    关闭日志
                                </el-button>
                            </div>
                        </div>
                        <div class="terminal-container" v-show="showTerminal">
                            <XTerminal 
                                ref="terminalRef"
                                :rows="20"
                                :fontSize="14"
                                @ready="onTerminalReady"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- RT-Thread 根目录配置对话框 -->
        <el-dialog v-model="envInfo.rtConfigDialogVisible" width="630" title="RT-Thread 根目录配置">
            <div class="form-box">
                <el-form :data="envInfo.editRtConfig" label-width="70">
                    <el-form-item label="名称">
                        <div class="row-box">
                            <el-input disabled v-model="envInfo.editRtConfig.name" placeholder="RT-Thread" />
                        </div>
                    </el-form-item>
                    <el-form-item label="路径">
                        <div class="row-box">
                            <el-input v-model="envInfo.editRtConfig.path" placeholder="请输入RT-Thread根目录路径" />
                            <el-button type="primary" plain @click="browseRtThreadFolder">浏览</el-button>
                        </div>
                    </el-form-item>
                    <el-form-item label="描述">
                        <el-input v-model="envInfo.editRtConfig.description" placeholder="RT-Thread 主干版本" />
                    </el-form-item>
                </el-form>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button type="primary" plain @click="confirmRtConfig">确定</el-button>
                    <el-button type="primary" plain @click="envInfo.rtConfigDialogVisible = false">取消</el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { envInfo } from "../../data";
import { sendCommand, sendCommandData } from "../../../api/vscode"
import { ElMessageBox } from 'element-plus';
import XTerminal from '../../../components/XTerminal.vue';

const installButtonDisabled = ref(true);

// Terminal相关
const terminalRef = ref<InstanceType<typeof XTerminal>>();
const showTerminal = ref(true);

// Terminal ready callback
const onTerminalReady = () => {
    console.log('[DEBUG] Terminal is ready');
};

// 写入终端
const writeToTerminal = (text: string, type: string = 'info') => {
    console.log('[DEBUG] writeToTerminal called - text:', text, 'type:', type);
    if (!terminalRef.value) {
        console.log('[DEBUG] writeToTerminal: terminalRef is null, message discarded');
        return;
    }
    
    const timestamp = new Date().toLocaleTimeString();
    let colorCode = '\x1b[0m'; // 默认颜色
    
    switch (type) {
        case 'success':
            colorCode = '\x1b[1;32m'; // 亮绿色
            break;
        case 'error':
            colorCode = '\x1b[1;31m'; // 亮红色
            break;
        case 'warning':
            colorCode = '\x1b[1;33m'; // 亮黄色
            break;
        case 'info':
        default:
            colorCode = '\x1b[0;37m'; // 白色
            break;
    }
    
    const output = `\x1b[0;36m[${timestamp}]\x1b[0m ${colorCode}${text}\x1b[0m`;
    console.log('[DEBUG] Writing to terminal:', output);
    terminalRef.value.writeln(output);
    console.log('[DEBUG] Message written successfully');
};

// Env 安装状态检查
const checkEnvStatus = () => {
    sendCommand("checkEnvStatus");
};

// 安装 Env
const installEnvFunction = async () => {
    console.log('[DEBUG] installEnvFunction started');
    // 清除之前的日志并设置安装状态
    envInfo.value.installProgress = [];
    envInfo.value.showProgressLog = true;
    envInfo.value.isInstalling = true;
    envInfo.value.showForceCloseButton = false; // 初始时不显示强制关闭按钮
    lastMessage = ''; // 重置上一条消息
    
    // 等待一帧让组件渲染
    await nextTick();
    
    // 清空终端内容
    if (terminalRef.value) {
        terminalRef.value.clear();
        terminalRef.value.writeln('\x1b[1;32m===== RT-Thread Env 安装终端 =====\x1b[0m');
        terminalRef.value.writeln('');
        terminalRef.value.writeln('\x1b[0;36m开始安装 RT-Thread Env...\x1b[0m');
    }
    
    // 设置1分钟后显示强制关闭按钮
    if (forceCloseTimer) {
        clearTimeout(forceCloseTimer);
    }
    
    forceCloseTimer = setTimeout(() => {
        if (envInfo.value.isInstalling) {
            envInfo.value.showForceCloseButton = true;
        }
    }, 60000); // 60秒 = 1分钟
    
    sendCommand("installEnv");
};

// 更新 Env
const updateEnvFunction = async () => {
    // 清除之前的日志并设置更新状态
    envInfo.value.installProgress = [];
    envInfo.value.showProgressLog = true;
    envInfo.value.isInstalling = true;
    envInfo.value.showForceCloseButton = false; // 初始时不显示强制关闭按钮
    lastMessage = ''; // 重置上一条消息
    
    // 等待一帧让组件渲染
    await nextTick();
    
    // 清空终端内容
    if (terminalRef.value) {
        terminalRef.value.clear();
        terminalRef.value.writeln('\x1b[1;32m===== RT-Thread Env 更新终端 =====\x1b[0m');
        terminalRef.value.writeln('');
        terminalRef.value.writeln('\x1b[0;36m开始更新 RT-Thread Env...\x1b[0m');
    }
    
    // 设置1分钟后显示强制关闭按钮
    if (forceCloseTimer) {
        clearTimeout(forceCloseTimer);
    }
    
    forceCloseTimer = setTimeout(() => {
        if (envInfo.value.isInstalling) {
            envInfo.value.showForceCloseButton = true;
        }
    }, 60000); // 60秒 = 1分钟
    
    sendCommand("updateEnv");
};

// 删除 Env
const deleteEnvFunction = async () => {
    try {
        console.log('开始删除确认对话框...');
        
        // 先尝试使用 Element Plus 的 MessageBox
        try {
            await ElMessageBox.confirm(
                '确定要删除 RT-Thread Env 吗？此操作不可恢复！',
                '确认删除',
                {
                    confirmButtonText: '删除',
                    cancelButtonText: '取消',
                    type: 'warning',
                    dangerouslyUseHTMLString: false
                }
            );
        } catch (elementError) {
            // 如果 Element Plus 不可用，使用浏览器的 confirm
            console.log('Element Plus MessageBox 不可用，使用浏览器 confirm', elementError);
            if (!confirm('确定要删除 RT-Thread Env 吗？此操作不可恢复！')) {
                console.log('用户取消删除操作');
                return;
            }
        }
        
        console.log('用户确认删除，开始执行删除操作...');
        
        // 清除之前的日志并设置删除状态
        envInfo.value.installProgress = [];
        envInfo.value.showProgressLog = true;
        envInfo.value.isInstalling = true;
        
        sendCommand("deleteEnv");
    } catch (error) {
        // 用户取消，无需操作
        console.log('用户取消删除操作', error);
    }
};

// 保存上一条消息用于去重
let lastMessage = '';

// 定时器引用 (使用 ReturnType 来兼容不同环境)
let forceCloseTimer: ReturnType<typeof setTimeout> | null = null;

// 添加进度消息（带去重功能）
const addProgressMessage = (type: string, message: string) => {
    console.log('[DEBUG] addProgressMessage called - type:', type, 'message:', message);
    // 检查是否为重复消息
    if (message === lastMessage) {
        console.log('[DEBUG] Duplicate message, skipping');
        return; // 如果与上一条消息相同，跳过
    }
    
    lastMessage = message; // 更新上一条消息
    console.log('[DEBUG] New message, calling writeToTerminal');
    
    // 写入到xterm终端
    writeToTerminal(message, type);
    
    // 仍然保存到数组中以便兼容
    const timestamp = new Date().toLocaleTimeString();
    envInfo.value.installProgress.push(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
};

// 清除日志的辅助函数
const clearProgressLog = () => {
    envInfo.value.installProgress = [];
    envInfo.value.showProgressLog = false;
    envInfo.value.showForceCloseButton = false;
    lastMessage = ''; // 重置上一条消息
    // 清空终端
    if (terminalRef.value) {
        terminalRef.value.clear();
    }
    // 清除定时器
    if (forceCloseTimer) {
        clearTimeout(forceCloseTimer);
        forceCloseTimer = null;
    }
};

// 关闭日志显示
const closeProgressLog = () => {
    envInfo.value.showProgressLog = false;
    // 清空终端
    if (terminalRef.value) {
        terminalRef.value.clear();
    }
};

// 强制关闭操作
const forceCloseOperation = () => {
    // 发送强制关闭命令到后端
    sendCommand("forceCloseEnvOperation");
    
    // 更新状态
    envInfo.value.isInstalling = false;
    envInfo.value.showForceCloseButton = false;
    
    // 添加强制关闭的日志消息
    addProgressMessage('warning', '操作已被用户强制关闭');
    
    // 清除定时器
    if (forceCloseTimer) {
        clearTimeout(forceCloseTimer);
        forceCloseTimer = null;
    }
    
    // 1秒后重新检查状态
    setTimeout(() => {
        checkEnvStatus();
    }, 1000);
};

// 跟踪当前操作状态
let currentOperationId = ref(0);

// 监听来自扩展的消息
onMounted(() => {
    // 初始检查 Env 状态
    checkEnvStatus();
    
    // 获取RT-Thread配置
    sendCommand("getConfig");
    
    // 监听消息（这部分需要在 webview 层面处理）
    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.command) {
            case 'envStatus':
                envInfo.value.envStatus = message.status;
                break;
            case 'installProgress':
                console.log('[DEBUG] Received installProgress message from backend:', message);
                // 如果这是操作完成的消息，直接添加
                addProgressMessage(message.type, message.message);
                if (message.type === 'success' || message.type === 'error') {
                    envInfo.value.isInstalling = false;
                    envInfo.value.showForceCloseButton = false;
                    // 清除定时器
                    if (forceCloseTimer) {
                        clearTimeout(forceCloseTimer);
                        forceCloseTimer = null;
                    }
                    // 操作完成后保持日志显示，让用户可以查看
                    envInfo.value.showProgressLog = true;
                    // 重新检查状态
                    setTimeout(() => {
                        checkEnvStatus();
                    }, 1000);
                }
                break;
            case 'clearProgress':
                // 清除进度日志
                clearProgressLog();
                break;
            case 'setItemFolder':
                // 设置RT-Thread根目录路径
                if (envInfo.value.rtConfigDialogVisible) {
                    envInfo.value.editRtConfig.path = message.data;
                }
                break;
            case 'setConfig':
                // 设置配置数据
                if (message.data && message.data.length > 0) {
                    envInfo.value.rtConfig.path = message.data[0].path || '';
                }
                break;
        }
    });
});

// RT-Thread 根目录配置相关函数
const editRtConfig = () => {
    envInfo.value.editRtConfig = {
        name: "RT-Thread",
        path: envInfo.value.rtConfig.path,
        description: "RT-Thread 主干版本"
    };
    envInfo.value.rtConfigDialogVisible = true;
};

const browseRtThreadFolder = () => {
    sendCommandData("browseItemFolder", envInfo.value.editRtConfig.path || {});
};

const confirmRtConfig = () => {
    envInfo.value.rtConfig.path = envInfo.value.editRtConfig.path;
    
    let configItem = {
        name: envInfo.value.editRtConfig.name,
        path: envInfo.value.editRtConfig.path,
        description: envInfo.value.editRtConfig.description
    };
    
    sendCommand("setConfig", [[configItem]]);
    envInfo.value.rtConfigDialogVisible = false;
};

// 组件卸载时清理
onUnmounted(() => {
    if (forceCloseTimer) {
        clearTimeout(forceCloseTimer);
    }
});

</script>
<style scoped>
@import "./index.less";
</style>
