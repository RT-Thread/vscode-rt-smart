<template>
    <div class="content">
        <div class="body-box">
            <el-form :model="projectInfo" label-width="120">
                <el-form-item label="工程名称">
                    <div class="row-box">
                        <el-input v-model="projectInfo.name" placeholder="请输入内容" />
                    </div>
                </el-form-item>
                <el-form-item label="空间路径">
                    <div class="row-box">
                        <el-input v-model="projectInfo.folder" placeholder="请输入内容" />
                        <el-button type="primary" plain @click="getProjectFolderFunction">浏览</el-button>
                    </div>
                </el-form-item>
                <el-form-item label="RT-Thread 基线">
                    <div class="row-box">
                        <el-select style="width: 40%" v-model="projectInfo.manufacturer" placeholder="请选择"
                            @change="vendorChanged">
                            <el-option v-for="item in projectInfo.projectList" :key="item.manufacturer" :label="item.manufacturer"
                                :value="item.manufacturer" />
                        </el-select>
                        <el-select style="width: 50%" v-model="projectInfo.board" placeholder="请选择"
                            @change="boardChanged">
                            <el-option v-for="item in projectInfo.projectList[vendorIndex].boards" :key="item"
                                :label="item" :value="item" />
                        </el-select>
                        <el-button type="primary" plain @click="createProject">创建</el-button>
                    </div>
                </el-form-item>
                <el-form-item label="">
                    <div class="row-box">
                        <el-checkbox style="width: 40%" v-model="projectInfo.linkRTT" disabled>链接RT-Thread</el-checkbox>
                        <el-checkbox style="width: 50%" v-model="projectInfo.linkDriver" disabled>链接驱动</el-checkbox>
                        <p style="width: 98px"></p>
                    </div>
                </el-form-item>
            </el-form>
            <div>
                <h3> 创建工程说明 </h3>
                请在工程名称中填写名称，它会在工程空间路径中创建这样名称的目录放置新创建的工程。
                <br><br>
                ⚠️ 请确保空间路径 + 工程名称的路径不存在；否则创建检查失败。
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { projectInfo } from "../../data";
import { sendCommand, sendCommandData } from "../../../api/vscode";

const vendorIndex = computed(() => {
    let current = 0;
    projectInfo.value.projectList.filter((item: any, index: any) => {
        if (item.manufacturer === projectInfo.value.manufacturer) {
            current = index;
        }
    });
    return current;
});

const vendorChanged = () => {
    let current = 0;

    // 当重新选择vendor时，对board进行重置
    projectInfo.value.projectList.filter((item: any, index: any) => {
        if (item.manufacturer === projectInfo.value.manufacturer) {
            current = index;
        }
    });

    if (current === -1) {
        projectInfo.value.board = "";
    }
    else {
        projectInfo.value.board = projectInfo.value.projectList[current].boards[0];
    }

    // sendCommandData("getBoardReadme", {manufacturer: projectInfo.value.manufacturer, board: projectInfo.value.board});
};

const getProjectFolderFunction = () => {
    sendCommandData("browseProjectFolder", projectInfo.value.folder);
}

// 当选择board时，展示对应目录下的README.md文件
const boardChanged = () => {
}

const createProject = () => {
    let project = {name: "", folder: "", board: "", manufacturer: "", linkRTT: false, linkDriver: false};

    project.name = projectInfo.value.name;
    project.folder = projectInfo.value.folder;
    project.board = projectInfo.value.board;
    project.manufacturer  = projectInfo.value.manufacturer;
    project.linkRTT = projectInfo.value.linkRTT;
    project.linkDriver = projectInfo.value.linkDriver;

    sendCommand("createProject", [project]);
}

onMounted(async () => {
});

</script>
<style scoped>
@import "./index.less";
</style>
