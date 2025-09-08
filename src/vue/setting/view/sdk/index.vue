<template>
    <div class="sdk-container">
        <div class="sdk-header">
            <h2 class="sdk-title">SDK安装包列表</h2>
            <div class="sdk-actions">
                <el-button type="primary" plain @click="expandAll">
                    {{ isAllExpanded ? '收起所有' : '展开所有' }}
                </el-button>
                <el-button type="primary" @click="applyChanges">应用</el-button>
            </div>
        </div>

        <el-table
            :data="sdkList"
            style="width: 100%"
            row-key="name"
            :expand-row-keys="expandedRows"
            @expand-change="handleExpandChange"
            :default-expand-all="false"
            :tree-props="{ children: 'children' }"
        >
            <!-- 展开列 -->
            <el-table-column type="expand" width="40">
                <template #default="props">
                    <div class="sdk-expand-content">
                        <div class="sdk-versions">
                            <div
                                v-for="version in props.row.versions" 
                                :key="version"
                                class="version-radio-item"
                                @click="handleRadioClick(props.row, version)"
                            >
                                <input 
                                    type="radio"
                                    :name="`sdk-${props.row.name}`"
                                    :checked="props.row.selectedVersion === version"
                                    @click.stop
                                />
                                <label>{{ version }}</label>
                            </div>
                        </div>
                    </div>
                </template>
            </el-table-column>

            <!-- 名称列 -->
            <el-table-column prop="name" label="名称" min-width="200">
                <template #default="scope">
                    <div class="sdk-name">
                        <i 
                            :class="expandedRows.includes(scope.row.name) ? 'el-icon-arrow-down' : 'el-icon-arrow-right'"
                            class="expand-icon"
                        />
                        <span>{{ scope.row.name }}</span>
                    </div>
                </template>
            </el-table-column>

            <!-- 版本选择列 -->
            <el-table-column label="安装状态" min-width="150">
                <template #default="scope">
                    <div class="install-status">
                        <template v-if="scope.row.installed">
                            <el-tag type="success" size="small">已安装</el-tag>
                            <span class="installed-version">{{ scope.row.installedVersion }}</span>
                        </template>
                        <template v-else-if="scope.row.selectedVersion">
                            <el-tag type="warning" size="small">待安装</el-tag>
                            <span class="selected-version">{{ scope.row.selectedVersion }}</span>
                        </template>
                        <template v-else>
                            <el-tag type="info" size="small">未安装</el-tag>
                        </template>
                    </div>
                </template>
            </el-table-column>

            <!-- 描述列 -->
            <el-table-column prop="description" label="描述" min-width="300" />
        </el-table>
        
        <!-- 日志模态窗口 -->
        <el-dialog
            v-model="logDialogVisible"
            width="90%"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :show-close="false"
            :top="'10vh'"
            custom-class="sdk-log-dialog"
        >
            <template #header>
                <div class="log-dialog-header">
                    <span class="dialog-title">更新日志</span>
                    <el-button
                        v-if="showForceClose"
                        type="danger"
                        size="small"
                        @click="forceCloseUpdate"
                    >
                        强制关闭
                    </el-button>
                </div>
            </template>
            <div class="log-container">
                <XTerminal 
                    ref="terminalRef"
                    :fontSize="13"
                    :scrollback="5000"
                    @ready="onTerminalReady"
                />
            </div>
            <template #footer>
                <div class="log-dialog-footer">
                    <el-button
                        v-if="!isUpdating"
                        type="primary"
                        @click="closeLogDialog"
                    >
                        关闭
                    </el-button>
                    <template v-else>
                        <el-tag type="info" class="update-status">
                            <i class="el-icon-loading"></i> 正在更新...
                        </el-tag>
                    </template>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onBeforeUnmount } from 'vue';
import { sendCommand, showMessage } from '../../../api/vscode';
import XTerminal from '../../../components/XTerminal.vue';

// SDK包版本信息接口
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

// SDK列表项接口
interface SDKListItem {
    name: string;
    description: string;
    versions: string[];
    installedVersion?: string;
    selectedVersion?: string;
    installed: boolean;
    path?: string;
}

// SDK列表数据
const sdkList = ref<SDKListItem[]>([]);

// 展开的行
const expandedRows = ref<string[]>([]);
const isAllExpanded = ref(false);

// 日志相关
const logDialogVisible = ref(false);
const logContent = ref('');
const isUpdating = ref(false);
const terminalRef = ref<InstanceType<typeof XTerminal>>();
const showForceClose = ref(false);
let timeoutTimer: NodeJS.Timeout | null = null;
let lastLogTime = 0;
let updateStartTime = 0;

// 处理展开/收起
const handleExpandChange = (row: any, expandedRowsList: any[]) => {
    // 更新展开状态
    const rowNames = expandedRowsList.map(r => r.name);
    expandedRows.value = rowNames;
};

// 展开/收起所有
const expandAll = () => {
    if (isAllExpanded.value) {
        expandedRows.value = [];
    } else {
        expandedRows.value = sdkList.value.map(item => item.name);
    }
    isAllExpanded.value = !isAllExpanded.value;
};

// 处理单选按钮点击
const handleRadioClick = (row: SDKListItem, version: string) => {
    const sdk = sdkList.value.find(s => s.name === row.name);
    if (sdk) {
        // 如果点击的是已选中的版本，则取消选择
        if (sdk.selectedVersion === version) {
            sdk.selectedVersion = '';
        } else {
            // 否则选择新版本
            sdk.selectedVersion = version;
        }
        console.log(`SDK ${row.name} 版本变更为: ${sdk.selectedVersion || '未选择'}`);
    }
};

