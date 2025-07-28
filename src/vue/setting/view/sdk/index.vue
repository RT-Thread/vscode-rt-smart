<template>
    <div class="content">
        <div class="body-box">
            <div class="sdk-title">SDK 管理器</div>
            <div class="table-box">
                <el-table @current-change="handleCurrentChange" highlight-current-row
                    :data="sdkInfo.sdkData" style="width: 100%">
                    <el-table-column v-for="item in sdkInfo.sdkTitleList" :key="item.title"
                        :prop="item.field" :label="item.title" />
                </el-table>
                <div class="btn-box">
                    <el-button type="primary" plain @click="addFun">添加</el-button>
                    <el-button type="primary" plain @click="deleteFun">删除</el-button>
                    <el-button type="primary" plain @click="editFun">编辑</el-button>
                    <el-button type="primary" plain @click="saveFun">保存</el-button>
                </div>
            </div>
        </div>
        <el-dialog v-model="sdkInfo.dialogVisible" width="630" title="工具链配置">
            <div class="form-box">
                <el-form :data="sdkInfo.addToolchain" label-width="70">
                    <el-form-item label="名称">
                        <div class="row-box">
                            <el-input v-model="sdkInfo.addToolchain.name" placeholder="请输入内容" />
                            <p></p>
                        </div>
                    </el-form-item>
                    <el-form-item label="路径">
                        <div class="row-box">
                            <el-input v-model="sdkInfo.addToolchain.path" placeholder="请输入内容" />
                            <el-button type="primary" plain @click="getToolChainFolderFunction">浏览</el-button>
                        </div>
                    </el-form-item>
                    <el-form-item label="描述">
                        <el-input v-model="sdkInfo.addToolchain.description" placeholder="请输入内容" />
                    </el-form-item>
                </el-form>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button type="primary" plain @click="confirmFun">确定</el-button>
                    <el-button type="primary" plain @click="sdkInfo.dialogVisible = false">
                        取消
                    </el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { sdkInfo } from "../../data";
import { sendCommand, sendCommandData, showMessage } from "../../../api/vscode"

const addFun = () => {
    sdkInfo.value.addToolchain = {
        name: "",
        path: "",
        description: "",
    };
    sdkInfo.value.editMode = false;
    sdkInfo.value.dialogVisible = true;
};

const deleteFun = () => {
    if (sdkInfo.value.selectRow != null) {
        let sdkData = sdkInfo.value.sdkData;
        let value = sdkInfo.value.selectRow;
        if (value.name) {
            sdkInfo.value.sdkData = sdkData.filter(
                (key: any) => key != value
            );
        }

        sdkInfo.value.selectRow = null;
    }
    else {
        showMessage("请选择需要删除的数据");
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

const editFun = () => {
    if (sdkInfo.value.selectRow != null) {
        sdkInfo.value.addToolchain.name = sdkInfo.value.selectRow.name;
        sdkInfo.value.addToolchain.path = sdkInfo.value.selectRow.path;
        sdkInfo.value.addToolchain.description = sdkInfo.value.selectRow.description;

        sdkInfo.value.editMode = true;
        sdkInfo.value.dialogVisible = true;
    }
};

const confirmFun = () => {
    if (Object.values(sdkInfo.value.addToolchain).some((value) => value != null && value != '')) {
        sdkInfo.value.dialogVisible = false;
        if (sdkInfo.value.editMode) {
            let index = sdkInfo.value.sdkData.indexOf(sdkInfo.value.selectRow);
            sdkInfo.value.sdkData[index].name = sdkInfo.value.addToolchain.name;
            sdkInfo.value.sdkData[index].path = sdkInfo.value.addToolchain.path;
            sdkInfo.value.sdkData[index].description = sdkInfo.value.addToolchain.description;
        }
        else {
            sdkInfo.value.sdkData.unshift(sdkInfo.value.addToolchain);
        }
        sdkInfo.value.editMode = false;
    } else {
        showMessage("请完善新增信息！");
    }
};

const getToolChainFolderFunction = () => {
    sendCommandData("browseToolchainFolder", sdkInfo.value.addToolchain.path);
};

const handleCurrentChange = (val: any) => {
    sdkInfo.value.selectRow = val;
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
