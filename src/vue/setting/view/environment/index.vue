<template>
    <div class="content">
        <section class="env-status-box">
            <div class="status-header">
                <div class="info-content">
                    <h2>RT-Thread Env</h2>
                    <el-tag :type="envInfo.envStatus.installed ? 'success' : 'info'" size="small">
                        {{ envInfo.envStatus.installed ? '已安装' : '未安装' }}
                    </el-tag>
                    <dl class="info-text">
                        <dt>安装路径</dt><dd>{{ envInfo.envStatus.path }}</dd>
                        <template v-if="envInfo.envStatus.installed">
                            <dt>版本</dt><dd>{{ envInfo.envStatus.envVersion || 'Unknown' }}</dd>
                        </template>
                        <template v-if="envInfo.envStatus.envGitRev">
                            <dt>修订</dt><dd>{{ envInfo.envStatus.envGitRev }}</dd>
                        </template>
                    </dl>
                </div>
                <div class="env-actions">
                    <el-button v-if="!envInfo.envStatus.installed" type="primary" :icon="Download"
                        :loading="operation === 'install'" :disabled="isOperating" @click="startOperation('install')">
                        安装 Env
                    </el-button>
                    <template v-else>
                        <el-button type="primary" :icon="Refresh" :loading="operation === 'update'"
                            :disabled="isOperating" @click="startOperation('update')">更新 Env</el-button>
                        <el-button type="danger" plain :icon="Delete" :loading="operation === 'delete'"
                            :disabled="isOperating" @click="deleteEnv">删除 Env</el-button>
                    </template>
                </div>
            </div>
            <div v-if="showProgressLog" class="progress-box">
                <div class="log-header">
                    <h3>{{ operationLabel || '执行日志' }}</h3>
                    <el-button v-if="showForceCloseButton" type="danger" plain :icon="CircleClose"
                        @click="forceCloseOperation">强制关闭</el-button>
                    <el-tooltip v-else-if="!isOperating" content="关闭日志">
                        <el-button :icon="Close" aria-label="关闭日志" @click="showProgressLog = false" />
                    </el-tooltip>
                </div>
                <div class="terminal-container">
                    <XTerminal ref="terminalRef" :rows="20" :font-size="13" @ready="flushProgress" />
                </div>
            </div>
        </section>

        <section class="rt-config-box">
            <div class="config-header">
                <h2>RT-Thread 根目录配置</h2>
                <el-tooltip content="编辑根目录">
                    <el-button :icon="Edit" aria-label="编辑根目录" @click="editRootConfig" />
                </el-tooltip>
            </div>
            <dl class="info-text">
                <dt>路径</dt><dd>{{ envInfo.rtConfig.path || '(未设置)' }}</dd>
                <dt>描述</dt><dd>{{ envInfo.rtConfig.description }}</dd>
            </dl>
        </section>

        <el-dialog v-model="rootConfigDialogVisible" width="min(630px, calc(100% - 32px))"
            title="RT-Thread 根目录配置" :close-on-click-modal="false">
            <el-form :model="rootConfig" label-width="60px">
                <el-form-item label="路径">
                    <div class="folder-input">
                        <el-input v-model="rootConfig.path" placeholder="RT-Thread 根目录路径" />
                        <el-tooltip content="选择文件夹">
                            <el-button :icon="FolderOpened" aria-label="选择文件夹"
                                @click="sendCommandData('browseItemFolder', rootConfig.path)" />
                        </el-tooltip>
                    </div>
                </el-form-item>
                <el-form-item label="描述">
                    <el-input v-model="rootConfig.description" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button :disabled="isSavingConfig" @click="rootConfigDialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="isSavingConfig" @click="saveRootConfig">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue';
import { ElMessageBox } from 'element-plus';
import { Download, Refresh, Delete, Edit, FolderOpened, Close, CircleClose } from '@element-plus/icons-vue';
import { envInfo, type RootConfig } from '../../data';
import { sendCommand, sendCommandData } from '../../../api/vscode';
import XTerminal from '../../../components/XTerminal.vue';