// 应用更改
const applyChanges = () => {
    console.log('applyChanges called, sdkList:', sdkList.value);
    
    // 检查是否有SDK数据
    if (!sdkList.value || sdkList.value.length === 0) {
        showMessage('没有可用的SDK配置');
        console.error('SDK列表为空');
        return;
    }
    
    // 收集所有SDK的配置信息
    const sdkConfigs = sdkList.value.map(sdk => ({
        name: sdk.name,
        version: sdk.selectedVersion || '',
        selected: !!sdk.selectedVersion,
        path: sdk.path || '',
        versions: sdk.versions || []
    }));
    
    console.log('Sending SDK configs:', sdkConfigs);
    
    // 确保数据是可序列化的（深拷贝）
    const serializedConfigs = JSON.parse(JSON.stringify(sdkConfigs));
    
    // 发送配置到后端保存到.config文件
    sendCommand('saveSDKDotConfig', [serializedConfigs]);
};

// 关闭日志对话框
const closeLogDialog = () => {
    logDialogVisible.value = false;
    logContent.value = '';
    updateStartTime = 0;
    showForceClose.value = false;
    
    // 清理终端
    if (terminalRef.value) {
        terminalRef.value.clear();
    }
    
    // 清理定时器
    if (timeoutTimer) {
        clearInterval(timeoutTimer);
        timeoutTimer = null;
    }
    
    // 重新加载SDK列表
    sendCommand('getSDKList');
};

// Terminal ready callback
const onTerminalReady = () => {
    console.log('SDK Terminal is ready');
};

// 检查超时
const checkTimeout = () => {
    const now = Date.now();
    if (logDialogVisible.value && updateStartTime > 0) {
        // 检查日志窗口显示时间是否超过1分钟
        const dialogOpenTime = now - updateStartTime;
        
        if (dialogOpenTime > 60000) { // 1分钟
            showForceClose.value = true;
        }
    }
};

// 启动超时计时器
const startTimeoutTimer = () => {
    if (timeoutTimer) {
        clearInterval(timeoutTimer);
    }
    
    // 每5秒检查一次是否超时
    timeoutTimer = setInterval(checkTimeout, 5000);
};

// 强制关闭更新
const forceCloseUpdate = () => {
    // 发送取消命令到后端
    sendCommand('cancelSDKUpdate');
    
    // 重置状态
    isUpdating.value = false;
    showForceClose.value = false;
    updateStartTime = 0;
    
    // 在终端显示关闭信息
    if (terminalRef.value) {
        terminalRef.value.writeln('\r\n\x1b[31m[已强制关闭]\x1b[0m');
    }
    
    if (timeoutTimer) {
        clearInterval(timeoutTimer);
        timeoutTimer = null;
    }
};


// 组件挂载时获取SDK列表
onMounted(() => {
    // 获取SDK列表
    sendCommand('getSDKList');
    
    // 监听来自扩展的消息
    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.command) {
            case 'setSDKList':
                // 设置SDK列表数据
                console.log('Received SDK list:', message.data);
                if (message.data && Array.isArray(message.data)) {
                    sdkList.value = message.data.map((sdk: any) => ({
                        name: sdk.name,
                        description: sdk.description,
                        versions: sdk.versions || [],
                        installedVersion: sdk.installedVersion,
                        selectedVersion: sdk.installedVersion || '',
                        installed: sdk.installed || false,
                        path: sdk.path
                    }));
                    console.log('SDK list set:', sdkList.value);
                } else {
                    console.error('Invalid SDK list data:', message.data);
                }
                break;
            case 'sdkConfigApplied':
                // SDK配置应用成功
                break;
            case 'sdkConfigError':
                // SDK配置应用失败
                showMessage(message.error || 'SDK 配置应用失败');
                break;
            case 'sdkUpdateStarted':
                // 开始更新SDK
                logDialogVisible.value = true;
                isUpdating.value = true;
                logContent.value = '';
                updateStartTime = Date.now(); // 记录开始时间
                nextTick(() => {
                    if (terminalRef.value) {
                        terminalRef.value.clear();
                        terminalRef.value.writeln('\x1b[32m开始更新 ...\x1b[0m');
                    }
                });
                startTimeoutTimer(); // 启动超时检测
                break;
            case 'sdkUpdateLog':
                // 接收更新日志
                if (message.log && terminalRef.value) {
                    // 直接写入终端，xterm会自动处理ANSI转义序列
                    terminalRef.value.write(message.log);
                    // 不需要重置计时器
                }
                break;
            case 'sdkUpdateFinished':
                // 更新完成
                isUpdating.value = false;
                updateStartTime = 0;
                if (terminalRef.value) {
                    if (message.success) {
                        terminalRef.value.writeln('\r\n\x1b[32m更新完成！\x1b[0m');
                    } else {
                        terminalRef.value.writeln('\r\n\x1b[31m更新失败！\x1b[0m');
                    }
                }
                
                // 清理超时计时器
                if (timeoutTimer) {
                    clearInterval(timeoutTimer);
                    timeoutTimer = null;
                }
                break;
        }
    });
});

// 组件卸载时清理
onBeforeUnmount(() => {
    if (timeoutTimer) {
        clearInterval(timeoutTimer);
    }
});
</script>

<style scoped>
@import "./index.less";
</style>