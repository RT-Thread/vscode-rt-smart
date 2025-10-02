<template>
    <div class="container">
        <Banner sub-title="关于" />

        <div class="content_area">
            <div v-html="readmeMarkdown"></div>

            <el-button type="primary" @click="openRTThreadGitHub">Open RT-Thread/Github</el-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { imgUrl } from '../assets/img';
import { sendCommand } from '../api/vscode';
import { extensionInfo } from '../setting/data';
import Banner from '../components/Banner.vue';

let readmeMarkdown = ref('');

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
