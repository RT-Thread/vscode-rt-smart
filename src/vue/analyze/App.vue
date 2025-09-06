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
          v-for="item in sections"
          :label="item.name"
          :name="item.name"
        >
          <el-table
            :data="tableData"
            style="width: 100%"
            v-loading="tableLoading"
            max-height="70vh"
          >
            <el-table-column
              v-for="item in tableColumns"
              :prop="item.prop"
              :label="item.label"
              width="180"
            />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import Banner from "../components/Banner.vue";
import type { TabPaneName, TabsPaneContext } from "element-plus";
declare var acquireVsCodeApi: any;

const vscode = acquireVsCodeApi();

interface Section {
  name: string;
}

const SECTIONS = "sections";
const SYMBOLS_BY_SECTION = "symbolsBySection";
const SYMBOLS_BY_SECTION_FROM_ELF = "symbolsBySectionFromElf";

const activeName = ref();

const tableLoading = ref(true);

const tableColumns = [
  {
    label: "符号名称",
    prop: "name",
  },
  {
    label: "类型",
    prop: "type",
  },
  {
    label: "地址",
    prop: "hexaddr",
  },
  {
    label: "大小",
    prop: "size",
  },
];

const tableData = ref([]);

const handleSentMessage = (sectionName: string) => {
  vscode.postMessage(
    {
      eventName: SYMBOLS_BY_SECTION,
      sectionName,
    },
    "*"
  );
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
</style>
