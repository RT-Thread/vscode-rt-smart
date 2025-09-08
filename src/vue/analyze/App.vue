<template>
  <div class="container">
    <Banner sub-title="分析" />

    <div class="content_area">
      <el-tabs
        v-model="activeName"
        class="section-tabs"
        @tab-change="handleVChanged"
      >
        <el-tab-pane
          highlight-current-row
          v-for="item in sections"
          :label="item.name"
          :name="item.name"
        >
          <el-table
            :data="tableData"
            style="width: 100%"
            v-loading="tableLoading"
            max-height="65vh"
            show-summary
            :summary-method="getSummaries"
            highlight-current-row
            @row-click="handleRowClick"
            @row-dblclick="handleRowDblclick"
          >
            <el-table-column
              v-for="item in tableColumns"
              sortable
              :prop="item.prop"
              :label="item.label"
              :width="item.width"
              :resizable="true"
            />
          </el-table>
          <div v-if="symbolInfo" class="symbol-info-panel">
            <div class="symbol-info-header">
              <span>符号详细信息</span>
              <el-button size="small" text @click="symbolInfo = null">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
            <div class="symbol-info-content">
              <pre>{{ symbolInfo }}</pre>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import Banner from "../components/Banner.vue";
import { Close } from '@element-plus/icons-vue';
import type { TabPaneName, TabsPaneContext } from "element-plus";
declare var acquireVsCodeApi: any;

const vscode = acquireVsCodeApi();

interface Section {
  name: string;
}

const SECTIONS = "sections";
const SYMBOLS_BY_SECTION = "symbolsBySection";
const SYMBOLS_BY_SECTION_FROM_ELF = "symbolsBySectionFromElf";
const GET_SYMBOL_INFO = "getSymbolInfo";
const OPEN_SYMBOL_SOURCE = "openSymbolSource";
const SYMBOL_INFO_RESPONSE = "symbolInfoResponse";

const activeName = ref();

const tableLoading = ref(true);

const tableColumns = [
  {
    label: "符号名称",
    prop: "name",
    width: 300,
  },
  {
    label: "类型",
    prop: "type",
    width: 150,
  },
  {
    label: "地址",
    prop: "hexaddr",
    width: 150,
  },
  {
    label: "大小",
    prop: "size",
    width: 150,
  },
];

const tableData = ref([]);
const symbolInfo = ref<string | null>(null);

const handleRowClick = (row: any, column: any, event: Event) => {
  console.log('Row clicked:', row);
  const symbolName = row.name;
  vscode.postMessage({
    eventName: GET_SYMBOL_INFO,
    symbolName,
  });
};

const handleRowDblclick = (row: any, column: any, event: Event) => {
  console.log('Row double-clicked:', row);
  
  // 如果是 OBJECT 类型的符号，直接返回不处理
  if (row.type === 'OBJECT') {
    return;
  }
  
  const symbolName = row.name;
  vscode.postMessage({
    eventName: OPEN_SYMBOL_SOURCE,
    symbolName,
  });
};

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  
  columns.forEach((column: any, index: number) => {
    if (index === 0) {
      sums[index] = '总计';
      return;
    }
    
    if (column.property === 'size') {
      const values = data.map((item: any) => Number(item[column.property]));
      if (!values.every((value: number) => isNaN(value))) {
        const total = values.reduce((prev: number, curr: number) => {
          const value = Number(curr);
          if (!isNaN(value)) {
            return prev + curr;
          } else {
            return prev;
          }
        }, 0);
        sums[index] = total.toLocaleString();
      } else {
        sums[index] = '';
      }
    } else {
      sums[index] = '';
    }
  });
  
  return sums;
};

const handleSentMessage = (sectionName: string) => {
  vscode.postMessage({
    eventName: SYMBOLS_BY_SECTION,
    sectionName,
  });
};

const handleVChanged = (name: TabPaneName) => {
  tableLoading.value = true;
  handleSentMessage(`${name}`);
};

const sections = ref<Section[]>([]);

onMounted(() => {
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.from !== "extension") {
      return;
    }
    console.log(message);
    switch (message.eventName) {
      case SECTIONS:
        sections.value = message.data;
        activeName.value = message.data[0].name;
        handleSentMessage(message.data[0].name);
        break;

      case SYMBOLS_BY_SECTION_FROM_ELF:
        tableLoading.value = false;
        tableData.value = message.data;
        break;
      
      case SYMBOL_INFO_RESPONSE:
        symbolInfo.value = message.data;
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
