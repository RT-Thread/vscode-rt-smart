<template>
    <div class="rt-page about-page container">
        <Banner sub-title="关于" />

        <div class="rt-page__content content_area">
            <div class="markdown-body" v-html="readmeMarkdown"></div>

            <el-button type="primary" @click="openRTThreadGitHub">Open RT-Thread/Github</el-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useTheme } from '../composables/useTheme';
import { sendCommand } from '../api/vscode';
import Banner from '../components/Banner.vue';
import '../assets/markdown.css';

let readmeMarkdown = ref('');

useTheme();

const openRTThreadGitHub = () => {
    sendCommand('openURL', ['https://github.com/RT-Thread/rt-thread']);
};

onMounted(() => {
    sendCommand('renderReadme');
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.command) {
            case 'setReadme':
                readmeMarkdown.value = message.data;
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
