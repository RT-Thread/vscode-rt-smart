<template>
  <div class="container">
    <Banner sub-title="分析" />

    <div class="content_area">
      <el-tabs
        v-model="activeName"
        class="demo-tabs"
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
    prop: "address",
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
  background-color: #fff;
  min-height: 100vh;
}

.demo-tabs > .el-tabs__content {
  padding: 32px;
  color: #6b778c;
  font-size: 32px;
  font-weight: 600;
}
</style>
