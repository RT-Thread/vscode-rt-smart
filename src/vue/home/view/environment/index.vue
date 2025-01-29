<template>
    <div class="content">
        <div class="body-box">
            <div class="info-box">
                <div class="info-left">
                    <div class="info-content">
                        <p>env信息：</p>
                        <ul class="info-text">
                            <li> 版本 {{ envInfo.version }} </li>
                            <li> 安装路径 {{ envInfo.path }} </li>
                        </ul>
                    </div>
                    <div class="progress-box" v-if="isInstalling">
                        <p>安装信息...</p>
                        <el-progress :percentage="envInfo.progressNum" />
                    </div>
                </div>
                <el-button type="primary" plain :disabled="installButtonDisabled" @click="installEnv">安装</el-button>
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
import { ref } from "vue";
import { envInfo } from "../../data";
import { sendCommand, sendCommandData, showMessage } from "../../../api/vscode"

const installButtonDisabled = ref(true);

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
