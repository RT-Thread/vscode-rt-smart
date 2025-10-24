<template>
  <div class="rt-page create-project-page">
    <Banner sub-title="创建项目" />
    <div class="rt-page__content rt-stack">
      <div class="rt-card create-project-card">
        <el-form :model="projectInfo" label-width="120">
          <el-form-item label="工程名称">
            <div class="create-project-row create-project-row--name">
              <el-input v-model="projectInfo.name" :placeholder="'请输入工程名称'" />
            </div>
          </el-form-item>
          <el-form-item label="空间路径">
            <div class="create-project-row create-project-row--path">
              <el-input v-model="projectInfo.folder" :placeholder="'请输入路径'" />
              <el-button type="primary" plain @click="getProjectFolderFunction">浏览</el-button>
            </div>
          </el-form-item>
          <el-form-item label="RT-Thread 基线">
            <div class="create-project-row create-project-row--baseline">
              <el-select class="create-project-select" v-model="projectInfo.manufacturer" :placeholder="'请选择'" @change="vendorChanged">
                <el-option
                  v-for="item in projectInfo.projectList"
                  :key="item.manufacturer"
                  :label="item.manufacturer"
                  :value="item.manufacturer"
                />
              </el-select>
              <el-select class="create-project-select" v-model="projectInfo.board" :placeholder="'请选择'" @change="boardChanged">
                <el-option
                  v-for="item in projectInfo.projectList[vendorIndex].boards"
                  :key="typeof item === 'string' ? item : item.board"
                  :label="typeof item === 'string' ? item : item.name"
                  :value="typeof item === 'string' ? item : item.board"
                />
              </el-select>
              <el-button type="primary" plain @click="createProject">创建</el-button>
            </div>
          </el-form-item>
          <el-form-item>
            <div class="create-project-row">
              <el-checkbox class="create-project-checkbox" v-model="projectInfo.linkRTT" disabled>链接RT-Thread</el-checkbox>
              <el-checkbox class="create-project-checkbox" v-model="projectInfo.linkDriver" disabled>链接驱动</el-checkbox>
            </div>
          </el-form-item>
        </el-form>
      </div>
      <div class="rt-card create-project-note">
        <h3 class="rt-section-title">创建工程说明</h3>
        <p>请在工程名称中填写名称，它会在工程空间路径中创建这样名称的目录放置新创建的工程。</p>
        <p class="create-project-warning">⚠️ 请确保空间路径 + 工程名称的路径不存在；否则创建检查失败。</p>
        <div v-if="selectedBoardDescription" class="create-project-board-info">
          <h4 class="rt-subsection-title">选中的板卡信息</h4>
          <p>{{ selectedBoardDescription }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { projectInfo, extensionInfo, envInfo } from './data';
import { sendCommand, sendCommandData } from '../api/vscode';
import Banner from '../components/Banner.vue';
import { useTheme } from '../composables/useTheme';

useTheme();

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
        if (message.data.configInfo && message.data.configInfo.length > 0) {
          envInfo.value.rtConfig.path = message.data.configInfo[0].path || '';
        }
        break;
      case 'setProjectFolder':
        projectInfo.value.folder = message.data;
        break;
      default:
        break;
    }
  });
});

const vendorIndex = computed(() => {
  let current = 0;
  projectInfo.value.projectList.filter((item: any, index: number) => {
    if (item.manufacturer === projectInfo.value.manufacturer) {
      current = index;
    }
  });
  return current;
});

const selectedBoardDescription = computed(() => {
  if (!projectInfo.value.board || !projectInfo.value.projectList || projectInfo.value.projectList.length === 0) {
    return '';
  }
  
  const currentVendor = projectInfo.value.projectList[vendorIndex.value];
  if (!currentVendor || !currentVendor.boards) {
    return '';
  }
  
  const board = currentVendor.boards.find((b: any) => {
    if (typeof b === 'string') {
      return b === projectInfo.value.board;
    } else {
      return b.board === projectInfo.value.board;
    }
  });
  
  if (board && typeof board === 'object' && board.description) {
    return board.description;
  }
  
  return '';
});

const vendorChanged = () => {
  let current = -1;
  projectInfo.value.projectList.filter((item: any, index: number) => {
    if (item.manufacturer === projectInfo.value.manufacturer) {
      current = index;
    }
  });
  if (current === -1) {
    projectInfo.value.board = '';
  } else {
    const boards = projectInfo.value.projectList[current].boards;
    if (boards && boards.length > 0) {
      projectInfo.value.board = typeof boards[0] === 'string' ? boards[0] : boards[0].board;
    }
  }
};

const getProjectFolderFunction = () => {
  sendCommandData('browseProjectFolder', projectInfo.value.folder);
};

const boardChanged = () => {
  // reserved for future behaviour
};

const createProject = () => {
  const project = {
    name: projectInfo.value.name,
    folder: projectInfo.value.folder,
    board: projectInfo.value.board,
    manufacturer: projectInfo.value.manufacturer,
    linkRTT: projectInfo.value.linkRTT,
    linkDriver: projectInfo.value.linkDriver,
  };
  sendCommand('createProject', [project]);
};
</script>

<style scoped lang="less">
@import './index.less';
</style>