type Operation = 'install' | 'update' | 'delete';
const operation = ref<Operation>();
const isOperating = computed(() => operation.value !== undefined);
const operationLabel = computed(() => operation.value && {
    install: '正在安装 Env', update: '正在更新 Env', delete: '正在删除 Env',
}[operation.value]);
const showProgressLog = ref(false);
const showForceCloseButton = ref(false);
const terminalRef = ref<InstanceType<typeof XTerminal>>();
const pendingProgress: Array<{ type: string; message: string }> = [];
let forceCloseTimer: ReturnType<typeof setTimeout> | undefined;

const rootConfigDialogVisible = ref(false);
const rootConfig = ref<RootConfig>({ ...envInfo.value.rtConfig });
const isSavingConfig = ref(false);

function clearForceCloseTimer() {
    if (forceCloseTimer) {
        clearTimeout(forceCloseTimer);
        forceCloseTimer = undefined;
    }
    showForceCloseButton.value = false;
}

function writeProgress(type: string, message: string) {
    if (!terminalRef.value?.getTerminal()) {
        pendingProgress.push({ type, message });
        return;
    }
    const colors: Record<string, string> = { success: '32', error: '31', warning: '33', info: '37' };
    const timestamp = new Date().toLocaleTimeString();
    terminalRef.value.writeln(`\x1b[36m[${timestamp}]\x1b[0m \x1b[${colors[type] || '37'}m${message}\x1b[0m`);
}

function flushProgress() {
    for (const entry of pendingProgress.splice(0)) {
        writeProgress(entry.type, entry.message);
    }
}

async function startOperation(value: Operation) {
    if (isOperating.value) {
        return;
    }
    operation.value = value;
    showProgressLog.value = true;
    clearForceCloseTimer();
    forceCloseTimer = setTimeout(() => {
        showForceCloseButton.value = isOperating.value;
    }, 60000);
    await nextTick();
    sendCommand(`${value}Env`);
}

async function deleteEnv() {
    try {
        await ElMessageBox.confirm('确定删除 RT-Thread Env 吗？此操作不可恢复。', '删除 Env', {
            confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
        });
    } catch {
        return;
    }
    await startOperation('delete');
}

function forceCloseOperation() {
    sendCommand('forceCloseEnvOperation');
    operation.value = undefined;
    clearForceCloseTimer();
    sendCommand('checkEnvStatus');
}

function editRootConfig() {
    rootConfig.value = { ...envInfo.value.rtConfig };
    rootConfigDialogVisible.value = true;
}

function saveRootConfig() {
    isSavingConfig.value = true;
    sendCommand('setConfig', [[{ ...rootConfig.value }]]);
}

function applyConfig(configs: RootConfig[]) {
    const config = configs.find(item => item.name === 'RT-Thread');
    envInfo.value.rtConfig = {
        name: 'RT-Thread', path: config?.path || '', description: config?.description || 'RT-Thread 主干版本',
    };
}

function handleMessage(event: MessageEvent) {
    const message = event.data;
    switch (message.command) {
        case 'extensionInfo':
            applyConfig(message.data.configInfo || []);
            break;
        case 'envStatus':
            envInfo.value.envStatus = message.status;
            break;
        case 'installProgress':
            showProgressLog.value = true;
            writeProgress(message.type, message.message);
            if (message.type === 'success' || message.type === 'error') {
                operation.value = undefined;
                clearForceCloseTimer();
                sendCommand('checkEnvStatus');
            }
            break;
        case 'clearProgress':
            pendingProgress.length = 0;
            terminalRef.value?.reset();
            break;
        case 'setItemFolder':
            rootConfig.value.path = message.data;
            break;
        case 'setConfig':
            applyConfig(message.data);
            if (isSavingConfig.value) {
                isSavingConfig.value = false;
                rootConfigDialogVisible.value = false;
            }
            break;
        case 'configSaveFailed':
            isSavingConfig.value = false;
            break;
    }
}

onMounted(() => {
    window.addEventListener('message', handleMessage);
    sendCommand('getExtensionInfo');
    sendCommand('checkEnvStatus');
});

onUnmounted(() => {
    clearForceCloseTimer();
    window.removeEventListener('message', handleMessage);
});
</script>

<style scoped lang="less">
@import './index.less';
</style>
