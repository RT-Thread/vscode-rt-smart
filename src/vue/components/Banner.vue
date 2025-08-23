<template>
  <div class="banner">
    <img src="https://oss-club.rt-thread.org/uploads/20250820/d1558ec1b465f2a3c44646550211a6d5.png" class="logo" />
    <div class="info">
      <h1>{{ extentionName }}</h1>
      <p>{{ extentionVersion }}</p>
      <div class="bar"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

export interface BannerProps {
  subTitle?: string
  version?: string
}

const extentionName = ref('')
const extentionVersion = ref('')

const props = withDefaults(defineProps<BannerProps>(), {
  subTitle: '扩展工具 - 关于',
  version: '版本 v1.0.1'
})

window.addEventListener('message', (e) => {
  e.data.name && (extentionName.value = `${e.data.name} - ${props.subTitle}`)
  e.data.version && (extentionVersion.value = e.data.version)
})
</script>

<style scoped>
.banner {
  display: flex;
  padding: 20px;
  gap: 8px;
  background: #fff;
}
.logo {
  height: 60px;
}
.info {
  flex: 1;
  padding-top: 5px;
}
h1 {
  font-size: 16px;
  font-weight: 500;
  color: #000;
  margin: 0;
}
p {
  font-size: 12px;
  color: #000;
  margin: 4px 0 8px;
}
.bar {
  height: 3px;
  background: linear-gradient(90deg, #32B7BC, #fff);
}
</style>