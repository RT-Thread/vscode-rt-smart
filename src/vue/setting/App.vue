<template>
    <div class="rt-page setting-page">
        <Banner sub-title="Env 设置" />
        <main class="setting-content">
            <Environment />
        </main>
    </div>
</template>

<script setup lang="ts">
import Banner from '../components/Banner.vue';
import Environment from './view/environment/index.vue';
import { useTheme } from '../composables/useTheme';

useTheme();
</script>

<style scoped lang="less">
@import '../styles/variables.less';

.setting-content {
    max-width: 1100px;
    margin: 0 auto;
    padding: @spacing-lg @spacing-xl;
}

@media (max-width: 600px) {
    .setting-content {
        padding: @spacing-base;
    }
}
</style>
