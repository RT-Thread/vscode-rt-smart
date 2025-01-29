<template>
    <div class="content">
        <div class="body-box">
            <div class="title">目录路径</div>
            <div class="table-box">
                <el-table @row-click="handleRowClick" highlight-current-row :data="configInfo.configData"
                    style="width: 100%">
                    <el-table-column v-for="item in configInfo.configTitleList" :key="item.title" :prop="item.field"
                        :label="item.title">
                        <template #default="scope">
                            <div>
                                <el-input v-model="scope.row[item.field]" v-if="
                                    configInfo.editRow &&
                                    scope.row.id === configInfo.editRow.id && editStatus
                                "></el-input>
                                <span v-else>{{ scope.row[item.field] }}</span>
                            </div>
                        </template>
                    </el-table-column>
                </el-table>
                <div class="btn-box">
                    <el-button type="primary" plain @click="editFun">编辑</el-button>
                </div>
            </div>
        </div>

        <el-dialog v-model="configInfo.dialogVisible" width="630">
            <div class="form-box">
                <el-form :data="configInfo.editConfigItem" label-width="70">
                    <el-form-item label="名称">
                        <div class="row-box">
                            <el-input disabled v-model="configInfo.editConfigItem.name" placeholder="请输入内容" />
                        </div>
                    </el-form-item>
                    <el-form-item label="路径">
                        <div class="row-box">
                            <el-input v-model="configInfo.editConfigItem.path" placeholder="请输入内容" />
                            <el-button type="primary" plain @click="getItemFolderFunction">浏览</el-button>
                        </div>
                    </el-form-item>
                    <el-form-item label="描述">
                        <el-input disabled v-model="configInfo.editConfigItem.description" placeholder="请输入内容" />
                    </el-form-item>
                </el-form>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button type="primary" plain @click="confirmFunction">确定</el-button>
                    <el-button type="primary" plain @click="configInfo.dialogVisible = false">取消</el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { configInfo } from "../../data";
import { sendCommand, sendCommandData, showMessage } from "../../../api/vscode";

let selectIndex = -1;

const handleRowClick = (row: any) => {
    selectIndex = configInfo.value.configData.indexOf(row)
};

const editStatus = ref(false)
const editFun = () => {
    if (selectIndex != -1) {
        configInfo.value.editConfigItem.name = configInfo.value.configData[selectIndex].name;
        configInfo.value.editConfigItem.path = configInfo.value.configData[selectIndex].path;
        configInfo.value.editConfigItem.description = configInfo.value.configData[selectIndex].description;

        configInfo.value.dialogVisible = true
    }
    else {
        showMessage('请选择编辑项！');
    }
};

const getItemFolderFunction = () => {
    if (configInfo.value.editConfigItem.path) {
        sendCommandData("browseItemFolder", configInfo.value.editConfigItem.path);
    }
    else {
        sendCommandData("browseItemFolder", {});
    }
};

const confirmFunction = () => {
    if (selectIndex != -1) {
        let item = {
            name: configInfo.value.editConfigItem.name, 
            path: configInfo.value.editConfigItem.path, 
            description: configInfo.value.editConfigItem.description
        };

        configInfo.value.configData[selectIndex].name = configInfo.value.editConfigItem.name;
        configInfo.value.configData[selectIndex].path = configInfo.value.editConfigItem.path;
        configInfo.value.configData[selectIndex].description = configInfo.value.editConfigItem.description;

        sendCommand("setConfig", [[item]]);
    }

    configInfo.value.dialogVisible = false;
};

</script>
<style scoped>
@import "./index.less";
</style>
