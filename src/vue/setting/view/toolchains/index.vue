<template>
    <div class="content">
        <div class="header-section">
            <h2 class="page-title">本地工具链列表</h2>
            <div class="header-actions">
                <el-button type="primary" @click="addFun">添加工具链</el-button>
                <el-button type="primary" @click="saveFun">保存配置</el-button>
            </div>
        </div>
        
        <div class="table-container">
            <el-table 
                :data="sdkInfo.sdkData" 
                style="width: 100%"
                :empty-text="'暂无数据'"
            >
                <el-table-column 
                    prop="name" 
                    label="名称" 
                    min-width="150"
                />
                <el-table-column 
                    prop="path" 
                    label="路径" 
                    min-width="300"
                    show-overflow-tooltip
                />
                <el-table-column 
                    prop="description" 
                    label="描述" 
                    min-width="200"
                />
                <el-table-column 
                    label="操作" 
                    width="150"
                    align="center"
                >
                    <template #default="scope">
                        <el-button 
                            type="primary" 
                            link 
                            size="small"
                            @click="editFun(scope.row)"
                        >
                            编辑
                        </el-button>
                        <el-button 
                            type="danger" 
                            link 
                            size="small"
                            @click="deleteFun(scope.row)"
                        >
                            删除
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </div>

        <!-- 添加/编辑对话框 -->
        <el-dialog 
            v-model="sdkInfo.dialogVisible" 
            :title="sdkInfo.editMode ? '编辑工具链' : '添加工具链'" 
            width="600px"
            :close-on-click-modal="false"
        >
            <el-form 
                :model="sdkInfo.addToolchain" 
                label-width="80px"
                class="toolchain-form"
            >
                <el-form-item label="名称" required>
                    <el-input 
                        v-model="sdkInfo.addToolchain.name" 
                        placeholder="请输入工具链名称" 
                    />
                </el-form-item>
                <el-form-item label="路径" required>
                    <div class="path-input-group">
                        <el-input 
                            v-model="sdkInfo.addToolchain.path" 
                            placeholder="请选择或输入工具链路径" 
                        />
                        <el-button @click="getToolChainFolderFunction">浏览</el-button>
                    </div>
                </el-form-item>
                <el-form-item label="描述">
                    <el-input 
                        v-model="sdkInfo.addToolchain.description" 
                        placeholder="请输入工具链描述（可选）" 
                        type="textarea"
                        :rows="3"
                    />
                </el-form-item>
            </el-form>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="sdkInfo.dialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="confirmFun">确定</el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { sdkInfo } from "../../data";
import { sendCommand, sendCommandData, showMessage } from "../../../api/vscode"
import { ElMessageBox } from 'element-plus';

const addFun = () => {
    sdkInfo.value.addToolchain = {
        name: "",
        path: "",
        description: "",
    };
    sdkInfo.value.editMode = false;
    sdkInfo.value.dialogVisible = true;
};

const deleteFun = async (row: any) => {
    try {
        await ElMessageBox.confirm(
            `确定要删除工具链 "${row.name}" 吗？`,
            '删除确认',
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning',
            }
        );
        
        // 执行删除
        sdkInfo.value.sdkData = sdkInfo.value.sdkData.filter(
            (item: any) => item !== row
        );
    } catch {
        // 用户取消删除
    }
};

const saveFun = () => {
    let cfg : any = [];

    sdkInfo.value.sdkData.forEach((element: { name: string; path: string; description: string; }) => {
        let item = {name: element.name, path: element.path, description: element.description};
        cfg.push(item);
    });
    sendCommand("setSDKConfig", [cfg]);
};

const editFun = (row: any) => {
    sdkInfo.value.addToolchain = {
        name: row.name,
        path: row.path,
        description: row.description || "",
    };
    sdkInfo.value.selectRow = row;
    sdkInfo.value.editMode = true;
    sdkInfo.value.dialogVisible = true;
};

const confirmFun = () => {
    // 验证必填字段
    if (!sdkInfo.value.addToolchain.name || !sdkInfo.value.addToolchain.path) {
        showMessage("请填写名称和路径！");
        return;
    }

    sdkInfo.value.dialogVisible = false;
    
    if (sdkInfo.value.editMode) {
        // 编辑模式：更新现有数据
        let index = sdkInfo.value.sdkData.indexOf(sdkInfo.value.selectRow);
        if (index !== -1) {
            sdkInfo.value.sdkData[index] = {
                name: sdkInfo.value.addToolchain.name,
                path: sdkInfo.value.addToolchain.path,
                description: sdkInfo.value.addToolchain.description
            };
        }
    } else {
        // 添加模式：新增数据
        sdkInfo.value.sdkData.push({
            name: sdkInfo.value.addToolchain.name,
            path: sdkInfo.value.addToolchain.path,
            description: sdkInfo.value.addToolchain.description
        });
    }
    
    sdkInfo.value.editMode = false;
};

const getToolChainFolderFunction = () => {
    sendCommandData("browseToolchainFolder", sdkInfo.value.addToolchain.path);
};

// 监听来自扩展的消息
onMounted(() => {
    // 获取SDK配置
    sendCommand("getSDkConfig");
    
    // 监听消息
    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.command) {
            case 'setToolchainFolder':
                // 设置工具链文件夹路径
                if (sdkInfo.value.dialogVisible) {
                    sdkInfo.value.addToolchain.path = message.data;
                }
                break;
            case 'setSDKConfig':
                // 设置SDK配置数据
                sdkInfo.value.sdkData = message.data || [];
                break;
        }
    });
});

</script>
<style scoped>
@import "./index.less";
</style>