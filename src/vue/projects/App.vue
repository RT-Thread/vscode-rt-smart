<template>
  <div class="rt-page projects-page">
    <Banner sub-title="项目" />
    <div class="rt-page__content">
      <div class="rt-card projects-card">
        <p class="projects-tip">
          可以在感兴趣的BSP/工程项上✔，然后保存配置，将会在侧边栏中显示对应列表。
        </p>
        <div class="projects-actions">
          <el-button @click="reloadBSPProjects" style="display: none;">加载列表</el-button>
          <el-button @click="collapseAll">折叠全部列表</el-button>
          <el-button type="primary" @click="saveBSPProjects">保存列表配置</el-button>
        </div>
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="tableData"
          row-key="id"
          :expand-row-keys="expandedRowKeys"
          style="width: 100%"
        >
          <el-table-column type="selection" width="32"></el-table-column>
          <el-table-column prop="name" label="名称" width="300"></el-table-column>
          <el-table-column prop="path" label="路径" width="500"></el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue';
import type { ElTable } from 'element-plus';
import { sendCommand } from '../api/vscode';
import Banner from '../components/Banner.vue';
import { useTheme } from '../composables/useTheme';

useTheme();

const loading = ref(false);
const expandedRowKeys = ref<string[]>([]);

const collapseAll = () => {
  expandedRowKeys.value = [];
};

const tableRef = ref<InstanceType<typeof ElTable>>();
const tableData = ref([{ id: '1', name: 'qemu-virt64-riscv', path: 'qemu-virt64-riscv' }]);

const reloadBSPProjects = () => {
  sendCommand('searchBSPProjects', ['bsp']);
};

const saveBSPProjects = () => {
  let args: string[] = [];
  if (tableRef.value) {
    const selectedRows = (tableRef.value as any).getSelectionRows();
    if (selectedRows.length > 0) {
      args = selectedRows.map((row: any) => row.path);
    }
  }
  sendCommand('saveBSPProjects', [args]);
};

onMounted(() => {
  sendCommand('searchBSPProjects', ['bsp']);
  loading.value = true;

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
      case 'updateProjects':
        tableData.value = message.data.dirs;
        const stars: string[] = message.data.stars;
        nextTick(() => {
          tableData.value.forEach((item: any) => {
            if (stars.includes(item.path) && tableRef.value) {
              (tableRef.value as any).toggleRowSelection(item, true);
            }
          });
        });
        loading.value = false;
        break;
      default:
        break;
    }
  });
});
</script>

<style scoped lang="less">
@import './index.less';
</style>
