<template>
    <div class="content">
        <div class="body-box">
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

            <div class="bottom-box">
                <div class="title">指定工具链情况</div>
                <div class="table-box">
                    <el-table @current-change="handleCurrentChange" highlight-current-row
                        :data="envInfo.environmentData" style="width: 100%">
                        <el-table-column v-for="item in envInfo.environmentTitleList" :key="item.title"
                            :prop="item.field" :label="item.title" />
                    </el-table>
                    <div class="btn-box">
                        <el-button type="primary" plain @click="addFun">添加</el-button>
                        <el-button type="primary" plain @click="deleteFun">删除</el-button>
                        <br>
                        <el-button type="primary" plain @click="editFun">编辑</el-button>
                        <el-button type="primary" plain @click="saveFun">保存</el-button>
                    </div>
                </div>
            </div>
        </div>
        <el-dialog v-model="envInfo.dialogVisible" width="630">
            <div class="form-box">
                <el-form :data="envInfo.addToolchain" label-width="70">
                    <el-form-item label="名称">
                        <div class="row-box">
                            <el-input v-model="envInfo.addToolchain.name" placeholder="请输入内容" />
                            <p></p>
                        </div>
                    </el-form-item>
                    <el-form-item label="路径">
                        <div class="row-box">
                            <el-input v-model="envInfo.addToolchain.path" placeholder="请输入内容" />
                            <el-button type="primary" plain @click="getToolChainFolderFunction">浏览</el-button>
                        </div>
                    </el-form-item>
                    <el-form-item label="描述">
                        <el-input v-model="envInfo.addToolchain.description" placeholder="请输入内容" />
                    </el-form-item>
                </el-form>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button type="primary" plain @click="confirmFun">确定</el-button>
                    <el-button type="primary" plain @click="envInfo.dialogVisible = false">
                        取消
                    </el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { envInfo } from "../../data";
import { sendCommand, sendCommandData, showMessage } from "../../../api/vscode"
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
        }
    });
});

const addFun = () => {
    envInfo.value.addToolchain = {
        name: "",
        path: "",
        description: "",
    };
    envInfo.value.editMode = false;
    envInfo.value.dialogVisible = true;
};

const deleteFun = () => {
    if (envInfo.value.selectRow != null) {
        let envData = envInfo.value.environmentData;
        let value = envInfo.value.selectRow;
        if (value.name) {
            envInfo.value.environmentData = envData.filter(
                (key: any) => key != value
            );
        }

        envInfo.value.selectRow = null;
    }
    else {
        showMessage("请选择需要删除的数据");
    }
};

const saveFun = () => {
    let cfg : any = [];

    envInfo.value.environmentData.forEach((element: { name: string; path: string; description: string; }) => {
        let item = {name: element.name, path: element.path, description: element.description};
        cfg.push(item);
    });
    sendCommand("setSDKConfig", [cfg]);
};

const editFun = () => {
    if (envInfo.value.selectRow != null) {
        envInfo.value.addToolchain.name = envInfo.value.selectRow.name;
        envInfo.value.addToolchain.path = envInfo.value.selectRow.path;
        envInfo.value.addToolchain.description = envInfo.value.selectRow.description;

        envInfo.value.editMode = true;
        envInfo.value.dialogVisible = true;
    }
};

const confirmFun = () => {
    if (Object.values(envInfo.value.addToolchain).some((value) => value != null && value != '')) {
        envInfo.value.dialogVisible = false;
        if (envInfo.value.editMode) {
            let index = envInfo.value.environmentData.indexOf(envInfo.value.selectRow);
            envInfo.value.environmentData[index].name = envInfo.value.addToolchain.name;
            envInfo.value.environmentData[index].path = envInfo.value.addToolchain.path;
            envInfo.value.environmentData[index].description = envInfo.value.addToolchain.description;
        }
        else {
            envInfo.value.environmentData.unshift(envInfo.value.addToolchain);
        }
        envInfo.value.editMode = false;
    } else {
        showMessage("请完善新增信息！");
    }
};

let isInstalling = ref<boolean>(false);
const installEnv = () => {
    isInstalling.value = true;
    setTimeout(() => {
        isInstalling.value = false;
    }, 3000);
}

const getToolChainFolderFunction = () => {
    sendCommandData("browseToolchainFolder", envInfo.value.addToolchain.path);
};

const handleCurrentChange = (val: any) => {
    envInfo.value.selectRow = val;
};

</script>
<style scoped>
@import "./index.less";
</style>
