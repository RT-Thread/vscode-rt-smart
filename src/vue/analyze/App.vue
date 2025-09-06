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
            max-height="70vh"
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

<style scoped>
.container {
  padding: 0;
  background-color: var(--vscode-editor-background, #ffffff);
  color: var(--vscode-editor-foreground, #333333);
  min-height: 100vh;
}

.content_area {
  background-color: var(--vscode-editor-background, #ffffff);
}

.section-tabs {
  --el-bg-color: var(--vscode-editor-background, #ffffff);
  --el-text-color-primary: var(--vscode-editor-foreground, #333333);
  --el-text-color-regular: var(--vscode-descriptionForeground, #6b778c);
  --el-border-color-light: var(--vscode-panel-border, #e1e4e8);
  --el-fill-color-blank: var(--vscode-editor-background, #ffffff);
}

.section-tabs > .el-tabs__content {
  padding: 32px;
  color: var(--vscode-editor-foreground, #333333);
  font-size: 14px;
  font-weight: 400;
}

:deep(.el-tabs__header) {
  background-color: var(--vscode-editorWidget-background, #f5f5f5);
  border-bottom: 1px solid var(--vscode-panel-border, #e1e4e8);
}

:deep(.el-tabs__item) {
  color: var(--vscode-descriptionForeground, #6b778c);
}

:deep(.el-tabs__item:hover) {
  color: var(--vscode-editor-foreground, #333333);
}

:deep(.el-tabs__item.is-active) {
  color: var(--vscode-tab-activeForeground, #333333);
  font-weight: 600;
}

:deep(.el-tabs__active-bar) {
  background-color: var(--vscode-focusBorder, #007acc);
}

:deep(.el-table) {
  --el-table-bg-color: var(--vscode-editor-background, #ffffff);
  --el-table-text-color: var(--vscode-editor-foreground, #333333);
  --el-table-header-text-color: var(--vscode-editor-foreground, #333333);
  --el-table-row-hover-bg-color: var(--vscode-list-hoverBackground, #e8f4fd);
  --el-table-header-bg-color: var(--vscode-editorWidget-background, #f0f0f0);
  --el-table-border-color: var(--vscode-panel-border, #e1e4e8);
  --el-bg-color: var(--vscode-editor-background, #ffffff);
  --el-fill-color-blank: var(--vscode-editor-background, #ffffff);
  background-color: var(--vscode-editor-background, #ffffff);
}

:deep(.el-table th.el-table__cell) {
  background-color: var(--vscode-editorWidget-background, #f0f0f0);
  color: var(--vscode-editor-foreground, #333333);
  font-weight: 600;
  border-bottom: 1px solid var(--vscode-panel-border, #e1e4e8);
}

:deep(.el-table td.el-table__cell) {
  color: var(--vscode-editor-foreground, #333333);
  border-bottom: 1px solid var(--vscode-widget-border, #e1e4e8);
}

:deep(.el-table__row:hover > td.el-table__cell) {
  background-color: var(--vscode-list-hoverBackground, #e8f4fd) !important;
}

:deep(.el-loading-mask) {
  background-color: var(--vscode-editor-background, #ffffff);
  opacity: 0.9;
}

:deep(.el-loading-spinner .circular circle) {
  stroke: var(--vscode-focusBorder, #007acc);
}

:deep(.el-table__footer-wrapper) {
  background-color: var(--vscode-editorWidget-background, #f5f5f5);
  border-top: 2px solid var(--vscode-panel-border, #e1e4e8);
}

:deep(.el-table__footer-wrapper .el-table__cell) {
  background-color: var(--vscode-editorWidget-background, #f5f5f5);
  color: var(--vscode-editor-foreground, #333333);
  font-weight: 600;
}

:deep(.el-table__body tr.current-row > td.el-table__cell) {
  background-color: var(--vscode-list-activeSelectionBackground, #e4f3ff) !important;
}

.symbol-info-panel {
  margin-top: 16px;
  border: 1px solid var(--vscode-panel-border, #e1e4e8);
  border-radius: 4px;
  background-color: var(--vscode-editorWidget-background, #f5f5f5);
  overflow: hidden;
}

.symbol-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--vscode-editorWidget-background, #f0f0f0);
  border-bottom: 1px solid var(--vscode-panel-border, #e1e4e8);
  font-weight: 600;
  color: var(--vscode-editor-foreground, #333333);
}

.symbol-info-content {
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
  background-color: var(--vscode-editor-background, #ffffff);
}

.symbol-info-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: var(--vscode-editor-font-family, 'Courier New', monospace);
  font-size: 13px;
  line-height: 1.5;
  color: var(--vscode-editor-foreground, #333333);
}

:deep(.el-button.is-text) {
  color: var(--vscode-editor-foreground, #333333);
}

:deep(.el-button.is-text:hover) {
  color: var(--vscode-focusBorder, #007acc);
  background-color: var(--vscode-list-hoverBackground, #e8f4fd);
}

:deep(.el-icon) {
  font-size: 16px;
}
</style>
