<template>
    <div class="content">
        <div class="body-box">
            <el-form :model="analysisInfo" label-width="80">
                <el-form-item label="map文件">
                    <div class="row-box">
                        <el-input v-model="analysisInfo.mapFileUrl" placeholder="请输入内容" />
                        <el-button type="primary" plain @click="getFileFun"><input type="file" ref="fileInput"
                                @change="handleFileChange" class="file-box" />浏览</el-button>
                        <el-button type="primary" plain @click="readMapFun">分析</el-button>
                    </div>
                </el-form-item>
            </el-form>
            <ul>
                <li v-for="(item, index) in analysisInfo.analysisTableList" :class="{ active: index === current }"
                    :key="index" @click="tableChange(index)">
                    {{ item.title }}
                </li>
            </ul>

            <el-table v-loading="loading" element-loading-text="Loading..." :element-loading-spinner="svg"
                element-loading-svg-view-box="-10, -10, 50, 50" class="loading_box"
                :data="analysisInfo.analysisTableList[current].children" style="width: 100%">
                <el-table-column v-for="item in analysisInfo.analysisTitleList" :key="item.title" :prop="item.field"
                    :label="item.title" />
            </el-table>
        </div>
    </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { analysisInfo } from '../../data';

const loading = ref(false);
const svg = `
        <path class="path" d="
          M 30 15
          L 28 17
          M 25.61 25.61
          A 15 15, 0, 0, 1, 15 30
          A 15 15, 0, 1, 1, 27.99 7.5
          L 15 15
        " style="stroke-width: 4px; fill: rgba(0, 0, 0, 0)"/>
      `;
const current = ref<number>(0);
const tableChange = (index: number) => {
    current.value = index;
};
const fileInput = ref<any>(null);
const getFileFun = () => {
    if (fileInput.value) {
        fileInput.value.click();
    }
};
const handleFileChange = (event: any) => {
    const input = event.target;
    if (!input.files || !input.files.length) return;
    const file = input.files[0];
    if (file.name.split(".").pop() !== "map") {
        ElMessage.error("请选择.map文件");
        return;
    }
    analysisInfo.value.mapFile = file;
    if (URL && URL.createObjectURL) {
        analysisInfo.value.mapFileUrl = file.name || URL.createObjectURL(file);
    } else {
        analysisInfo.value.mapFileUrl = "";
    }
};
const readMapFun = () => {
    const reader = new FileReader();
    loading.value = true;
    reader.onload = (e: any) => {
        // 处理读取到的.map文件内容
        const mapContent = e.target.result;
        setTimeout(() => {
            loading.value = false;
        }, 5000);
        // console.log(mapContent);
    };
    reader.readAsText(analysisInfo.value.mapFile);
};
</script>
<style scoped>
@import "./index.less";
</style>
