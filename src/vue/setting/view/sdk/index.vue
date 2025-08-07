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
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { sendCommand, showMessage } from '../../../api/vscode';

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
    // 收集所有SDK的配置信息
    const sdkConfigs = sdkList.value.map(sdk => ({
        name: sdk.name,
        version: sdk.selectedVersion || '',
        selected: !!sdk.selectedVersion,
        path: sdk.path || ''
    }));
    
    // 发送配置到后端保存到.config文件
    sendCommand('saveSDKDotConfig', [sdkConfigs]);
    showMessage('正在保存SDK配置...');
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
                }
                break;
            case 'sdkConfigApplied':
                // SDK配置应用成功
                showMessage('SDK 配置已保存到 .config 文件');
                break;
            case 'sdkConfigError':
                // SDK配置应用失败
                showMessage(message.error || 'SDK 配置应用失败');
                break;
        }
    });
});
</script>

<style scoped>
@import "./index.less";
</style>