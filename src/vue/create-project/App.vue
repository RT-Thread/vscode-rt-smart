<template>
    <div class="container">
        <Banner />

        <div class="content_area">
            <div class="body-box">
                <br></br>
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
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUpdated } from "vue";
import { projectInfo, extensionInfo, envInfo } from "./data";
import { sendCommand, sendCommandData } from "../api/vscode";
import { imgUrl } from '../assets/img';
import Banner from "../components/Banner.vue";

onUpdated(() => {
    console.log('CreateProject App updated');
});

onMounted(() => {
    sendCommand('getExtensionInfo');
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.command) {
            case 'extensionInfo':
                extensionInfo.value.version = message.data.version;
                projectInfo.value.projectList = message.data.projectList;

                envInfo.value.version = message.data.env.version;
                envInfo.value.path = message.data.env.path;
                
                // 设置RT-Thread配置数据
                if (message.data.configInfo && message.data.configInfo.length > 0) {
                    envInfo.value.rtConfig.path = message.data.configInfo[0].path || '';
                }
                break;

            case 'setProjectFolder':
                // message like {command: 'setProjectFolder', data: 'path'}
                projectInfo.value.folder = message.data;
                break;

            default:
                break;
        }
    });
});

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

</script>

<style scoped>
.container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 0;
}

.header_box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
    background-color: #fff;
    border-bottom: 1px solid #e6e6e6;
    padding: 0 20px;
}

.header_logo {
    display: flex;
    align-items: center;
    column-gap: 12px;
    font-size: 18px;
    color: #333;
    height: 100%;
}

.logo_img {
    width: 228px;
    height: 68px;
}

.logo_text {
    color: #333;
    padding-top: 15px;
}

.logo_text p {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
}

.logo_text span {
    font-size: 12px;
}

.content_area {
    width: 100%;
    height: 100%;

    .body-box {
        width: 80%;
        min-width: 800px;

        .el-form {
            :deep(.el-form-item__label) {
                justify-content: flex-start;
            }
            .file-box {
                width: 0;
            }

            .el-input {
                height: 40px;
            }

            .el-form-item {
                display: flex;
                align-items: center;
            }

            .row-box {
                width: 100%;
                display: flex;
                flex-direction: row;
                align-items: center;
                column-gap: 20px;
            }

            :deep(.el-checkbox) {
                margin-right: 0;
            }

        }

        .iframe-box {
            width: 100%;
            height:auto;
        }
    }
}

</style>
