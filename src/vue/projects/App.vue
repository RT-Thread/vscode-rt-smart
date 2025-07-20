<template>
    <div class="container">
        <img class="logo_img" :src="imgUrl['head-logo']" alt="" /> | workspace工程列表
        <br><br>
        可以在感兴趣的BSP/工程项上✔，然后保存配置，将会在侧边栏中显示对应列表。<br>
        <hr>

        <div style="text-align: right; margin-bottom: 10px;">
            <el-button @click="reloadBSPProjects" style="display: none;">加载列表</el-button>
            <el-button @click="collapseAll">折叠全部列表</el-button>
            <el-button type="primary" @click="saveBSPProjects">保存列表配置</el-button>
        </div>

        <el-table ref="tableRef" v-loading="loading" :data="tableData" style="width: 100%" row-key="id" 
            :expand-row-keys="expandedRowKeys">
            <el-table-column type="selection" width="32"></el-table-column>
            <el-table-column prop="name" label="名称" width="300"></el-table-column>
            <el-table-column prop="path" label="路径" width="500"></el-table-column>
        </el-table>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { ElTable } from 'element-plus';
import { imgUrl } from '../assets/img';
import { sendCommand } from '../api/vscode';

const loading = ref(false); // 是否加载中

const expandedRowKeys = ref([]); // 默认全部折叠
const collapseAll = () => {
    expandedRowKeys.value = []; // 清空展开的行
};

const tableRef = ref<InstanceType<typeof ElTable>>();
const tableData = ref([
    { id: "1", name: 'qemu-virt64-riscv', path: 'qemu-virt64-riscv'}
]);

const reloadBSPProjects = () => {
    sendCommand('searchBSPProjects', ['bsp']);
};

const saveBSPProjects = () => {
    let args: string[] = [];
    const selectedRows = tableRef.value?.getSelectionRows();
    if (selectedRows && selectedRows.length > 0) {
        args = selectedRows.map((row: any) => row.path);
    }

    sendCommand('saveBSPProjects', [args]);
};

onMounted(() => {
    sendCommand('searchBSPProjects', ['bsp']);
    loading.value = true; // 开始加载动画

    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.command) {
            case 'updateProjects':
                tableData.value = message.data.dirs;
                let stars: string[] = message.data.stars;
                tableData.value.forEach((item: any, index: number) => {
                    if (stars.includes(item.path)) {
                        tableRef.value?.toggleRowSelection(item, true);
                    }
                });
                
                loading.value = false; // 停止加载动画
                break;

            default:
                break;
        }
    });
});
</script>

<style scoped>
.container {
    padding: 20px;
}
</style>
