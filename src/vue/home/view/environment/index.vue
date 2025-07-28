<template>
    <div class="content">
        <div class="body-box">
            <!-- RT-Thread 根目录配置区域 -->
            <div class="rt-config-box">
                <div class="config-card">
                    <div class="card-header">
                        <h3 class="card-title">RT-Thread 根目录配置</h3>
                        <el-button type="primary" plain @click="editRtThreadConfig">编辑</el-button>
                    </div>
                    <div class="config-content">
                        <div class="config-item">
                            <label>名称：</label>
                            <span>RT-Thread</span>
                        </div>
                        <div class="config-item">
                            <label>路径：</label>
                            <span>{{ envInfo.rtThreadConfig.path || '(未设置)' }}</span>
                        </div>
                        <div class="config-item">
                            <label>描述：</label>
                            <span>RT-Thread 主干版本</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Env 安装状态区域 -->
            <div class="env-status-box">
                <div class="info-box">
                    <div class="info-left">
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
                                    修订: {{ envInfo.envStatus.envGitRev.substring(0, 8) }}
                                </li>
                            </ul>
                        </div>
                        <div class="progress-box" v-if="envInfo.isInstalling">
                            <p class="progress-status">{{ envInfo.envStatus.installed ? '更新中...' : '安装中...' }}</p>
                            <div class="progress-log" v-if="envInfo.installProgress.length > 0">
                                <div class="log-title">执行日志：</div>
                                <div class="log-content">
                                    <div v-for="(msg, index) in envInfo.installProgress" :key="index" class="log-message">
                                        {{ msg }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
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
                        <el-input disabled v-model="envInfo.editRtConfig.description" placeholder="RT-Thread 主干版本" />
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
import { ref, onMounted } from "vue";
import { envInfo } from "../../data";
import { sendCommand, sendCommandData } from "../../../api/vscode"
import { ElMessageBox } from 'element-plus';

const installButtonDisabled = ref(true);

// Env 安装状态检查
const checkEnvStatus = () => {
    sendCommand("checkEnvStatus");
};

// 安装 Env
const installEnvFunction = () => {
    // 设置安装状态
    envInfo.value.isInstalling = true;
    
    sendCommand("installEnv");
};

// 更新 Env
const updateEnvFunction = () => {
    // 设置更新状态
    envInfo.value.isInstalling = true;
    
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
        
        // 设置删除状态
        envInfo.value.isInstalling = true;
        
        sendCommand("deleteEnv");
    } catch (error) {
        // 用户取消，无需操作
        console.log('用户取消删除操作', error);
    }
};

// 添加进度消息
const addProgressMessage = (type: string, message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    envInfo.value.installProgress.push(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
};

// 清除日志的辅助函数
const clearProgressLog = () => {
    envInfo.value.installProgress = [];
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
                // 如果这是操作完成的消息，直接添加
                addProgressMessage(message.type, message.message);
                if (message.type === 'success' || message.type === 'error') {
                    envInfo.value.isInstalling = false;
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
                    envInfo.value.rtThreadConfig.path = message.data[0].path || '';
                }
                break;
        }
    });
});

// RT-Thread 根目录配置相关函数
const editRtThreadConfig = () => {
    envInfo.value.editRtConfig = {
        name: "RT-Thread",
        path: envInfo.value.rtThreadConfig.path,
        description: "RT-Thread 主干版本"
    };
    envInfo.value.rtConfigDialogVisible = true;
};

const browseRtThreadFolder = () => {
    sendCommandData("browseItemFolder", envInfo.value.editRtConfig.path || {});
};

const confirmRtConfig = () => {
    envInfo.value.rtThreadConfig.path = envInfo.value.editRtConfig.path;
    
    let configItem = {
        name: envInfo.value.editRtConfig.name,
        path: envInfo.value.editRtConfig.path,
        description: envInfo.value.editRtConfig.description
    };
    
    sendCommand("setConfig", [[configItem]]);
    envInfo.value.rtConfigDialogVisible = false;
};

</script>
<style scoped>
@import "./index.less";
</style>
